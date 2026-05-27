// lib/share/decode-v2.test.ts
import { describe, it, expect } from 'vitest'
import { encodeKVPayload } from './encode-v2'
import { decodeKVPayload } from './decode-v2'
import { SHARE_SCHEMA_VERSION_V2, type KVShareEntry } from './types-v2'

const sample: KVShareEntry = {
  share: {
    v: SHARE_SCHEMA_VERSION_V2,
    cards: [{ u: 'https://a.com', t: 'T', ty: 'website', cw: 200, a: 1.5 }],
    createdAt: 1735000000000,
  },
  thumb: 'data:image/webp;base64,AAAA',
}

describe('decodeKVPayload', () => {
  it('roundtrips an encoded payload', async () => {
    const encoded = await encodeKVPayload(sample)
    const result = await decodeKVPayload(encoded)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.share.cards[0].u).toBe('https://a.com')
      expect(result.data.thumb).toBe('data:image/webp;base64,AAAA')
    }
  })

  it('rejects malformed base64', async () => {
    const result = await decodeKVPayload('!!!not_base64!!!')
    expect(result.ok).toBe(false)
  })

  it('rejects malformed gzip', async () => {
    const result = await decodeKVPayload(btoa('not_gzip_data'))
    expect(result.ok).toBe(false)
  })
})
