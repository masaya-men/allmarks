import { describe, it, expect } from 'vitest'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'
import { mergeBookmarks } from './merge'

/** 最小限のフィールドで BookmarkRecord を作る（未使用フィールドは既定で埋める）。 */
function bm(over: Partial<BookmarkRecord> & Pick<BookmarkRecord, 'id'>): BookmarkRecord {
  const base: BookmarkRecord = {
    id: over.id,
    url: `https://example.com/${over.id}`,
    title: `title-${over.id}`,
    description: '',
    thumbnail: '',
    favicon: '',
    siteName: '',
    type: 'website',
    savedAt: '2026-01-01T00:00:00.000Z',
    ogpStatus: 'fetched',
    tags: [],
  }
  return { ...base, ...over }
}

describe('mergeBookmarks — union by id', () => {
  it('keeps an id that exists only locally', () => {
    const out = mergeBookmarks([bm({ id: 'a' })], [])
    expect(out.map((b) => b.id)).toEqual(['a'])
  })

  it('keeps an id that exists only remotely', () => {
    const out = mergeBookmarks([], [bm({ id: 'b' })])
    expect(out.map((b) => b.id)).toEqual(['b'])
  })

  it('3 local + 2 different remote = 5 (additions never disappear)', () => {
    const local = [bm({ id: 'a' }), bm({ id: 'b' }), bm({ id: 'c' })]
    const remote = [bm({ id: 'd' }), bm({ id: 'e' })]
    expect(mergeBookmarks(local, remote).map((b) => b.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('returns bookmarks sorted by id', () => {
    const out = mergeBookmarks([bm({ id: 'z' }), bm({ id: 'm' })], [bm({ id: 'a' })])
    expect(out.map((b) => b.id)).toEqual(['a', 'm', 'z'])
  })
})

describe('mergeBookmarks — scalar conflict (LWW by updatedAt)', () => {
  it('takes the newer record when the same id was edited on both sides', () => {
    const local = [bm({ id: 'a', title: 'old', updatedAt: 100 })]
    const remote = [bm({ id: 'a', title: 'new', updatedAt: 200 })]
    expect(mergeBookmarks(local, remote)[0].title).toBe('new')
    // order-independent
    expect(mergeBookmarks(remote, local)[0].title).toBe('new')
  })

  it('treats a missing updatedAt as 0 (stamped record wins)', () => {
    const local = [bm({ id: 'a', title: 'stamped', updatedAt: 1 })]
    const remote = [bm({ id: 'a', title: 'unstamped' })] // no updatedAt
    expect(mergeBookmarks(local, remote)[0].title).toBe('stamped')
    expect(mergeBookmarks(remote, local)[0].title).toBe('stamped')
  })

  it('treats a non-numeric updatedAt as 0', () => {
    const local = [bm({ id: 'a', title: 'good', updatedAt: 5 })]
    const remote = [bm({ id: 'a', title: 'bad', updatedAt: NaN as unknown as number })]
    expect(mergeBookmarks(local, remote)[0].title).toBe('good')
  })

  it('equal updatedAt -> deterministic winner regardless of arg order', () => {
    const l = [bm({ id: 'a', title: 'L', updatedAt: 50 })]
    const r = [bm({ id: 'a', title: 'R', updatedAt: 50 })]
    const ab = mergeBookmarks(l, r)[0].title
    const ba = mergeBookmarks(r, l)[0].title
    expect(ab).toBe(ba)
  })
})

describe('mergeBookmarks — tags union (both live)', () => {
  it('unions the tag arrays of both sides onto the LWW winner', () => {
    const local = [bm({ id: 'a', tags: ['x'], updatedAt: 200 })]
    const remote = [bm({ id: 'a', tags: ['y'], updatedAt: 100 })]
    expect(mergeBookmarks(local, remote)[0].tags.sort()).toEqual(['x', 'y'])
  })

  it('dedupes tags', () => {
    const local = [bm({ id: 'a', tags: ['x', 'y'], updatedAt: 2 })]
    const remote = [bm({ id: 'a', tags: ['y', 'z'], updatedAt: 1 })]
    expect(mergeBookmarks(local, remote)[0].tags).toEqual(['x', 'y', 'z'])
  })

  it('winner tags come first, loser extras appended (deterministic)', () => {
    const local = [bm({ id: 'a', tags: ['b', 'a'], updatedAt: 9 })]
    const remote = [bm({ id: 'a', tags: ['c'], updatedAt: 1 })]
    expect(mergeBookmarks(local, remote)[0].tags).toEqual(['b', 'a', 'c'])
  })
})

describe('mergeBookmarks — tombstone vs edit (§6.1)', () => {
  it('tombstone wins when deletedAt >= the other side updatedAt (boundary: equal)', () => {
    const tomb = [bm({ id: 'a', isDeleted: true, deletedAt: '2026-05-01T00:00:00.000Z', updatedAt: Date.parse('2026-05-01T00:00:00.000Z') })]
    const edit = [bm({ id: 'a', title: 'edited', updatedAt: Date.parse('2026-05-01T00:00:00.000Z') })]
    const out = mergeBookmarks(edit, tomb)[0]
    expect(out.isDeleted).toBe(true)
  })

  it('edit wins when it is strictly newer than the tombstone', () => {
    const tomb = [bm({ id: 'a', isDeleted: true, deletedAt: '2026-05-01T00:00:00.000Z' })]
    const edit = [bm({ id: 'a', title: 'edited', updatedAt: Date.parse('2026-06-01T00:00:00.000Z') })]
    const out = mergeBookmarks(tomb, edit)[0]
    expect(out.isDeleted).not.toBe(true)
    expect(out.title).toBe('edited')
  })

  it('restore (isDeleted:false, updatedAt bumped to now) beats an older tombstone', () => {
    const tomb = [bm({ id: 'a', isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z' })]
    const restored = [bm({ id: 'a', isDeleted: false, updatedAt: Date.parse('2026-09-01T00:00:00.000Z') })]
    const out = mergeBookmarks(tomb, restored)[0]
    expect(out.isDeleted).toBe(false)
  })

  it('both tombstones -> keeps the later deletedAt', () => {
    const early = [bm({ id: 'a', isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z' })]
    const late = [bm({ id: 'a', isDeleted: true, deletedAt: '2026-02-01T00:00:00.000Z' })]
    const out = mergeBookmarks(early, late)[0]
    expect(out.isDeleted).toBe(true)
    expect(out.deletedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(mergeBookmarks(late, early)[0].deletedAt).toBe('2026-02-01T00:00:00.000Z')
  })

  it('does NOT union tags when one side is a tombstone', () => {
    const tomb = [bm({ id: 'a', tags: ['gone'], isDeleted: true, deletedAt: '2026-09-01T00:00:00.000Z' })]
    const live = [bm({ id: 'a', tags: ['here'], updatedAt: 1 })]
    const out = mergeBookmarks(live, tomb)[0]
    expect(out.isDeleted).toBe(true)
    expect(out.tags).toEqual(['gone'])
  })
})

describe('mergeBookmarks — Private bookmarks (§9: merge by id, never inspect ciphertext)', () => {
  const payloadA = { ephemeralPublicKey: 'ekA', iv: 'ivA', ciphertext: 'ctA' }
  const payloadB = { ephemeralPublicKey: 'ekB', iv: 'ivB', ciphertext: 'ctB' }

  it('a Private bookmark present only remotely is kept intact', () => {
    const out = mergeBookmarks([], [bm({ id: 'p', title: '', encryptedPayload: payloadA })])
    expect(out[0].encryptedPayload).toEqual(payloadA)
  })

  it('same id, different encryptedPayload -> newer wins, ciphertext untouched', () => {
    const local = [bm({ id: 'p', title: '', encryptedPayload: payloadA, updatedAt: 100 })]
    const remote = [bm({ id: 'p', title: '', encryptedPayload: payloadB, updatedAt: 200 })]
    expect(mergeBookmarks(local, remote)[0].encryptedPayload).toEqual(payloadB)
    expect(mergeBookmarks(remote, local)[0].encryptedPayload).toEqual(payloadB)
  })
})
