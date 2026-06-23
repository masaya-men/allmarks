import { describe, it, expect, vi } from 'vitest'
import { onRequestGet } from './[id]'
import { encodeKVPayload } from '../../../lib/share/encode-v2'
import { SHARE_SCHEMA_VERSION_V2, type KVShareEntry } from '../../../lib/share/types-v2'

const validEntry: KVShareEntry = {
  share: {
    v: SHARE_SCHEMA_VERSION_V2,
    cards: [{ u: 'https://example.com/a', t: 'a', ty: 'website', cw: 240, a: 1.6 }],
    createdAt: 1_780_000_000_000,
  },
}

function makeCtx(id: string, kv: Map<string, string>) {
  return {
    request: new Request(`https://test.local/api/share/${id}`, { method: 'GET' }),
    env: {
      SHARE_KV: {
        get: vi.fn(async (k: string) => kv.get(k) ?? null),
      },
    },
    params: { id },
  }
}

describe('GET /api/share/[id]', () => {
  it('returns 200 + decoded share for a valid, decodable entry', async () => {
    const id = 'k3p9xv'
    const kv = new Map<string, string>([[id, await encodeKVPayload(validEntry)]])
    const res = await onRequestGet(makeCtx(id, kv) as never)
    expect(res.status).toBe(200)
    const out = await res.json() as KVShareEntry
    expect(out.share.cards.length).toBe(1)
  })

  it('returns 404 (not_found) for a malformed share id — matches the HTML handler (rank25)', async () => {
    const res = await onRequestGet(makeCtx('not a valid id!!', new Map()) as never)
    expect(res.status).toBe(404)
    const out = await res.json() as { error: string }
    expect(out.error).toBe('not_found')
  })

  it('returns 404 (not_found) when the entry is missing / expired', async () => {
    const res = await onRequestGet(makeCtx('k3p9xv', new Map()) as never)
    expect(res.status).toBe(404)
    const out = await res.json() as { error: string }
    expect(out.error).toBe('not_found')
  })

  it('returns 404 (not_found) — NOT 500 — when the entry will not decode (rank25)', async () => {
    // A corrupt KV value (not valid base64-gzip) must look "gone" to match the
    // HTML handler, so the receiver UX is consistent (never a scary 500).
    const id = 'k3p9xv'
    const kv = new Map<string, string>([[id, '@@@not-base64-gzip@@@']])
    const res = await onRequestGet(makeCtx(id, kv) as never)
    expect(res.status).toBe(404)
    const out = await res.json() as { error: string }
    expect(out.error).toBe('not_found')
  })
})
