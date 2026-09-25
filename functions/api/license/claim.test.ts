// functions/api/license/claim.test.ts
import { describe, it, expect, vi } from 'vitest'
import { onRequestPost } from './claim'

async function makeTestKeys() {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey))
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
  const toB64url = (b: Uint8Array) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return { publicKeyB64url: toB64url(raw), privateKeyB64url: toB64url(pkcs8) }
}

function toBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  return new Uint8Array(Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64'))
}

function makeCtx(body: unknown, kvStore: Map<string, string>, env: Record<string, string>) {
  const json = JSON.stringify(body)
  const K3_KV = {
    get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => { kvStore.set(k, v) }),
  }
  const ctx = {
    request: new Request('https://allmarks.app/api/license/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': String(json.length) },
      body: json,
    }),
    env: { K3_KV, ...env },
  }
  return { ctx, K3_KV, kvStore }
}

describe('POST /api/license/claim', () => {
  it('mints a key, writes issued: and bumps claim: issuedCount, returns ok:true with a validly-signed key', async () => {
    const { publicKeyB64url, privateKeyB64url } = await makeTestKeys()
    const kvStore = new Map<string, string>()
    kvStore.set('claim:secret1', JSON.stringify({ label: 'launch', issuedCount: 0, maxIssue: 10, active: true }))
    const { ctx, K3_KV, kvStore: store } = makeCtx({ c: 'secret1' }, kvStore, { K3_PRIVATE_KEY: privateKeyB64url })

    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    const json = await res.json() as { ok: boolean; key: string; kid: string }
    expect(json.ok).toBe(true)

    const [payloadB64url, sigB64url] = json.key.split('.')
    const pub = await crypto.subtle.importKey('raw', new Uint8Array(toBytes(publicKeyB64url)), { name: 'Ed25519' }, true, ['verify'])
    const ok = await crypto.subtle.verify('Ed25519', pub, new Uint8Array(toBytes(sigB64url)), new TextEncoder().encode(payloadB64url))
    expect(ok).toBe(true)
    const payload = JSON.parse(new TextDecoder().decode(toBytes(payloadB64url)))
    expect(payload.scope).toEqual(['sync'])
    expect(payload.v).toBe(1)
    expect(payload.kid).toBe(json.kid)

    expect(K3_KV.put).toHaveBeenCalledWith(`issued:${json.kid}`, expect.any(String))
    const updatedClaim = JSON.parse(store.get('claim:secret1')!)
    expect(updatedClaim.issuedCount).toBe(1)
  })

  it('unknown claimSecret: 200 ok:false reason:invalid, no KV writes', async () => {
    const { privateKeyB64url } = await makeTestKeys()
    const { ctx, K3_KV } = makeCtx({ c: 'doesnotexist' }, new Map(), { K3_PRIVATE_KEY: privateKeyB64url })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid' })
    expect(K3_KV.put).not.toHaveBeenCalled()
  })

  it('mistyped/missing KV field (not unlimited issuance): reason:invalid, no writes', async () => {
    // Simulates a manually-seeded KV entry (wrangler kv key put) with a typo'd
    // field name — e.g. "maxIssues" instead of "maxIssue". Without runtime
    // validation, record.issuedCount >= record.maxIssue becomes
    // `0 >= undefined` = false, and the cap never triggers.
    const { privateKeyB64url } = await makeTestKeys()
    const kvStore = new Map<string, string>([['claim:secret1', JSON.stringify({ label: 'x', issuedCount: 0, maxIssues: 10, active: true })]])
    const { ctx, K3_KV } = makeCtx({ c: 'secret1' }, kvStore, { K3_PRIVATE_KEY: privateKeyB64url })
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid' })
    expect(K3_KV.put).not.toHaveBeenCalled()
  })

  it('inactive claim record: reason:invalid', async () => {
    const { privateKeyB64url } = await makeTestKeys()
    const kvStore = new Map<string, string>([['claim:secret1', JSON.stringify({ label: 'x', issuedCount: 0, maxIssue: 10, active: false })]])
    const { ctx } = makeCtx({ c: 'secret1' }, kvStore, { K3_PRIVATE_KEY: privateKeyB64url })
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid' })
  })

  it('exhausted claim record (issuedCount >= maxIssue): reason:invalid', async () => {
    const { privateKeyB64url } = await makeTestKeys()
    const kvStore = new Map<string, string>([['claim:secret1', JSON.stringify({ label: 'x', issuedCount: 10, maxIssue: 10, active: true })]])
    const { ctx } = makeCtx({ c: 'secret1' }, kvStore, { K3_PRIVATE_KEY: privateKeyB64url })
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid' })
  })

  it('not-configured: 503 when K3_PRIVATE_KEY is missing (never reads KV)', async () => {
    const { ctx, K3_KV } = makeCtx({ c: 'secret1' }, new Map(), { K3_PRIVATE_KEY: '' })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, reason: 'not-configured' })
    expect(K3_KV.get).not.toHaveBeenCalled()
  })

  it('invalid: 400 when c is missing from the body', async () => {
    const { ctx } = makeCtx({}, new Map(), { K3_PRIVATE_KEY: 'x' })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid' })
  })

  it('invalid: 400 when c exceeds the max length', async () => {
    const { ctx } = makeCtx({ c: 'a'.repeat(129) }, new Map(), { K3_PRIVATE_KEY: 'x' })
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid' })
  })

  it('invalid: 400 on malformed JSON body', async () => {
    const ctx = {
      request: new Request('https://allmarks.app/api/license/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'content-length': '5' },
        body: 'oops{',
      }),
      env: { K3_KV: { get: vi.fn(), put: vi.fn() }, K3_PRIVATE_KEY: 'x' },
    }
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid' })
  })
})
