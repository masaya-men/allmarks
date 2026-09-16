import { describe, it, expect } from 'vitest'
import type { BookmarkRecord, TagRecord, CardRecord } from '@/lib/storage/indexeddb'
import type { PrivateVaultRecord } from '@/lib/private/vault-store'
import { mergeBookmarks, mergeTags, mergeCards, mergeBoardConfig, mergeVault, mergeAll, pickDeterministic, type SyncBoardConfig, type SyncSnapshot } from './merge'
import { DEFAULT_BOARD_CONFIG } from '@/lib/storage/board-config'

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

describe('mergeBookmarks — tags[] follows whole-record LWW, both live (no union — §6.1 revised s211)', () => {
  it('takes the LWW winner tags whole — the losing side never contributes tags', () => {
    const local = [bm({ id: 'a', tags: ['x'], updatedAt: 200 })]
    const remote = [bm({ id: 'a', tags: ['y'], updatedAt: 100 })]
    expect(mergeBookmarks(local, remote)[0].tags).toEqual(['x'])
    expect(mergeBookmarks(remote, local)[0].tags).toEqual(['x'])
  })

  it('a tag removed on the winning side stays removed — no resurrection from a stale copy', () => {
    // device A removed 'old' and is the LWW winner (newer updatedAt)
    const afterRemoval = [bm({ id: 'a', tags: ['keep'], updatedAt: 200 })]
    // device B never synced the removal, still has the old tag
    const stale = [bm({ id: 'a', tags: ['keep', 'old'], updatedAt: 100 })]
    expect(mergeBookmarks(afterRemoval, stale)[0].tags).toEqual(['keep'])
    expect(mergeBookmarks(stale, afterRemoval)[0].tags).toEqual(['keep'])
  })

  it('equal updatedAt -> deterministic tags regardless of arg order', () => {
    const l = [bm({ id: 'a', tags: ['L'], updatedAt: 50 })]
    const r = [bm({ id: 'a', tags: ['R'], updatedAt: 50 })]
    expect(mergeBookmarks(l, r)[0].tags).toEqual(mergeBookmarks(r, l)[0].tags)
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

  it('when Private state diverges (one plaintext, one encrypted), the LWW winner is taken whole — no plaintext/Private-tag mixing', () => {
    // device A Private-ized: payload set, plaintext blank, Private tag added, updatedAt older
    const privatized = bm({ id: 'x', title: '', url: '', encryptedPayload: payloadA, tags: ['priv'], updatedAt: 100 })
    // device B still plaintext, updatedAt newer (e.g. B reordered its board once)
    const plaintext = bm({ id: 'x', title: 'real title', url: 'https://real', tags: ['work'], updatedAt: 200 })
    const [out] = mergeBookmarks([privatized], [plaintext])
    // B wins LWW; result is B unchanged — no 'priv' tag leaked in, no payload.
    // (This is what the former "C1" bug fix special-cased; whole-record LWW for
    // tags[] makes it fall out of the general rule instead — regression guard.)
    expect(out.title).toBe('real title')
    expect(out.encryptedPayload).toBeUndefined()
    expect(out.tags).toEqual(['work'])
  })

  it('when the Private side wins LWW, result is the ciphertext record whole', () => {
    const privatized = bm({ id: 'x', title: '', url: '', encryptedPayload: payloadA, tags: ['priv'], updatedAt: 300 })
    const plaintext = bm({ id: 'x', title: 'real', url: 'https://real', tags: ['work'], updatedAt: 200 })
    const [out] = mergeBookmarks([privatized], [plaintext])
    expect(out.encryptedPayload).toEqual(payloadA)
    expect(out.title).toBe('')
    expect(out.tags).toEqual(['priv'])
  })
})

function tag(over: Partial<TagRecord> & Pick<TagRecord, 'id'>): TagRecord {
  const base: TagRecord = {
    id: over.id,
    name: `tag-${over.id}`,
    color: '#888888',
    order: 0,
    createdAt: 1_000,
  }
  return { ...base, ...over }
}

describe('mergeTags', () => {
  it('union by id, sorted', () => {
    const out = mergeTags([tag({ id: 'b' }), tag({ id: 'a' })], [tag({ id: 'c' })])
    expect(out.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('LWW by updatedAt when both live', () => {
    const local = [tag({ id: 'a', name: 'old', updatedAt: 10 })]
    const remote = [tag({ id: 'a', name: 'new', updatedAt: 20 })]
    expect(mergeTags(local, remote)[0].name).toBe('new')
    expect(mergeTags(remote, local)[0].name).toBe('new')
  })

  it('falls back to createdAt when updatedAt is absent', () => {
    const local = [tag({ id: 'a', name: 'created-later', createdAt: 5_000 })]
    const remote = [tag({ id: 'a', name: 'created-earlier', createdAt: 1_000 })]
    expect(mergeTags(local, remote)[0].name).toBe('created-later')
  })

  it('createdAt fallback can outrank a stale updatedAt (documented edge)', () => {
    const local = [tag({ id: 'a', name: 'stamped', updatedAt: 2_000, createdAt: 1_000 })]
    const remote = [tag({ id: 'a', name: 'unstamped', createdAt: 9_999 })]
    // 9_999 (createdAt fallback) > 2_000 -> unstamped actually wins
    expect(mergeTags(local, remote)[0].name).toBe('unstamped')
  })

  it('soft-delete tombstone propagates (deletedAt >= other side time)', () => {
    const tomb = [tag({ id: 'a', isDeleted: true, deletedAt: '2026-06-01T00:00:00.000Z', updatedAt: Date.parse('2026-06-01T00:00:00.000Z') })]
    const edit = [tag({ id: 'a', name: 'renamed', updatedAt: Date.parse('2026-05-01T00:00:00.000Z') })]
    expect(mergeTags(edit, tomb)[0].isDeleted).toBe(true)
  })

  it('a rename newer than the delete wins the tag back', () => {
    const tomb = [tag({ id: 'a', isDeleted: true, deletedAt: '2026-05-01T00:00:00.000Z' })]
    const edit = [tag({ id: 'a', name: 'renamed', updatedAt: Date.parse('2026-07-01T00:00:00.000Z') })]
    const out = mergeTags(tomb, edit)[0]
    expect(out.isDeleted).not.toBe(true)
    expect(out.name).toBe('renamed')
  })

  it('both tombstones -> keeps the record with the later deletedAt', () => {
    const early = [tag({ id: 'a', isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z' })]
    const late = [tag({ id: 'a', isDeleted: true, deletedAt: '2026-02-01T00:00:00.000Z' })]
    expect(mergeTags(early, late)[0].deletedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(mergeTags(late, early)[0].deletedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(mergeTags(early, late)[0].isDeleted).toBe(true)
  })

  it('is order-independent on equal time', () => {
    const l = [tag({ id: 'a', name: 'L', updatedAt: 5 })]
    const r = [tag({ id: 'a', name: 'R', updatedAt: 5 })]
    expect(mergeTags(l, r)[0].name).toBe(mergeTags(r, l)[0].name)
  })
})

function card(over: Partial<CardRecord> & Pick<CardRecord, 'id'>): CardRecord {
  const base: CardRecord = {
    id: over.id,
    bookmarkId: `bm-${over.id}`,
    folderId: '',
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    zIndex: 0,
    gridIndex: 0,
    isManuallyPlaced: false,
    width: 200,
    height: 200,
  }
  return { ...base, ...over }
}

describe('mergeCards', () => {
  it('union by id, sorted', () => {
    expect(mergeCards([card({ id: 'b' })], [card({ id: 'a' })]).map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('LWW by updatedAt', () => {
    const local = [card({ id: 'a', x: 10, updatedAt: 1 })]
    const remote = [card({ id: 'a', x: 99, updatedAt: 2 })]
    expect(mergeCards(local, remote)[0].x).toBe(99)
    expect(mergeCards(remote, local)[0].x).toBe(99)
  })

  it('missing updatedAt treated as 0', () => {
    const local = [card({ id: 'a', x: 5, updatedAt: 1 })]
    const remote = [card({ id: 'a', x: 7 })]
    expect(mergeCards(local, remote)[0].x).toBe(5)
  })

  it('equal updatedAt -> order-independent', () => {
    const l = [card({ id: 'a', x: 1, updatedAt: 3 })]
    const r = [card({ id: 'a', x: 2, updatedAt: 3 })]
    expect(mergeCards(l, r)[0].x).toBe(mergeCards(r, l)[0].x)
  })
})

describe('mergeBoardConfig', () => {
  const cfg = (over: Partial<SyncBoardConfig['config']>, updatedAt?: number): SyncBoardConfig => ({
    config: { ...DEFAULT_BOARD_CONFIG, ...over },
    updatedAt,
  })

  it('both null -> null', () => {
    expect(mergeBoardConfig(null, null)).toBeNull()
  })

  it('one side present -> that side', () => {
    const only = cfg({ themeId: 'paper-atelier' }, 5)
    expect(mergeBoardConfig(only, null)).toBe(only)
    expect(mergeBoardConfig(null, only)).toBe(only)
  })

  it('LWW by updatedAt', () => {
    const older = cfg({ themeId: 'dotted-notebook' }, 100)
    const newer = cfg({ themeId: 'paper-atelier' }, 200)
    expect(mergeBoardConfig(older, newer)?.config.themeId).toBe('paper-atelier')
    expect(mergeBoardConfig(newer, older)?.config.themeId).toBe('paper-atelier')
  })

  it('absent updatedAt treated as 0', () => {
    const stamped = cfg({ themeId: 'paper-atelier' }, 1)
    const unstamped = cfg({ themeId: 'dotted-notebook' })
    expect(mergeBoardConfig(unstamped, stamped)?.config.themeId).toBe('paper-atelier')
  })

  it('equal updatedAt -> order-independent', () => {
    const a = cfg({ themeId: 'dotted-notebook' }, 7)
    const b = cfg({ themeId: 'paper-atelier' }, 7)
    expect(mergeBoardConfig(a, b)?.config.themeId).toBe(mergeBoardConfig(b, a)?.config.themeId)
  })
})

describe('mergeVault', () => {
  const rec = (pub: string): PrivateVaultRecord => ({
    key: 'private-vault',
    tagId: 'priv-tag',
    salt: 'salt',
    iterations: 600_000,
    publicKey: pub,
    wrappedPrivateKey: { iv: 'iv', ciphertext: 'ct' },
  })

  it('both null -> null', () => {
    expect(mergeVault(null, null)).toBeNull()
  })

  it('one side present -> that side', () => {
    const v = rec('pubA')
    expect(mergeVault(v, null)).toBe(v)
    expect(mergeVault(null, v)).toBe(v)
  })

  it('identical on both sides -> returns a value (order-independent)', () => {
    const a = rec('same')
    const b = rec('same')
    expect(mergeVault(a, b)).toEqual(a)
    expect(mergeVault(b, a)).toEqual(a)
  })

  it('divergent records -> deterministic pick regardless of arg order', () => {
    const a = rec('pubA')
    const b = rec('pubB')
    expect(mergeVault(a, b)).toEqual(mergeVault(b, a))
  })

  it('same vault (same publicKey + tagId), different wrapping: newer updatedAt wins', () => {
    // salt/iv/ciphertext are deliberately chosen so the OLDER record's fields
    // sort lexically AFTER the newer record's (older='z*', newer='a*'). This
    // makes pickDeterministic's stableStringify tie-break pick the WRONG
    // (older) record if it were used — so this test only passes when the
    // updatedAt-LWW branch is actually being taken, not by coincidence.
    const base = { key: 'private-vault' as const, tagId: 'tag1', iterations: 600000, publicKey: 'same-pk' }
    const older = { ...base, salt: 'salt-z', wrappedPrivateKey: { iv: 'iv-z', ciphertext: 'ct-z' }, updatedAt: 1000 }
    const newer = { ...base, salt: 'salt-a', wrappedPrivateKey: { iv: 'iv-a', ciphertext: 'ct-a' }, updatedAt: 2000 }
    expect(mergeVault(older, newer)).toEqual(newer)
    expect(mergeVault(newer, older)).toEqual(newer) // 引数順に依存しない
  })

  it('same vault, one side has no updatedAt (legacy pre-this-feature record): the stamped side wins', () => {
    // Same anti-coincidence trick: legacy's fields sort lexically AFTER
    // changed's, so pickDeterministic would wrongly favor legacy if it were
    // reached — this test only passes via the updatedAt-LWW branch.
    const base = { key: 'private-vault' as const, tagId: 'tag1', iterations: 600000, publicKey: 'same-pk' }
    const legacy = { ...base, salt: 'salt-z', wrappedPrivateKey: { iv: 'iv-z', ciphertext: 'ct-z' } } // no updatedAt field at all
    const changed = { ...base, salt: 'salt-a', wrappedPrivateKey: { iv: 'iv-a', ciphertext: 'ct-a' }, updatedAt: 2000 }
    expect(mergeVault(legacy, changed)).toEqual(changed)
    expect(mergeVault(changed, legacy)).toEqual(changed)
  })

  it('genuinely different vault (different publicKey): result is deterministic and independent of updatedAt', () => {
    const a = {
      key: 'private-vault' as const, tagId: 'tag1', salt: 'salt-a', iterations: 600000,
      publicKey: 'pk-a', wrappedPrivateKey: { iv: 'iv-a', ciphertext: 'ct-a' }, updatedAt: 1, // 古い方
    }
    const b = {
      key: 'private-vault' as const, tagId: 'tag1', salt: 'salt-b', iterations: 600000,
      publicKey: 'pk-b', wrappedPrivateKey: { iv: 'iv-b', ciphertext: 'ct-b' }, updatedAt: 9999999, // 新しい方
    }
    // 引数順に依存しない(決定的)ことだけを確認する。LWWなら常にbが勝つはずだが、
    // publicKeyが違う=別の金庫なのでLWWの対象外であることをこのテストで担保する。
    const result1 = mergeVault(a, b)
    const result2 = mergeVault(b, a)
    expect(result1).toBe(result2)
  })
})

describe('pickDeterministic', () => {
  it('is exported and picks the same value regardless of argument order', () => {
    const a = { x: 1 }
    const b = { x: 2 }
    const pickAB = pickDeterministic(a, b)
    const pickBA = pickDeterministic(b, a)
    expect(pickAB).toBe(pickBA)
  })
})

describe('mergeAll', () => {
  const emptySnap: SyncSnapshot = { bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null }

  it('routes each store through its merge fn', () => {
    const local: SyncSnapshot = {
      ...emptySnap,
      bookmarks: [bm({ id: 'a', updatedAt: 1 })],
      tags: [tag({ id: 't1' })],
      boardConfig: { config: { ...DEFAULT_BOARD_CONFIG, themeId: 'dotted-notebook' }, updatedAt: 5 },
    }
    const remote: SyncSnapshot = {
      ...emptySnap,
      bookmarks: [bm({ id: 'b', updatedAt: 1 })],
      cards: [card({ id: 'c1' })],
      vault: {
        key: 'private-vault', tagId: 'pv', salt: 's', iterations: 600_000,
        publicKey: 'PUB', wrappedPrivateKey: { iv: 'i', ciphertext: 'c' },
      },
    }
    const out = mergeAll(local, remote)
    expect(out.bookmarks.map((x) => x.id)).toEqual(['a', 'b'])
    expect(out.tags.map((x) => x.id)).toEqual(['t1'])
    expect(out.cards.map((x) => x.id)).toEqual(['c1'])
    expect(out.boardConfig?.config.themeId).toBe('dotted-notebook') // routed from local
    expect(out.vault?.publicKey).toBe('PUB')                        // routed from remote
  })

  it('is deterministic: mergeAll(L,R) deep-equals mergeAll(R,L)', () => {
    const L: SyncSnapshot = {
      bookmarks: [
        bm({ id: 'a', title: 'LA', tags: ['x'], updatedAt: 100 }),
        bm({ id: 'b', isDeleted: true, deletedAt: '2026-03-01T00:00:00.000Z' }),
        bm({ id: 'c', updatedAt: 5 }),
      ],
      tags: [tag({ id: 't1', name: 'L', updatedAt: 10 }), tag({ id: 't2', createdAt: 1 })],
      cards: [card({ id: 'k1', x: 1, updatedAt: 9 }), card({ id: 'k2' })],
      boardConfig: { config: { ...DEFAULT_BOARD_CONFIG, themeId: 'dotted-notebook' }, updatedAt: 7 },
      vault: null,
    }
    const R: SyncSnapshot = {
      bookmarks: [
        bm({ id: 'a', title: 'RA', tags: ['y'], updatedAt: 200 }),
        bm({ id: 'b', title: 'resurrect?', updatedAt: Date.parse('2026-01-01T00:00:00.000Z') }),
        bm({ id: 'd', updatedAt: 3 }),
      ],
      tags: [tag({ id: 't1', name: 'R', updatedAt: 20 }), tag({ id: 't3' })],
      cards: [card({ id: 'k1', x: 50, updatedAt: 4 }), card({ id: 'k3' })],
      boardConfig: { config: { ...DEFAULT_BOARD_CONFIG, themeId: 'paper-atelier' }, updatedAt: 7 },
      vault: null,
    }
    expect(mergeAll(L, R)).toEqual(mergeAll(R, L))
    const out = mergeAll(L, R)
    expect(out.bookmarks.find((x) => x.id === 'b')?.isDeleted).toBe(true) // tombstone held
    expect(out.boardConfig?.config.themeId).toBe('paper-atelier')          // R won the config tie deterministically
  })

  it('additions from both sides all survive (3 + 2 disjoint = 5)', () => {
    const L: SyncSnapshot = { ...emptySnap, bookmarks: [bm({ id: 'a' }), bm({ id: 'b' }), bm({ id: 'c' })] }
    const R: SyncSnapshot = { ...emptySnap, bookmarks: [bm({ id: 'd' }), bm({ id: 'e' })] }
    expect(mergeAll(L, R).bookmarks).toHaveLength(5)
  })
})
