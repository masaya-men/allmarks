// functions/claim.test.ts
import { describe, it, expect, vi } from 'vitest'
import { onRequestGet } from './claim'

async function makeTestKeys() {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey))
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
  const toB64url = (b: Uint8Array) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return { publicKeyB64url: toB64url(raw), privateKeyB64url: toB64url(pkcs8) }
}

function makeCtx(url: string, kvStore: Map<string, string>, privateKeyB64url: string) {
  const K3_KV = {
    get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => { kvStore.set(k, v) }),
  }
  const ctx = { request: new Request(url), env: { K3_KV, K3_PRIVATE_KEY: privateKeyB64url } } // gitleaks:allow (locally-generated ephemeral test keypair, not a real secret)
  return { ctx, K3_KV }
}

describe('GET /claim', () => {
  it('mints a key, writes issued: and bumps claim: issuedCount, returns 200 HTML containing the key', async () => {
    const { publicKeyB64url, privateKeyB64url } = await makeTestKeys()
    const kvStore = new Map<string, string>()
    kvStore.set('claim:secret1', JSON.stringify({ label: 'launch', issuedCount: 0, maxIssue: 10, active: true }))
    const { ctx, K3_KV } = makeCtx('https://allmarks.app/claim?c=secret1', kvStore, privateKeyB64url)

    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(200)
    const html = await res.text()

    // 発行されたキーを本文から抽出して署名検証する（デコードして検証まで通すのが
    // 「本当に正しい鍵で署名されたか」の唯一の確実な検証）
    const match = html.match(/[\w-]{20,}\.[\w-]{20,}/)
    expect(match).not.toBeNull()
    const keyString = match![0]
    const [payloadB64url, sigB64url] = keyString.split('.')
    const toBytes = (b64url: string) => {
      const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
      return new Uint8Array(Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64'))
    }
    const pub = await crypto.subtle.importKey('raw', new Uint8Array(toBytes(publicKeyB64url)), { name: 'Ed25519' }, true, ['verify'])
    const ok = await crypto.subtle.verify('Ed25519', pub, new Uint8Array(toBytes(sigB64url)), new TextEncoder().encode(payloadB64url))
    expect(ok).toBe(true)
    const payload = JSON.parse(new TextDecoder().decode(toBytes(payloadB64url)))
    expect(payload.scope).toEqual(['sync'])
    expect(payload.v).toBe(1)

    expect(K3_KV.put).toHaveBeenCalledWith(`issued:${payload.kid}`, expect.any(String))
    const updatedClaim = JSON.parse(kvStore.get('claim:secret1')!)
    expect(updatedClaim.issuedCount).toBe(1)
  })

  it('returns an error page (200 HTML, no key) for an unknown claimSecret', async () => {
    const { privateKeyB64url } = await makeTestKeys()
    const { ctx } = makeCtx('https://allmarks.app/claim?c=doesnotexist', new Map(), privateKeyB64url)
    const res = await onRequestGet(ctx as never)
    const html = await res.text()
    expect(html).not.toMatch(/[\w-]{20,}\.[\w-]{20,}/) // no key-shaped string in the body
  })

  it('returns an error page (not unlimited issuance) when the KV record has a mistyped/missing field', async () => {
    // Simulates a manually-seeded KV entry (wrangler kv key put) with a typo'd
    // field name — e.g. "maxIssues" instead of "maxIssue". Without runtime
    // validation, record.issuedCount >= record.maxIssue becomes
    // `0 >= undefined` = false, and the cap never triggers.
    const { privateKeyB64url } = await makeTestKeys()
    const kvStore = new Map<string, string>([['claim:secret1', JSON.stringify({ label: 'x', issuedCount: 0, maxIssues: 10, active: true })]])
    const { ctx, K3_KV } = makeCtx('https://allmarks.app/claim?c=secret1', kvStore, privateKeyB64url)
    const res = await onRequestGet(ctx as never)
    const html = await res.text()
    expect(html).not.toMatch(/[\w-]{20,}\.[\w-]{20,}/)
    expect(K3_KV.put).not.toHaveBeenCalled()
  })

  it('returns an error page when the claim record is inactive', async () => {
    const { privateKeyB64url } = await makeTestKeys()
    const kvStore = new Map<string, string>([['claim:secret1', JSON.stringify({ label: 'x', issuedCount: 0, maxIssue: 10, active: false })]])
    const { ctx } = makeCtx('https://allmarks.app/claim?c=secret1', kvStore, privateKeyB64url)
    const res = await onRequestGet(ctx as never)
    const html = await res.text()
    expect(html).not.toMatch(/[\w-]{20,}\.[\w-]{20,}/)
  })

  it('returns an error page when issuedCount has reached maxIssue', async () => {
    const { privateKeyB64url } = await makeTestKeys()
    const kvStore = new Map<string, string>([['claim:secret1', JSON.stringify({ label: 'x', issuedCount: 10, maxIssue: 10, active: true })]])
    const { ctx } = makeCtx('https://allmarks.app/claim?c=secret1', kvStore, privateKeyB64url)
    const res = await onRequestGet(ctx as never)
    const html = await res.text()
    expect(html).not.toMatch(/[\w-]{20,}\.[\w-]{20,}/)
  })

  it('returns an error page when the c param is missing', async () => {
    const { privateKeyB64url } = await makeTestKeys()
    const { ctx } = makeCtx('https://allmarks.app/claim', new Map(), privateKeyB64url)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).not.toMatch(/[\w-]{20,}\.[\w-]{20,}/)
  })
})
