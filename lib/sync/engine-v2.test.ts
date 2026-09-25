// Sync format v2 (docs/superpowers/specs/2026-09-25-sync-format-v2-design.md) end-to-end tests:
// the real engine + real gzip (CompressionStream) + real fake-indexeddb, against an in-memory fake
// Google Drive folder with real headRevisionId semantics (fake-drive.testutil.ts).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import type { IDBPDatabase } from 'idb'
import { initDB, type AllMarksDB } from '@/lib/storage/indexeddb'
import { saveBoardConfig } from '@/lib/storage/board-config'
import { createVault, loadVaultRecord } from '@/lib/private/vault-store'
import { saveLicense, type LicenseState } from '@/lib/board/license-store'
import { saveSyncTokens, updateSyncStatus, loadSyncStatus, loadRemoteCache } from './sync-store'
import { createSyncController } from './sync-controller'
import { setSyncMarkDirty } from './sync-signal'
import { purgedBookmarkTombstone } from '@/lib/storage/indexeddb'
import { mergeAll, pickDeterministic, type SyncSnapshot } from './merge'
import { setGzipCodecForTesting, createStreamGzipCodec, looksGzipped, type GzipCodec } from './gzip-codec'
import { shardFileName, shardIndexFor, parseManifest, SHARD_COUNT_DEFAULT, RESHARD_AVG_ROWS } from './sync-layout'
import { FakeDrive, installFakeDrive } from './fake-drive.testutil'

vi.mock('./drive-adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./drive-adapter')>()
  return {
    ...actual,
    findSyncFolder: vi.fn(),
    createSyncFolder: vi.fn(),
    listFolderFiles: vi.fn(),
    downloadFileText: vi.fn(),
    downloadFileBytes: vi.fn(),
    getHeadRevisionId: vi.fn(),
    createTextFile: vi.fn(),
    updateTextFile: vi.fn(),
    createBinaryFile: vi.fn(),
    updateBinaryFile: vi.fn(),
    deleteFile: vi.fn(),
  }
})
import { updateBinaryFile, createBinaryFile, listFolderFiles } from './drive-adapter'
import { runSyncCycle, buildLocalSnapshot, pullRemoteSnapshot, SyncCorruptDataError } from './engine'

type Db = IDBPDatabase<AllMarksDB>

const codec = createStreamGzipCodec() as GzipCodec
let drive: FakeDrive
const openDbs: Db[] = []

beforeEach(() => {
  vi.clearAllMocks()
  setGzipCodecForTesting(undefined) // real CompressionStream codec
  drive = new FakeDrive()
  installFakeDrive(drive)
})
afterEach(() => {
  setGzipCodecForTesting(undefined)
  for (const d of openDbs.splice(0)) d.close()
})

function activeLicenseState(now: number = Date.now()): LicenseState {
  return { kid: 'kid-1', deviceId: 'device-1', scope: ['sync'], validatedAt: now, lastCheckedAt: now, lastConfirmedAt: now }
}

/** One simulated device = its own, fully separate IndexedDB (its own fake-indexeddb factory),
 *  already connected to the shared fake Drive folder and licensed. */
async function newDevice(): Promise<Db> {
  ;(globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory()
  const d = await initDB()
  openDbs.push(d)
  await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 10_000_000, scope: 's', refreshToken: 'rt' })
  await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
  await saveLicense(d, activeLicenseState())
  return d
}

function bookmark(id: string, overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id, url: `https://x.com/${id}`, title: id, description: '', thumbnail: '', favicon: '',
    siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z', ogpStatus: 'fetched',
    tags: [], updatedAt: 1, ...overrides,
  }
}

function card(id: string, bookmarkId: string, overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id, bookmarkId, folderId: 'f', x: 0, y: 0, rotation: 0, scale: 1, zIndex: 0, gridIndex: 0,
    isManuallyPlaced: false, width: 100, height: 100, updatedAt: 1, ...overrides,
  }
}

function tag(id: string, overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return { id, name: id, color: '#fff', order: 0, createdAt: 1, updatedAt: 1, ...overrides }
}

async function addBookmark(d: Db, id: string, overrides: Partial<Record<string, unknown>> = {}): Promise<void> {
  await d.put('bookmarks', bookmark(id, overrides) as never)
}

const bmShard = (id: string, s: number = SHARD_COUNT_DEFAULT): string => shardFileName('bookmarks', shardIndexFor(id, s))

/** Every row currently stored in the v2 bookmark shard files on the fake Drive. */
async function driveBookmarkIds(): Promise<string[]> {
  const ids: string[] = []
  for (const name of drive.names()) {
    if (!/^bookmarks-\d+\.json\.gz$/.test(name)) continue
    const rows = (await drive.json(name)) as Array<{ id: string }>
    for (const r of rows) ids.push(r.id)
  }
  return ids.sort()
}

async function localBookmarkIds(d: Db): Promise<string[]> {
  return (await d.getAll('bookmarks')).map((b) => b.id).sort()
}

function uploadsOf(prefix: string): string[] {
  return [...drive.callsOf('create'), ...drive.callsOf('update')]
    .map((c) => c.name as string)
    .filter((n) => n.startsWith(prefix))
}

function downloads(): string[] {
  return drive.callsOf('download').map((c) => c.name as string).sort()
}

describe('sync format v2 — fresh folder', () => {
  it('writes 16+16 gzip shards, tags.json.gz and a v2 manifest, and every row lands in its fnv1a32 shard', async () => {
    const a = await newDevice()
    for (const id of ['b1', 'b2', 'b3']) await addBookmark(a, id)
    await a.put('cards', card('c1', 'b1') as never)
    await a.put('tags', tag('t1') as never)

    const result = await runSyncCycle(a)
    expect(result.status).toBe('synced')

    const names = drive.names()
    for (let k = 0; k < 16; k++) {
      expect(names).toContain(`bookmarks-${k}.json.gz`)
      expect(names).toContain(`cards-${k}.json.gz`)
    }
    expect(names).toContain('tags.json.gz')
    expect(names).toContain('manifest.json')
    expect(names.filter((n) => ['bookmarks.json', 'cards.json', 'tags.json', 'board-config.json', 'vault.json'].includes(n))).toEqual([])

    // Real gzip bytes, uploaded as application/gzip.
    const shard = drive.byName(bmShard('b1'))!
    expect(looksGzipped(shard.bytes)).toBe(true)
    expect(shard.mime).toBe('application/gzip')
    expect(((await drive.json(bmShard('b1'))) as Array<{ id: string }>).map((r) => r.id)).toContain('b1')
    expect(await driveBookmarkIds()).toEqual(['b1', 'b2', 'b3'])

    const manifest = parseManifest(await drive.json('manifest.json'))
    expect(manifest).toMatchObject({ formatVersion: 2, shardCount: 16 })
    expect(manifest?.migratedFromV1).toBeUndefined()
  })

  it('records a sized gzip upload step and a download step in the cycle trace', async () => {
    const a = await newDevice()
    await addBookmark(a, 'b1')
    await runSyncCycle(a)
    const namesA = (await loadSyncStatus(a)).lastCycleTrace!.steps.map((s) => s.name)
    expect(namesA.some((n) => new RegExp(`^upload ${bmShard('b1').replace(/\./g, '\\.')} \\(\\d+\\.\\dKB\\)$`).test(n))).toBe(true)

    const b = await newDevice()
    await runSyncCycle(b)
    const namesB = (await loadSyncStatus(b)).lastCycleTrace!.steps.map((s) => s.name)
    expect(namesB).toContain(`download ${bmShard('b1')}`)
    expect(namesB).toContain('download manifest.json')
  })
})

describe('sync format v2 — incremental cycles', () => {
  it('an unchanged folder is neither downloaded nor uploaded again (cache hit per headRevisionId)', async () => {
    const a = await newDevice()
    for (const id of ['b1', 'b2']) await addBookmark(a, id)
    await runSyncCycle(a)

    drive.clearCalls()
    const result = await runSyncCycle(a) // manual/dirty cycle: full pull path, but nothing changed
    expect(result.status).toBe('synced')
    expect(downloads()).toEqual([])
    expect(drive.callsOf('create')).toEqual([])
    expect(drive.callsOf('update')).toEqual([])
    expect(drive.callsOf('rev')).toEqual([])
  })

  it('adding one bookmark uploads exactly one bookmarks shard (and nothing else)', async () => {
    const a = await newDevice()
    for (const id of ['b1', 'b2', 'b3']) await addBookmark(a, id)
    await runSyncCycle(a)

    drive.clearCalls()
    await addBookmark(a, 'new-one', { updatedAt: 50 })
    const result = await runSyncCycle(a)
    expect(result.status).toBe('synced')
    expect(uploadsOf('')).toEqual([bmShard('new-one')])
    expect(downloads()).toEqual([])
    expect(await driveBookmarkIds()).toEqual(['b1', 'b2', 'b3', 'new-one'])

    const steps = (await loadSyncStatus(a)).lastCycleTrace!.steps.map((s) => s.name)
    expect(steps.filter((n) => n.startsWith('upload '))).toHaveLength(1)
    expect(steps.some((n) => /^upload bookmarks-\d+\.json\.gz \(\d+\.\dKB\)$/.test(n))).toBe(true)
  })

  it('keeps sync-remote-cache in step with each upload, and never writes v2 names into sync-status.headRevisions', async () => {
    const a = await newDevice()
    await addBookmark(a, 'b1')
    await runSyncCycle(a)
    const cache = await loadRemoteCache(a, 'folder1')
    const status = await loadSyncStatus(a)
    const shard = drive.byName(bmShard('b1'))!
    expect(cache[bmShard('b1')]?.rev).toBe(shard.rev)
    expect(JSON.parse(cache[bmShard('b1')]!.text)).toEqual([bookmark('b1')])
    expect(cache['manifest.json']?.rev).toBe(drive.byName('manifest.json')!.rev)
    // sync-status.headRevisions is device-local settings but SHARED (same IndexedDB) with a stale
    // v1 tab in the same browser, whose own skip-check still reads it expecting only its 5 v1 file
    // names. A fresh v2-only folder never touched a v1 file, so it stays empty (engine.ts's
    // v1OnlyHeadRevisions) — v2's own shard/manifest revisions live in sync-remote-cache instead.
    expect(status.headRevisions).toEqual({})
  })
})

describe('sync format v2 — two devices', () => {
  it('A adds one bookmark → A uploads one shard; B’s next poll downloads only that shard and shows it; the poll after that only lists', async () => {
    const a = await newDevice()
    for (const id of ['b1', 'b2']) await addBookmark(a, id)
    await runSyncCycle(a)

    const b = await newDevice()
    drive.clearCalls()
    const first = await runSyncCycle(b)
    expect(first.status).toBe('synced')
    expect(first.localChanged).toBe(true)
    expect(await localBookmarkIds(b)).toEqual(['b1', 'b2'])
    // B brought nothing new, so it uploaded nothing (not even the manifest).
    expect(uploadsOf('')).toEqual([])

    drive.clearCalls()
    await addBookmark(a, 'from-a', { updatedAt: 10 })
    await runSyncCycle(a)
    expect(uploadsOf('')).toEqual([bmShard('from-a')])

    drive.clearCalls()
    const poll = await runSyncCycle(b, { skipIfUnchanged: true })
    expect(poll.status).toBe('synced')
    expect(poll.localChanged).toBe(true)
    expect(downloads()).toEqual([bmShard('from-a')])
    expect(uploadsOf('')).toEqual([])
    expect(await localBookmarkIds(b)).toEqual(['b1', 'b2', 'from-a'])

    drive.clearCalls()
    const idle = await runSyncCycle(b, { skipIfUnchanged: true })
    expect(idle).toEqual({ status: 'synced', vaultConflict: false, localChanged: false })
    expect(drive.calls).toEqual([{ op: 'list' }])
    expect((await loadSyncStatus(b)).lastCycleTrace!.steps.map((s) => s.name)).toEqual(['license-check', 'start poll pending=-', 'skip-check'])
  })

  it('concurrent offline edits on both devices merge exactly like mergeAll and both converge', async () => {
    const a = await newDevice()
    for (const id of ['shared', 'a-only-old']) await addBookmark(a, id)
    await runSyncCycle(a)
    const b = await newDevice()
    await runSyncCycle(b)

    // Offline on both: A retitles `shared` (older edit), B retitles it later (wins LWW); each adds its own row.
    await addBookmark(a, 'shared', { title: 'from A', updatedAt: 100 })
    await addBookmark(a, 'a-new', { updatedAt: 100 })
    await addBookmark(b, 'shared', { title: 'from B', updatedAt: 200 })
    await addBookmark(b, 'b-new', { updatedAt: 200 })
    await b.put('tags', tag('b-tag', { updatedAt: 200 }) as never)
    const expected = mergeAll(await buildLocalSnapshot(a), await buildLocalSnapshot(b))

    expect((await runSyncCycle(a)).status).toBe('synced')
    expect((await runSyncCycle(b)).status).toBe('synced')
    expect((await runSyncCycle(a)).status).toBe('synced')

    const finalA = await buildLocalSnapshot(a)
    const finalB = await buildLocalSnapshot(b)
    expect(finalA.bookmarks).toEqual(expected.bookmarks)
    expect(finalB.bookmarks).toEqual(expected.bookmarks)
    expect(finalA.tags).toEqual(expected.tags)
    expect(finalB.tags).toEqual(expected.tags)
    expect(finalA.bookmarks.find((x) => x.id === 'shared')?.title).toBe('from B')
    expect(await driveBookmarkIds()).toEqual(['a-new', 'a-only-old', 'b-new', 'shared'])
  })

  it('a shard changed by the other device between pull and push is an optimistic-lock conflict that self-heals without losing either row', async () => {
    const a = await newDevice()
    await addBookmark(a, 'seed')
    await runSyncCycle(a)
    const b = await newDevice()
    await runSyncCycle(b)

    // Pick two ids that share a shard so both devices write the same file.
    const target = shardIndexFor('mine', 16)
    let theirs = ''
    for (let i = 0; i < 10_000 && !theirs; i++) if (shardIndexFor(`theirs-${i}`, 16) === target && `theirs-${i}` !== 'mine') theirs = `theirs-${i}`
    await addBookmark(a, 'mine', { updatedAt: 5 })

    // The other device's write lands right after A's pull (A's push is the 2nd listing of its cycle).
    let listCalls = 0
    vi.mocked(listFolderFiles).mockImplementation(async () => {
      listCalls += 1
      if (listCalls === 2) {
        await addBookmark(b, theirs, { updatedAt: 6 })
        // B pushes through the real engine functions against the same fake Drive (no lock needed here).
        const { pushSnapshot } = await import('./engine')
        const pulledB = await pullRemoteSnapshot('at', 'folder1', { cache: await loadRemoteCache(b, 'folder1') })
        const mergedB = mergeAll(await buildLocalSnapshot(b), pulledB.snapshot)
        await pushSnapshot('at', 'folder1', mergedB, pulledB.headRevisions, pulledB.remoteTexts, { shardCount: pulledB.shardCount })
      }
      return drive.listFolderFiles()
    })

    const result = await runSyncCycle(a)
    expect(result.status).toBe('synced')
    const shardRows = ((await drive.json(bmShard('mine'))) as Array<{ id: string }>).map((r) => r.id)
    expect(shardRows).toEqual(expect.arrayContaining(['mine', theirs]))
    expect(await localBookmarkIds(a)).toEqual(expect.arrayContaining(['mine', theirs, 'seed']))
  })
})

// ── v1 → v2 migration ────────────────────────────────────────────────────────

const V1_BOOKMARKS = [bookmark('v1-a'), bookmark('v1-b', { title: 'remote newer', updatedAt: 500 }), bookmark('v1-gone', { isDeleted: true, deletedAt: '2026-02-01T00:00:00.000Z', updatedAt: 9 })]
const V1_CARDS = [card('card-1', 'v1-a')]
const V1_TAGS = [tag('tag-1')]
const V1_BOARD_CONFIG = { config: { themeId: 'flat' }, updatedAt: 3 }

function seedV1Folder(): Record<string, string> {
  const revs: Record<string, string> = {}
  revs.bookmarks = drive.put('bookmarks.json', JSON.stringify(V1_BOOKMARKS)).rev
  revs.cards = drive.put('cards.json', JSON.stringify(V1_CARDS)).rev
  revs.tags = drive.put('tags.json', JSON.stringify(V1_TAGS)).rev
  revs.boardConfig = drive.put('board-config.json', JSON.stringify(V1_BOARD_CONFIG)).rev
  drive.put('manifest.json', JSON.stringify({ formatVersion: 1, appDbVersion: 20, updatedBy: { deviceId: 'x', at: 1 }, counts: {} }))
  return revs
}

async function v1FileSnapshot(): Promise<Array<[string, string, string]>> {
  const out: Array<[string, string, string]> = []
  for (const name of ['bookmarks.json', 'cards.json', 'tags.json', 'board-config.json']) {
    const f = drive.byName(name)!
    out.push([name, f.rev, await drive.text(name)])
  }
  return out
}

describe('sync format v2 — migration from v1', () => {
  it('reads the v1 files as the remote snapshot, merges exactly like v1, writes every v2 file + manifest v2, and leaves v1 untouched', async () => {
    const revs = seedV1Folder()
    const v1Before = await v1FileSnapshot()
    const a = await newDevice()
    await addBookmark(a, 'local-only', { updatedAt: 7 })
    await addBookmark(a, 'v1-b', { title: 'local older', updatedAt: 100 })
    await saveBoardConfig(a, { themeId: 'dotted-notebook' } as never, 42)

    // What the v1 engine would have computed for this cycle.
    const v1Remote: SyncSnapshot = {
      bookmarks: V1_BOOKMARKS as never, cards: V1_CARDS as never, tags: V1_TAGS as never,
      boardConfig: V1_BOARD_CONFIG as never, vault: null,
    }
    const expected = mergeAll(await buildLocalSnapshot(a), v1Remote)

    const result = await runSyncCycle(a)
    expect(result.status).toBe('synced')

    const local = await buildLocalSnapshot(a)
    expect(local.bookmarks).toEqual(expected.bookmarks)
    expect(local.cards).toEqual(expected.cards)
    expect(local.tags).toEqual(expected.tags)
    expect(local.boardConfig).toEqual(expected.boardConfig)

    // v2 files hold exactly the merged data.
    // (A v2 pull now skips the v1 files: their revisions equal manifest.migratedFromV1.)
    const v2Only = await pullRemoteSnapshot('at', 'folder1', { codec })
    expect(v2Only.isV2).toBe(true)
    expect(Object.keys(v2Only.headRevisions).filter((n) => !n.endsWith('.gz') && n !== 'manifest.json')).toEqual([])
    expect(v2Only.snapshot.bookmarks).toEqual(expected.bookmarks)
    expect(v2Only.snapshot.cards).toEqual(expected.cards)
    expect(v2Only.snapshot.tags).toEqual(expected.tags)
    expect(await driveBookmarkIds()).toEqual(['local-only', 'v1-a', 'v1-b', 'v1-gone'])
    expect(drive.names()).toContain('board-config.json.gz')

    // Manifest v2 records the v1 revisions it migrated from.
    const manifest = parseManifest(await drive.json('manifest.json'))
    expect(manifest).toMatchObject({ formatVersion: 2, shardCount: 16 })
    expect(manifest?.migratedFromV1).toEqual(revs)

    // Non-destructive: every v1 file is byte-for-byte and revision-for-revision unchanged.
    expect(await v1FileSnapshot()).toEqual(v1Before)
  })

  it('after migrating, sync-status.headRevisions holds only the v1 file names it read (never manifest.json or any v2 shard/single-file name) — the shared field a stale v1 tab still reads', async () => {
    const revs = seedV1Folder()
    const a = await newDevice()
    const result = await runSyncCycle(a) // migrates: reads all 5 v1 files this cycle
    expect(result.status).toBe('synced')

    const status = await loadSyncStatus(a)
    expect(status.headRevisions).toEqual({
      'bookmarks.json': revs.bookmarks,
      'cards.json': revs.cards,
      'tags.json': revs.tags,
      'board-config.json': revs.boardConfig,
    })

    // The v2 skip-check keeps working from sync-remote-cache alone (isRemoteListingUnchanged),
    // unaffected by what headRevisions now holds — a later unchanged poll is still list-only.
    drive.clearCalls()
    const idle = await runSyncCycle(a, { skipIfUnchanged: true })
    expect(idle.status).toBe('synced')
    expect(drive.calls).toEqual([{ op: 'list' }])
  })

  it('does not re-read the v1 files after the migration', async () => {
    seedV1Folder()
    const a = await newDevice()
    await runSyncCycle(a)
    drive.clearCalls()
    await runSyncCycle(a)
    expect(downloads()).toEqual([])
    const again = await runSyncCycle(a, { skipIfUnchanged: true })
    expect(again.localChanged).toBe(false)
  })

  it('a second device joining after the migration reads only v2 files and gets the same data', async () => {
    seedV1Folder()
    const a = await newDevice()
    await addBookmark(a, 'local-only')
    await runSyncCycle(a)
    drive.clearCalls()

    const b = await newDevice()
    await runSyncCycle(b)
    expect(downloads().filter((n) => !n.endsWith('.gz') && n !== 'manifest.json')).toEqual([])
    expect(await localBookmarkIds(b)).toEqual(await localBookmarkIds(a))
  })

  it('a stale v1 tab writing bookmarks.json after the migration is merged in (nothing lost) and the manifest records the new revision', async () => {
    seedV1Folder()
    const a = await newDevice()
    await runSyncCycle(a)

    // An old, not-yet-reloaded tab still runs the v1 engine: it rewrites bookmarks.json with a row
    // the v2 files have never seen (and overwrites manifest.json back to formatVersion 1).
    const staleRows = [...V1_BOOKMARKS, bookmark('stale-tab-row', { updatedAt: 900 })]
    const staleRev = drive.put('bookmarks.json', JSON.stringify(staleRows)).rev

    drive.clearCalls()
    const poll = await runSyncCycle(a, { skipIfUnchanged: true })
    expect(poll.status).toBe('synced')
    expect(poll.localChanged).toBe(true)
    expect(downloads()).toContain('bookmarks.json')
    expect(await localBookmarkIds(a)).toContain('stale-tab-row')
    expect(await driveBookmarkIds()).toContain('stale-tab-row')
    expect(uploadsOf('bookmarks-')).toEqual([bmShard('stale-tab-row')])
    const manifest = parseManifest(await drive.json('manifest.json'))
    expect(manifest?.migratedFromV1?.bookmarks).toBe(staleRev)

    // Recorded → the next poll is a pure listing again.
    drive.clearCalls()
    const idle = await runSyncCycle(a, { skipIfUnchanged: true })
    expect(idle.localChanged).toBe(false)
    expect(drive.calls).toEqual([{ op: 'list' }])
  })

  it('a stale v1 tab clobbering manifest.json back to formatVersion 1 never loses rows that exist only in v2 files', async () => {
    seedV1Folder()
    const a = await newDevice()
    await runSyncCycle(a)
    await addBookmark(a, 'v2-only-row', { updatedAt: 1000 })
    await runSyncCycle(a)
    expect(await driveBookmarkIds()).toContain('v2-only-row')

    // Old tab: rewrites v1 files and manifest v1 (it knows nothing about v2).
    drive.put('manifest.json', JSON.stringify({ formatVersion: 1, appDbVersion: 20, counts: {} }))

    const b = await newDevice()
    const result = await runSyncCycle(b)
    expect(result.status).toBe('synced')
    expect(await localBookmarkIds(b)).toContain('v2-only-row')
    expect(await driveBookmarkIds()).toContain('v2-only-row')
    expect(parseManifest(await drive.json('manifest.json'))).toMatchObject({ formatVersion: 2, shardCount: 16 })
  })
})

describe('sync format v2 — reshard', () => {
  it('doubles S when the average rows per shard exceeds RESHARD_AVG_ROWS, rewrites every shard, and nothing is lost', async () => {
    const a = await newDevice()
    for (let i = 0; i < 20; i++) await addBookmark(a, `early-${i}`)
    await runSyncCycle(a)
    expect(parseManifest(await drive.json('manifest.json'))?.shardCount).toBe(16)

    const total = 16 * RESHARD_AVG_ROWS + 1
    const tx = a.transaction('bookmarks', 'readwrite')
    for (let i = 20; i < total; i++) await tx.store.put(bookmark(`bulk-${i}`) as never)
    await tx.done

    drive.clearCalls()
    const result = await runSyncCycle(a)
    expect(result.status).toBe('synced')
    expect(parseManifest(await drive.json('manifest.json'))?.shardCount).toBe(32)
    for (let k = 0; k < 32; k++) expect(drive.names()).toContain(`bookmarks-${k}.json.gz`)
    // The old shard names were rewritten in place (updated), the new half created.
    expect(drive.callsOf('update').map((c) => c.name)).toEqual(expect.arrayContaining(['bookmarks-0.json.gz', 'bookmarks-15.json.gz']))
    expect(drive.callsOf('create').map((c) => c.name)).toEqual(expect.arrayContaining(['bookmarks-16.json.gz', 'bookmarks-31.json.gz']))

    // Every row sits in its fnv1a32(id) % 32 shard exactly once.
    const ids = await driveBookmarkIds()
    expect(ids).toHaveLength(total)
    expect(new Set(ids).size).toBe(total)
    for (const name of drive.names().filter((n) => n.startsWith('bookmarks-'))) {
      const k = Number(/bookmarks-(\d+)/.exec(name)![1])
      for (const row of (await drive.json(name)) as Array<{ id: string }>) expect(shardIndexFor(row.id, 32)).toBe(k)
    }

    // A reader assembles every row back from the 32 shards.
    const pulled = await pullRemoteSnapshot('at', 'folder1', {})
    expect(pulled.shardCount).toBe(32)
    expect(pulled.snapshot.bookmarks).toHaveLength(total)
  }, 60_000)
})

describe('sync format v2 — vault conflict', () => {
  it('force-publishes the winning local vault to vault.json.gz (gzip), never to v1 vault.json', async () => {
    const a = await newDevice()
    await createVault(a, 'local-tag', 'local-password', undefined)
    const localVault = await loadVaultRecord(a)
    const remoteVault = {
      key: 'private-vault', tagId: '000-remote', salt: 'aaa', iterations: 600000,
      publicKey: '0aa-pk', wrappedPrivateKey: { iv: 'aaa', ciphertext: 'aaa' },
    }
    expect(pickDeterministic(localVault, remoteVault)).toEqual(localVault)
    drive.put('manifest.json', JSON.stringify({ formatVersion: 2, shardCount: 16, updatedAt: 1 }))
    const vaultFile = drive.put('vault.json.gz', await codec.compress(JSON.stringify(remoteVault)), 'application/gzip')

    const result = await runSyncCycle(a)
    expect(result.vaultConflict).toBe(true)
    expect(updateBinaryFile).toHaveBeenCalledWith('at', vaultFile.id, expect.any(Uint8Array), 'application/gzip', expect.any(AbortSignal))
    expect(JSON.parse(await drive.text('vault.json.gz'))).toEqual(localVault)
    expect(drive.byName('vault.json')).toBeUndefined()
  })
})

describe('sync format v2 — reader robustness', () => {
  it('without CompressionStream the cycle fails (classified other) before touching Drive and writes nothing', async () => {
    seedV1Folder()
    const before = await v1FileSnapshot()
    setGzipCodecForTesting(null)
    const a = await newDevice()
    await addBookmark(a, 'local-row')
    drive.clearCalls()
    const result = await runSyncCycle(a)
    expect(result.status).toBe('error')
    expect(result.errorKind).toBe('other')
    expect(drive.calls).toEqual([])
    expect(await v1FileSnapshot()).toEqual(before)
    expect(drive.names().some((n) => n.endsWith('.gz'))).toBe(false)
    expect((await loadSyncStatus(a)).lastIssue).toEqual({ kind: 'error', errorKind: 'other', detail: 'codec: SyncUnsupportedError' })
  })

  it('a corrupt gzip shard fails the pull as corrupt data (no partial apply)', async () => {
    drive.put('manifest.json', JSON.stringify({ formatVersion: 2, shardCount: 16, updatedAt: 1 }))
    drive.put('bookmarks-0.json.gz', new Uint8Array([0x1f, 0x8b, 1, 2, 3, 4]), 'application/gzip')
    await expect(pullRemoteSnapshot('at', 'folder1', {})).rejects.toBeInstanceOf(SyncCorruptDataError)
    const a = await newDevice()
    const result = await runSyncCycle(a)
    expect(result.status).toBe('error')
    expect(result.errorKind).toBe('corrupt')
  })
})

// ── Regressions from the adversarial review ─────────────────────────────────────

describe('review regressions — convergence (no endless re-uploads)', () => {
  it('a row created with the app’s own key order settles to zero uploads on both devices (canonical serialization)', async () => {
    const a = await newDevice()
    // App key order (e.g. addBookmarkBatch): updatedAt right after savedAt — unlike the zod schema order.
    await a.put('bookmarks', {
      id: 'x1', url: 'u', title: 't', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website',
      savedAt: '2026-01-01T00:00:00.000Z', updatedAt: 5, ogpStatus: 'fetched', tags: [],
    } as never)
    await runSyncCycle(a)
    const b = await newDevice()
    const counts: string[] = []
    for (let i = 0; i < 4; i++) {
      drive.clearCalls(); await runSyncCycle(b); counts.push(`B:${uploadsOf('').length}`)
      drive.clearCalls(); await runSyncCycle(a); counts.push(`A:${uploadsOf('').length}`)
    }
    expect(counts).toEqual(['B:0', 'A:0', 'B:0', 'A:0', 'B:0', 'A:0', 'B:0', 'A:0'])
  })

  it('per-device board config never ping-pongs: board-config.json.gz is only seeded, never overwritten', async () => {
    const a = await newDevice()
    await addBookmark(a, 'b1')
    await saveBoardConfig(a, { themeId: 'a-theme' } as never, 10)
    await runSyncCycle(a)
    const seededRev = drive.byName('board-config.json.gz')!.rev

    const b = await newDevice()
    await runSyncCycle(b)
    await saveBoardConfig(b, { themeId: 'b-theme' } as never, 20)
    const log: string[] = []
    for (let i = 0; i < 3; i++) {
      drive.clearCalls(); await runSyncCycle(b); log.push(`B:${uploadsOf('').join(',')}`)
      drive.clearCalls(); await runSyncCycle(a, { skipIfUnchanged: true }); log.push(`A:${uploadsOf('').join(',')}|${drive.calls.length}`)
    }
    expect(log).toEqual(['B:', 'A:|1', 'B:', 'A:|1', 'B:', 'A:|1'])
    expect(drive.byName('board-config.json.gz')!.rev).toBe(seededRev)
    expect(((await buildLocalSnapshot(b)).boardConfig?.config as { themeId?: string }).themeId).toBe('b-theme')
    expect(((await buildLocalSnapshot(a)).boardConfig?.config as { themeId?: string }).themeId).toBe('a-theme')
  })
})

describe('review regressions — local changes are never stranded', () => {
  afterEach(() => { setSyncMarkDirty(null) })

  it('after a failed push, the next poll does a full cycle and uploads the change (pendingPush)', async () => {
    const a = await newDevice()
    await addBookmark(a, 'b1')
    await runSyncCycle(a)
    await addBookmark(a, 'b2', { updatedAt: 99 })
    vi.mocked(updateBinaryFile).mockRejectedValueOnce(new Error('net'))
    vi.mocked(createBinaryFile).mockRejectedValueOnce(new Error('net'))
    const failed = await runSyncCycle(a)
    expect(failed.status).toBe('error')
    expect((await loadSyncStatus(a)).pendingPush).toBeDefined()

    drive.clearCalls()
    const poll = await runSyncCycle(a, { skipIfUnchanged: true })
    expect(poll.status).toBe('synced')
    expect(uploadsOf('')).toContain(bmShard('b2'))
    expect(await driveBookmarkIds()).toEqual(['b1', 'b2'])
    expect((await loadSyncStatus(a)).pendingPush).toBeUndefined()

    drive.clearCalls()
    await runSyncCycle(a, { skipIfUnchanged: true })
    expect(drive.calls).toEqual([{ op: 'list' }])
  })

  it('a user write landing during an in-flight poll is pushed (automatic follow-up cycle)', async () => {
    const a = await newDevice()
    await addBookmark(a, 'b1')
    await runSyncCycle(a)
    const userDb = await initDB() // the board's own handle (same device DB, another connection)
    openDbs.push(userDb)
    const controller = createSyncController(a, 20)
    setSyncMarkDirty(controller.markDirty)

    let wrote = false
    vi.mocked(listFolderFiles).mockImplementation(async () => {
      if (!wrote) {
        wrote = true
        await userDb.put('bookmarks', bookmark('during-poll', { updatedAt: 50 }) as never)
      }
      return drive.listFolderFiles()
    })

    const poll = await controller.flushNow({ skipIfUnchanged: true })
    expect(poll.status).toBe('synced')
    await vi.waitFor(async () => {
      expect(await driveBookmarkIds()).toContain('during-poll')
    }, { timeout: 3000 })
    // Let the follow-up cycle finish (flushNow joins the in-flight one) before the DB closes.
    await controller.flushNow()
    controller.stop()
  })

  it('the persisted marker alone is enough: with the follow-up cycle cancelled, the next poll still pushes', async () => {
    const a = await newDevice()
    await addBookmark(a, 'b1')
    await runSyncCycle(a)
    const userDb = await initDB()
    openDbs.push(userDb)
    const controller = createSyncController(a, 60_000)
    setSyncMarkDirty(controller.markDirty)
    await userDb.put('bookmarks', bookmark('offline-edit', { updatedAt: 50 }) as never)
    controller.stop() // e.g. the tab closed before the debounce fired
    await vi.waitFor(async () => { expect((await loadSyncStatus(a)).pendingPush).toBeDefined() })

    drive.clearCalls()
    const poll = await runSyncCycle(a, { skipIfUnchanged: true })
    expect(poll.status).toBe('synced')
    expect(await driveBookmarkIds()).toContain('offline-edit')
    expect((await loadSyncStatus(a)).pendingPush).toBeUndefined()
  })

  it('a write from a page with no SyncController registered (bookmarklet /save popup, extension save-iframe, quick-tag strip — activeMarkDirty is null in that JS realm) still marks pendingPush, so the board tab\'s next poll never skips it', async () => {
    const a = await newDevice()
    await addBookmark(a, 'b1')
    const controller = createSyncController(a)
    setSyncMarkDirty(controller.markDirty)
    expect((await controller.flushNow()).status).toBe('synced')
    expect(await driveBookmarkIds()).toEqual(['b1'])

    // Simulate the write happening on a DIFFERENT page of the same browser (own initDB() handle,
    // own Proxy identity, never registered with any SyncController) — indexeddb.ts's write wrapper
    // must persist the pendingPush marker directly through IndexedDB itself (shared across every
    // page on the origin), since the in-memory notifySyncDirty() signal only reaches a controller
    // living in the SAME JS realm and there isn't one here.
    setSyncMarkDirty(null)
    const popupDb = await initDB()
    openDbs.push(popupDb)
    await popupDb.put('bookmarks', bookmark('saved-from-bookmarklet') as never)
    setSyncMarkDirty(controller.markDirty) // back in the board's own realm

    expect((await loadSyncStatus(a)).pendingPush).toBeDefined()

    // The board's 10s visible-tab poll (skipIfUnchanged) must not skip while pendingPush is set —
    // it falls through to a full cycle and pushes the popup's write.
    drive.clearCalls()
    const poll = await controller.flushNow({ skipIfUnchanged: true })
    expect(poll.status).toBe('synced')
    expect(await driveBookmarkIds()).toEqual(['b1', 'saved-from-bookmarklet'])
    expect((await loadSyncStatus(a)).pendingPush).toBeUndefined()

    controller.stop()
  })
})

describe('review regressions — duplicate same-name files', () => {
  it('folds a duplicate shard into the merge, deletes it after the push, and polls go back to list-only', async () => {
    const a = await newDevice()
    await addBookmark(a, 'b1')
    await runSyncCycle(a)
    const name = bmShard('b1')
    let extraId = ''
    for (let i = 0; i < 10_000 && !extraId; i++) if (bmShard(`from-dup-${i}`) === name) extraId = `from-dup-${i}`
    // Another device created the same shard name at the same moment, holding a row this device lacks.
    drive.putDuplicate('zzz-dup', name, await codec.compress(JSON.stringify([bookmark('b1'), bookmark(extraId, { updatedAt: 3 })])))

    drive.clearCalls()
    const result = await runSyncCycle(a)
    expect(result.status).toBe('synced')
    expect(await localBookmarkIds(a)).toContain(extraId)
    expect(drive.files.has('zzz-dup')).toBe(false)
    expect(drive.callsOf('delete').map((c) => c.name)).toEqual([name])
    expect(((await drive.json(name)) as Array<{ id: string }>).map((r) => r.id)).toContain(extraId)

    for (let i = 0; i < 2; i++) {
      drive.clearCalls()
      await runSyncCycle(a, { skipIfUnchanged: true })
      expect(drive.calls).toEqual([{ op: 'list' }])
    }
  })

  it('the smallest-id copy is the primary everywhere (writes go to it, the other copy is removed)', async () => {
    const a = await newDevice()
    await addBookmark(a, 'b1')
    await runSyncCycle(a)
    const name = bmShard('b1')
    const original = drive.byName(name)!
    // A copy whose id sorts BEFORE the original becomes the primary.
    drive.putDuplicate('aaa-dup', name, await codec.compress(JSON.stringify([bookmark('b1')])))
    await addBookmark(a, 'b1', { title: 'edited', updatedAt: 70 })

    drive.clearCalls()
    await runSyncCycle(a)
    expect(drive.files.has('aaa-dup')).toBe(true)
    expect(drive.files.has(original.id)).toBe(false)
    expect(((await drive.json(name)) as Array<{ title: string }>)[0].title).toBe('edited')
  })

  it('a duplicate v1 file is read once (cached), never deleted, and never defeats the skip-check', async () => {
    seedV1Folder()
    drive.putDuplicate('zzz-v1dup', 'bookmarks.json', new TextEncoder().encode(JSON.stringify([bookmark('v1-dup-row')])), 'application/json')
    const a = await newDevice()
    await runSyncCycle(a)
    expect(await localBookmarkIds(a)).toContain('v1-dup-row')
    expect(drive.files.has('zzz-v1dup')).toBe(true)

    for (let i = 0; i < 2; i++) {
      drive.clearCalls()
      await runSyncCycle(a, { skipIfUnchanged: true })
      expect(drive.calls).toEqual([{ op: 'list' }])
    }
  })
})

describe('review regressions — EMPTY TRASH stays empty across devices', () => {
  it('device A purges a trashed bookmark → it never comes back on A or on B (whose copy is older)', async () => {
    const a = await newDevice()
    await addBookmark(a, 'keep')
    await addBookmark(a, 'gone', { isDeleted: true, deletedAt: '2026-01-02T00:00:00.000Z', updatedAt: 2 })
    await runSyncCycle(a)
    const b = await newDevice()
    await runSyncCycle(b)
    expect((await b.get('bookmarks', 'gone'))?.isDeleted).toBe(true)

    // A: EMPTY TRASH (what use-board-data.ts emptyTrash now writes instead of a hard delete).
    await a.put('bookmarks', purgedBookmarkTombstone('gone'))
    await runSyncCycle(a)
    await runSyncCycle(b)
    await runSyncCycle(a)

    for (const d of [a, b]) {
      expect(await d.get('bookmarks', 'gone')).toMatchObject({ isDeleted: true, purged: true, url: '', title: '' })
    }
    const onDrive = ((await drive.json(bmShard('gone'))) as Array<{ id: string; purged?: boolean }>).find((r) => r.id === 'gone')
    expect(onDrive?.purged).toBe(true)
  })
})
