// lib/share/encode-v2.test.ts
import { describe, it, expect } from 'vitest'
import { encodeKVPayload } from './encode-v2'
import { SHARE_SCHEMA_VERSION_V2, type KVShareEntry } from './types-v2'

const sample: KVShareEntry = {
  share: {
    v: SHARE_SCHEMA_VERSION_V2,
    cards: [{ u: 'https://a.com', t: 'T', ty: 'website', cw: 200, a: 1.5 }],
    createdAt: 1735000000000,
  },
  thumb: 'data:image/webp;base64,AAAA',
}

describe('encodeKVPayload', () => {
  it('returns a non-empty string', async () => {
    const out = await encodeKVPayload(sample)
    expect(out.length).toBeGreaterThan(0)
  })

  it('compresses 100 cards to under MAX_KV_ENTRY_BYTES', async () => {
    const cards = Array.from({ length: 100 }, (_, i) => ({
      u: `https://example.com/path/${i}`,
      t: `Title ${i} — sample content`,
      ty: 'website' as const,
      cw: 200,
      a: 1.5,
    }))
    const out = await encodeKVPayload({
      share: { v: SHARE_SCHEMA_VERSION_V2, cards, createdAt: Date.now() },
      thumb: 'A'.repeat(8 * 1024),
    })
    expect(out.length).toBeLessThan(200 * 1024)
  })
})
