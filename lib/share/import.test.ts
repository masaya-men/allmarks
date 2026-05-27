import { describe, it, expect } from 'vitest'
import { findDuplicates, convertSenderTagsForReceiver } from './import'
import type { ShareCardV2, TagDict } from './types-v2'

describe('findDuplicates', () => {
  it('returns the URL set already present in receiver IDB', () => {
    const shared: ShareCardV2[] = [
      { u: 'https://a.com', t: 'A', ty: 'website', cw: 200, a: 1 },
      { u: 'https://b.com', t: 'B', ty: 'website', cw: 200, a: 1 },
      { u: 'https://c.com', t: 'C', ty: 'website', cw: 200, a: 1 },
    ]
    const existingUrls = new Set(['https://b.com'])
    expect(findDuplicates(shared, existingUrls)).toEqual(new Set(['https://b.com']))
  })
})

describe('convertSenderTagsForReceiver', () => {
  it('merges same-name tags to receiver existing IDs', () => {
    const senderDict: TagDict = {
      's1': { n: 'music' },
      's2': { n: 'design' },
    }
    const receiverTags = [
      { id: 'r-music', name: 'music' },
      { id: 'r-other', name: 'other' },
    ]
    const mapping = convertSenderTagsForReceiver(['s1', 's2'], senderDict, receiverTags)
    expect(mapping.existing.get('s1')).toBe('r-music')
    expect(mapping.existing.has('s2')).toBe(false)
    expect(mapping.toCreate.find((t) => t.senderId === 's2')?.name).toBe('design')
  })

  it('keeps receiver existing color (= does not overwrite)', () => {
    const senderDict: TagDict = { 's1': { n: 'music', c: '#FF0000' } }
    const receiverTags = [{ id: 'r-music', name: 'music' }]
    const mapping = convertSenderTagsForReceiver(['s1'], senderDict, receiverTags)
    expect(mapping.existing.get('s1')).toBe('r-music')
    expect(mapping.toCreate.length).toBe(0)
  })
})
