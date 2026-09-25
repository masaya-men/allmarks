import { describe, it, expect } from 'vitest'
import {
  SHARD_COUNT_DEFAULT, RESHARD_AVG_ROWS, fnv1a32, shardIndexFor, shardFileName, singleFileName,
  parseV2FileName, v1KeyForName, planShardCount, inferShardCount, parseManifest, sameMigratedFromV1,
} from './sync-layout'

describe('sync format v2 constants', () => {
  it('SHARD_COUNT_DEFAULT is 16 and RESHARD_AVG_ROWS is 200', () => {
    expect(SHARD_COUNT_DEFAULT).toBe(16)
    expect(RESHARD_AVG_ROWS).toBe(200)
  })
})

describe('fnv1a32', () => {
  it('matches the published FNV-1a 32-bit test vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5)
    expect(fnv1a32('a')).toBe(0xe40c292c)
    expect(fnv1a32('foobar')).toBe(0xbf9cf968)
  })

  it('hashes the UTF-8 bytes (multibyte ids are stable and unsigned)', () => {
    const h = fnv1a32('ブクマ-1')
    expect(h).toBe(fnv1a32('ブクマ-1'))
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(2 ** 32)
  })
})

describe('shard assignment', () => {
  const ids = Array.from({ length: 500 }, (_, i) => `bm-${i}-${(i * 7919).toString(36)}`)

  it('is stable: the same id always lands in the same shard', () => {
    for (const id of ids) expect(shardIndexFor(id, 16)).toBe(shardIndexFor(id, 16))
  })

  it('stays within 0..S-1 and spreads rows over every shard', () => {
    const used = new Set(ids.map((id) => shardIndexFor(id, 16)))
    for (const k of used) {
      expect(k).toBeGreaterThanOrEqual(0)
      expect(k).toBeLessThan(16)
    }
    expect(used.size).toBe(16)
  })

  it('adding a row never moves any existing row (touches exactly one shard)', () => {
    const before = new Map(ids.map((id) => [id, shardIndexFor(id, 16)]))
    const added = 'brand-new-bookmark'
    const after = new Map([...ids, added].map((id) => [id, shardIndexFor(id, 16)]))
    for (const id of ids) expect(after.get(id)).toBe(before.get(id))
  })

  it('doubling S keeps each row in shard k or k+S (old shard names are reused)', () => {
    for (const id of ids) {
      const k16 = shardIndexFor(id, 16)
      const k32 = shardIndexFor(id, 32)
      expect([k16, k16 + 16]).toContain(k32)
    }
  })
})

describe('file names', () => {
  it('builds gzip names (sync format v2 never writes plain JSON files)', () => {
    expect(shardFileName('bookmarks', 3)).toBe('bookmarks-3.json.gz')
    expect(shardFileName('cards', 0)).toBe('cards-0.json.gz')
    expect(singleFileName('tags')).toBe('tags.json.gz')
    expect(singleFileName('boardConfig')).toBe('board-config.json.gz')
    expect(singleFileName('vault')).toBe('vault.json.gz')
  })

  it('parses v2 names back and ignores everything else (v1 names and plain JSON included)', () => {
    expect(parseV2FileName('bookmarks-12.json.gz')).toEqual({ kind: 'bookmarks', shard: 12 })
    expect(parseV2FileName('board-config.json.gz')).toEqual({ kind: 'boardConfig' })
    expect(parseV2FileName('cards-3.json')).toBeNull()
    expect(parseV2FileName('vault.json')).toBeNull()
    expect(parseV2FileName('tags.json')).toBeNull()
    expect(parseV2FileName('bookmarks.json')).toBeNull()
    expect(parseV2FileName('manifest.json')).toBeNull()
    expect(parseV2FileName('notes.txt')).toBeNull()
  })

  it('recognises the v1 names', () => {
    expect(v1KeyForName('bookmarks.json')).toBe('bookmarks')
    expect(v1KeyForName('board-config.json')).toBe('boardConfig')
    expect(v1KeyForName('bookmarks-1.json.gz')).toBeNull()
  })
})

describe('planShardCount (reshard)', () => {
  it('keeps S while the average stays at or under RESHARD_AVG_ROWS', () => {
    expect(planShardCount(16, 16 * 200)).toBe(16)
    expect(planShardCount(16, 0)).toBe(16)
  })

  it('doubles S once the average exceeds RESHARD_AVG_ROWS (as often as needed)', () => {
    expect(planShardCount(16, 16 * 200 + 1)).toBe(32)
    expect(planShardCount(16, 64 * 200 + 1)).toBe(128)
  })

  it('falls back to the default for an invalid current value', () => {
    expect(planShardCount(0, 10)).toBe(16)
  })
})

describe('inferShardCount', () => {
  it('defaults to 16 without shard files and rounds up to 16·2^n otherwise', () => {
    expect(inferShardCount(['manifest.json', 'bookmarks.json'])).toBe(16)
    expect(inferShardCount(['bookmarks-15.json.gz'])).toBe(16)
    expect(inferShardCount(['cards-16.json.gz'])).toBe(32)
    expect(inferShardCount(['bookmarks-40.json.gz'])).toBe(64)
  })
})

describe('parseManifest', () => {
  it('reads a v2 manifest', () => {
    expect(parseManifest({ formatVersion: 2, shardCount: 32, updatedAt: 5, migratedFromV1: { bookmarks: 'r1', junk: 3 } }))
      .toEqual({ formatVersion: 2, shardCount: 32, updatedAt: 5, migratedFromV1: { bookmarks: 'r1' } })
  })

  it('reads a v1 manifest as formatVersion 1', () => {
    expect(parseManifest({ formatVersion: 1, appDbVersion: 20, counts: {} })?.formatVersion).toBe(1)
  })

  it('returns null for garbage', () => {
    expect(parseManifest(null)).toBeNull()
    expect(parseManifest([])).toBeNull()
    expect(parseManifest({ formatVersion: 'two' })).toBeNull()
  })

  it('sameMigratedFromV1 ignores key order and treats missing as undefined', () => {
    expect(sameMigratedFromV1({ bookmarks: 'a', tags: 'b' }, { tags: 'b', bookmarks: 'a' })).toBe(true)
    expect(sameMigratedFromV1(undefined, {})).toBe(true)
    expect(sameMigratedFromV1({ bookmarks: 'a' }, { bookmarks: 'b' })).toBe(false)
  })
})
