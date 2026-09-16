import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB, type AllMarksDB } from '@/lib/storage/indexeddb'
import { saveBoardConfig } from '@/lib/storage/board-config'
import { createVault } from '@/lib/private/vault-store'
import { buildLocalSnapshot, applySnapshotToLocal } from './engine'
import type { SyncSnapshot } from './merge'
import { saveSyncTokens, loadSyncTokens } from './sync-store'
import { ensureAccessToken, hasRequiredScopes, SyncNotConnectedError } from './engine'

vi.mock('./auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./auth')>()
  return { ...actual, refreshAccessToken: vi.fn() }
})
import { refreshAccessToken, SYNC_OAUTH_SCOPE } from './auth'

let db: IDBPDatabase<AllMarksDB> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) { if (info.name) indexedDB.deleteDatabase(info.name) }
  vi.clearAllMocks()
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('buildLocalSnapshot', () => {
  it('returns empty arrays and nulls on a fresh DB', async () => {
    const d = await initDB(); db = d
    const snapshot = await buildLocalSnapshot(d)
    expect(snapshot).toEqual({ bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null })
  })

  it('includes board config with updatedAt and vault when present', async () => {
    const d = await initDB(); db = d
    await saveBoardConfig(d, { themeId: 'dotted-notebook' } as never, 42)
    await createVault(d, 'tag1', 'password123', undefined)
    const snapshot = await buildLocalSnapshot(d)
    expect(snapshot.boardConfig?.updatedAt).toBe(42)
    expect(snapshot.vault?.tagId).toBe('tag1')
  })
})

describe('applySnapshotToLocal', () => {
  it('adds new bookmarks/tags/cards without touching unrelated existing rows', async () => {
    const d = await initDB(); db = d
    await d.put('bookmarks', {
      id: 'existing', url: 'https://a.com', title: 'a', description: '', thumbnail: '', favicon: '',
      siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z', ogpStatus: 'fetched', tags: [],
    } as never)

    const snapshot: SyncSnapshot = {
      bookmarks: [{
        id: 'new', url: 'https://b.com', title: 'b', description: '', thumbnail: '', favicon: '',
        siteName: '', type: 'website', savedAt: '2026-01-02T00:00:00.000Z', ogpStatus: 'fetched', tags: [],
      } as never],
      tags: [], cards: [], boardConfig: null, vault: null,
    }
    await applySnapshotToLocal(d, snapshot)

    const all = await d.getAll('bookmarks')
    expect(all.map(b => b.id).sort()).toEqual(['existing', 'new'])
  })

  it('leaves settings untouched when boardConfig/vault are null in the snapshot', async () => {
    const d = await initDB(); db = d
    await saveBoardConfig(d, { themeId: 'flat' } as never, 1)
    const snapshot: SyncSnapshot = { bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null }
    await applySnapshotToLocal(d, snapshot)
    const record = await d.get('settings', 'board-config')
    expect((record as { updatedAt?: number } | undefined)?.updatedAt).toBe(1)
  })

  it('writes boardConfig and vault when present in the snapshot', async () => {
    const d = await initDB(); db = d
    const snapshot: SyncSnapshot = {
      bookmarks: [], tags: [], cards: [],
      boardConfig: { config: { themeId: 'flat' } as never, updatedAt: 7 },
      vault: {
        key: 'private-vault', tagId: 'tag1', salt: 's', iterations: 600000,
        publicKey: 'pk', wrappedPrivateKey: { iv: 'iv', ciphertext: 'ct' },
      },
    }
    await applySnapshotToLocal(d, snapshot)
    const config = await d.get('settings', 'board-config')
    expect((config as { updatedAt?: number } | undefined)?.updatedAt).toBe(7)
    const vault = await d.get('settings', 'private-vault')
    expect((vault as { tagId?: string } | undefined)?.tagId).toBe('tag1')
  })
})

describe('ensureAccessToken', () => {
  it('throws SyncNotConnectedError when no tokens are stored', async () => {
    const d = await initDB(); db = d
    await expect(ensureAccessToken(d)).rejects.toThrow(SyncNotConnectedError)
  })

  it('returns the stored access token when not expired', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100_000, scope: 's', refreshToken: 'rt' })
    expect(await ensureAccessToken(d, Date.now())).toBe('at')
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('refreshes and persists a new token when expired', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'old', expiresAt: 1, scope: 's', refreshToken: 'rt' })
    vi.mocked(refreshAccessToken).mockResolvedValue({ accessToken: 'new', expiresAt: 999999999999, scope: 's' })
    const token = await ensureAccessToken(d, Date.now())
    expect(token).toBe('new')
    expect(refreshAccessToken).toHaveBeenCalledWith('rt')
    const persisted = await loadSyncTokens(d)
    expect(persisted?.accessToken).toBe('new')
    expect(persisted?.refreshToken).toBe('rt') // refresh doesn't return a new refresh token — keep the old one
  })
})

describe('hasRequiredScopes', () => {
  it('true when drive.file is present, regardless of how Google formats the other scopes', () => {
    // Real Google responses normalize openid/email/profile to full userinfo.* URLs,
    // not the short forms requested — hasRequiredScopes must not depend on those.
    expect(hasRequiredScopes(
      'openid https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    )).toBe(true)
  })

  it('false when drive.file is missing (partial consent)', () => {
    expect(hasRequiredScopes('openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile')).toBe(false)
  })

  it('true when Google omits the scope field entirely (soft check by design)', () => {
    expect(hasRequiredScopes('')).toBe(true)
  })
})

vi.mock('./drive-adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./drive-adapter')>()
  return {
    ...actual,
    findSyncFolder: vi.fn(),
    createSyncFolder: vi.fn(),
    listFolderFiles: vi.fn(),
    downloadFileText: vi.fn(),
    getHeadRevisionId: vi.fn(),
    createTextFile: vi.fn(),
    updateTextFile: vi.fn(),
  }
})
import {
  findSyncFolder, createSyncFolder, listFolderFiles, downloadFileText,
  getHeadRevisionId, createTextFile, updateTextFile, DriveError,
} from './drive-adapter'
import { ensureSyncFolder, pullRemoteSnapshot, pushSnapshot, SyncCorruptDataError, SyncConflictError } from './engine'

describe('ensureSyncFolder', () => {
  it('returns the existing folder id without creating one', async () => {
    vi.mocked(findSyncFolder).mockResolvedValue('folder1')
    const id = await ensureSyncFolder('token')
    expect(id).toBe('folder1')
    expect(createSyncFolder).not.toHaveBeenCalled()
  })

  it('creates a folder when none exists', async () => {
    vi.mocked(findSyncFolder).mockResolvedValue(null)
    vi.mocked(createSyncFolder).mockResolvedValue('new-folder')
    expect(await ensureSyncFolder('token')).toBe('new-folder')
  })
})

describe('pullRemoteSnapshot', () => {
  it('treats a missing file as empty/null and records headRevisionId for present files', async () => {
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-bookmarks', name: 'bookmarks.json' }])
    vi.mocked(downloadFileText).mockResolvedValue('[]')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')

    const { snapshot, headRevisions } = await pullRemoteSnapshot('token', 'folder1')
    expect(snapshot).toEqual({ bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null })
    expect(headRevisions).toEqual({ 'bookmarks.json': 'rev-1' })
  })

  it('throws SyncCorruptDataError when a downloaded file fails zod validation', async () => {
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-bookmarks', name: 'bookmarks.json' }])
    vi.mocked(downloadFileText).mockResolvedValue('{"not":"an array"}')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')

    await expect(pullRemoteSnapshot('token', 'folder1')).rejects.toThrow(SyncCorruptDataError)
  })
})

describe('pushSnapshot', () => {
  const snapshot: SyncSnapshot = { bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null }

  it('creates files that do not exist yet', async () => {
    vi.mocked(listFolderFiles).mockResolvedValue([])
    vi.mocked(createTextFile).mockResolvedValue({ id: 'new-id', name: 'bookmarks.json', headRevisionId: 'rev-new' })
    const revisions = await pushSnapshot('token', 'folder1', snapshot, {})
    expect(revisions['bookmarks.json']).toBe('rev-new')
    expect(updateTextFile).not.toHaveBeenCalled()
  })

  it('updates an existing file when the recorded revision still matches', async () => {
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f1', name: 'bookmarks.json' }])
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')
    vi.mocked(updateTextFile).mockResolvedValue({ id: 'f1', name: 'bookmarks.json', headRevisionId: 'rev-2' })
    const revisions = await pushSnapshot('token', 'folder1', snapshot, { 'bookmarks.json': 'rev-1' })
    expect(revisions['bookmarks.json']).toBe('rev-2')
  })

  it('throws SyncConflictError when the remote revision changed since the recorded pull', async () => {
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f1', name: 'bookmarks.json' }])
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-DIFFERENT')
    await expect(
      pushSnapshot('token', 'folder1', snapshot, { 'bookmarks.json': 'rev-1' }),
    ).rejects.toThrow(SyncConflictError)
    expect(updateTextFile).not.toHaveBeenCalled()
  })

  // Fix I-6: previously, `existing` truthy + no recorded `previous` skipped the revision check
  // entirely and blind-overwrote the file. That's a real race window (another device created the
  // file in the gap between this device's pull and this device's push) — it must now be treated
  // as a conflict, uniformly across all 5 files, not silently passed through.
  it('throws SyncConflictError when the file exists remotely but this device recorded no previous revision for it', async () => {
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f1', name: 'bookmarks.json' }])
    await expect(
      pushSnapshot('token', 'folder1', snapshot, {}), // no entry for 'bookmarks.json'
    ).rejects.toThrow(SyncConflictError)
    expect(updateTextFile).not.toHaveBeenCalled()
  })
})

import { runSyncCycle, connectSync } from './engine'
import { updateSyncStatus, loadSyncStatus } from './sync-store'
import { mergeAll } from './merge'

function bookmark(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id, url: `https://x.com/${id}`, title: id, description: '', thumbnail: '', favicon: '',
    siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z', ogpStatus: 'fetched',
    tags: [], updatedAt: 1, ...overrides,
  }
}

describe('runSyncCycle', () => {
  it('returns not-connected when sync-status has no folderId', async () => {
    const d = await initDB(); db = d
    const result = await runSyncCycle(d)
    expect(result).toEqual({ status: 'not-connected', vaultConflict: false })
  })

  it('pulls, merges, writes locally, and pushes on a clean cycle', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    await d.put('bookmarks', bookmark('local-only') as never)

    vi.mocked(listFolderFiles).mockResolvedValue([])
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))

    const result = await runSyncCycle(d)
    expect(result.status).toBe('synced')
    expect(result.mergedCounts?.bookmarks).toBe(1)
    expect(createTextFile).toHaveBeenCalled() // manifest.json + bookmarks.json etc all created
    const status = await loadSyncStatus(d)
    expect(status.lastSyncAt).toBeGreaterThan(0)
  })

  it('pauses with needs-confirmation when the merge would remove more than 25% of >=10 active bookmarks, and writes nothing', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    for (let i = 0; i < 10; i++) await d.put('bookmarks', bookmark(`local-${i}`) as never)

    // Remote has none of them and tombstones are absent → naive read would look like mass deletion.
    // Simulate by pulling an empty remote AND asserting the guard triggers off of the *merged* result,
    // so seed remote with tombstones for 8 of the 10 ids (deletions newer than local's updatedAt).
    const remoteBookmarks = Array.from({ length: 8 }, (_, i) =>
      bookmark(`local-${i}`, { isDeleted: true, deletedAt: '2026-06-01T00:00:00.000Z', updatedAt: 999999 }))
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-bm', name: 'bookmarks.json' }])
    vi.mocked(downloadFileText).mockImplementation(async (_t, id) =>
      id === 'f-bm' ? JSON.stringify(remoteBookmarks) : '[]')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')

    const result = await runSyncCycle(d)
    expect(result.status).toBe('needs-confirmation')
    expect(result.deletionRatio).toBeGreaterThan(0.25)
    expect(createTextFile).not.toHaveBeenCalled()
    expect(updateTextFile).not.toHaveBeenCalled()
    const stillLocal = await d.getAll('bookmarks')
    expect(stillLocal).toHaveLength(10) // untouched — guard paused before any write
    // Fix I-8: toHaveLength(10) alone passes whether the guard fired OR the merge was silently
    // applied (same row count either way, since a merge tombstones rather than deletes) — this
    // genuinely proves none of the local records were touched by the (blocked) merge.
    expect(stillLocal.every(b => b.isDeleted !== true)).toBe(true)
  })

  it('bypasses the mass-deletion guard when opts.bypassMassDeleteGuard is true', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    for (let i = 0; i < 10; i++) await d.put('bookmarks', bookmark(`local-${i}`) as never)
    const remoteBookmarks = Array.from({ length: 8 }, (_, i) =>
      bookmark(`local-${i}`, { isDeleted: true, deletedAt: '2026-06-01T00:00:00.000Z', updatedAt: 999999 }))
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-bm', name: 'bookmarks.json' }])
    vi.mocked(downloadFileText).mockImplementation(async (_t, id) =>
      id === 'f-bm' ? JSON.stringify(remoteBookmarks) : '[]')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')
    vi.mocked(updateTextFile).mockImplementation(async (_t, id, _c) => ({ id, name: 'bookmarks.json', headRevisionId: 'rev-2' }))
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))

    const result = await runSyncCycle(d, { bypassMassDeleteGuard: true })
    expect(result.status).toBe('synced')
  })

  it('persists lastIssue with deletedCount when it pauses for confirmation', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    for (let i = 0; i < 10; i++) await d.put('bookmarks', bookmark(`local-${i}`) as never)
    const remoteBookmarks = Array.from({ length: 8 }, (_, i) =>
      bookmark(`local-${i}`, { isDeleted: true, deletedAt: '2026-06-01T00:00:00.000Z', updatedAt: 999999 }))
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-bm', name: 'bookmarks.json' }])
    vi.mocked(downloadFileText).mockImplementation(async (_t, id) =>
      id === 'f-bm' ? JSON.stringify(remoteBookmarks) : '[]')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')

    const result = await runSyncCycle(d)
    expect(result.status).toBe('needs-confirmation')
    expect(result.deletedCount).toBe(8)
    const status = await loadSyncStatus(d)
    expect(status.lastIssue).toEqual({ kind: 'needs-confirmation', deletedCount: 8 })
  })

  it('persists lastIssue with a classified errorKind on pull failure, and clears it on the next successful cycle', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    vi.mocked(listFolderFiles).mockRejectedValueOnce(new DriveError(0, 'drive fetch failed: network error'))

    const failed = await runSyncCycle(d)
    expect(failed.status).toBe('error')
    expect(failed.errorKind).toBe('network')
    const statusAfterFailure = await loadSyncStatus(d)
    expect(statusAfterFailure.lastIssue).toEqual({ kind: 'error', errorKind: 'network' })

    vi.mocked(listFolderFiles).mockResolvedValue([])
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))
    const succeeded = await runSyncCycle(d)
    expect(succeeded.status).toBe('synced')
    const statusAfterSuccess = await loadSyncStatus(d)
    expect(statusAfterSuccess.lastIssue).toBeUndefined()
  })

  it('flags vaultConflict and keeps the local vault untouched when local and remote vaults differ', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    await createVault(d, 'tag1', 'local-password')

    const remoteVault = {
      key: 'private-vault', tagId: 'tag1', salt: 'different-salt', iterations: 600000,
      publicKey: 'different-pk', wrappedPrivateKey: { iv: 'iv2', ciphertext: 'ct2' },
    }
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-vault', name: 'vault.json' }])
    vi.mocked(downloadFileText).mockImplementation(async (_t, id) =>
      id === 'f-vault' ? JSON.stringify(remoteVault) : '[]')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')
    vi.mocked(updateTextFile).mockImplementation(async (_t, id) => ({ id, name: 'x', headRevisionId: 'rev-2' }))
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))

    const result = await runSyncCycle(d)
    expect(result.vaultConflict).toBe(true)
    const localVaultAfter = await d.get('settings', 'private-vault')
    expect((localVaultAfter as { salt?: string } | undefined)?.salt).not.toBe('different-salt')
    // Fix I3: on conflict the snapshot's vault is null, not local.vault — so vault.json (the only
    // file present remotely here) is never written back to Drive at all. The local survival above
    // is because it was genuinely never touched, not because it was re-written with the same value.
    expect(updateTextFile).not.toHaveBeenCalled()
  })

  // Fix C1 (senior review, post-Task-8): the retry path used to reuse the FIRST pull's vaultConflict
  // boolean unchanged, so a vault conflict that only becomes visible on the retry's re-pull (the
  // realistic two-devices-set-up-Private-independently-then-race-to-sync scenario) was silently
  // missed — mergeAll's arbitrary pickDeterministic would have won and gotten pushed/applied.
  it('re-checks the vault conflict on the retry path when the retry re-pull reveals a differing vault', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    await createVault(d, 'tag1', 'local-password')
    const localVaultBefore = await d.get('settings', 'private-vault') as { salt: string }

    const remoteVault = {
      key: 'private-vault', tagId: 'tag1', salt: 'different-salt', iterations: 600000,
      publicKey: 'different-pk', wrappedPrivateKey: { iv: 'iv2', ciphertext: 'ct2' },
    }
    // The FIRST pull sees no vault at all (so vaultConflict is false on the first attempt) — only
    // the RETRY's re-pull (after listFolderFiles has been called twice) discovers the other
    // device's vault, alongside the same bookmarks.json used to force the first push to conflict.
    let listCalls = 0
    vi.mocked(listFolderFiles).mockImplementation(async () => {
      listCalls += 1
      return listCalls <= 2
        ? [{ id: 'f-bm', name: 'bookmarks.json' }]
        : [{ id: 'f-bm', name: 'bookmarks.json' }, { id: 'f-vault', name: 'vault.json' }]
    })
    vi.mocked(downloadFileText).mockImplementation(async (_t, id) =>
      id === 'f-vault' ? JSON.stringify(remoteVault) : '[]')
    vi.mocked(getHeadRevisionId)
      .mockResolvedValueOnce('rev-bm-1')        // 1st pull: bookmarks.json base revision
      .mockResolvedValueOnce('rev-bm-CONFLICT') // 1st push's check on bookmarks.json — mismatches, throws
      .mockResolvedValueOnce('rev-bm-2')        // retry re-pull: bookmarks.json
      .mockResolvedValueOnce('rev-vault-1')     // retry re-pull: vault.json (now visible)
      .mockResolvedValueOnce('rev-bm-2')        // 2nd push's check on bookmarks.json — matches, succeeds
    vi.mocked(updateTextFile).mockImplementation(async (_t, id) => ({ id, name: 'bookmarks.json', headRevisionId: 'rev-bm-3' }))
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))

    const result = await runSyncCycle(d)

    expect(result.status).toBe('synced')
    expect(result.vaultConflict).toBe(true) // only visible after the retry's re-pull
    const localVaultAfter = await d.get('settings', 'private-vault') as { salt: string }
    // Local vault is still exactly what createVault wrote before the cycle — never overwritten by
    // pickDeterministic's arbitrary choice between local/remote.
    expect(localVaultAfter.salt).toBe(localVaultBefore.salt)
    expect(localVaultAfter.salt).not.toBe('different-salt')
    // Fix I3: Drive's vault.json (id 'f-vault', now visible on the retry) is never written to either.
    expect(updateTextFile).not.toHaveBeenCalledWith(expect.anything(), 'f-vault', expect.anything())
  })

  // Not in the plan's Step-1 test list, but the task brief calls out self-heal-on-conflict as one
  // of four load-bearing safety behaviors — added here so it's actually covered by a test that
  // would fail if the retry-once logic were removed (result would be 'error' and getHeadRevisionId
  // would only be called twice instead of four times).
  it('self-heals a push conflict: re-pulls, re-merges, and pushes again exactly once', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })

    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-bm', name: 'bookmarks.json' }])
    vi.mocked(downloadFileText).mockResolvedValue('[]')
    vi.mocked(getHeadRevisionId)
      .mockResolvedValueOnce('rev-1')        // 1st pull records this as the base revision
      .mockResolvedValueOnce('rev-CONFLICT') // 1st push's optimistic-lock check — mismatches rev-1
      .mockResolvedValueOnce('rev-2')        // re-pull after the conflict records the new revision
      .mockResolvedValueOnce('rev-2')        // 2nd push's check — matches the re-pull, so it succeeds
    vi.mocked(updateTextFile).mockImplementation(async (_t, id) => ({ id, name: 'bookmarks.json', headRevisionId: 'rev-3' }))
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))

    const result = await runSyncCycle(d)

    expect(result.status).toBe('synced')
    // 2 calls from the initial pull+push, 2 more from the retry's re-pull+re-push — proves a
    // genuine second pull/push cycle happened rather than the first push simply not conflicting.
    expect(getHeadRevisionId).toHaveBeenCalledTimes(4)
    expect(updateTextFile).toHaveBeenCalledTimes(1) // the 1st attempt throws before ever calling it
  })

  // Fix I-1: the retry path used to reuse the STALE `local` snapshot captured at cycle start.
  // Here the first pull sees no vault at all (so vaultConflict is false going into the first push
  // attempt), the first push conflicts on bookmarks.json, and — while the retry's re-pull is "in
  // flight" — the user sets up Private locally for the first time (simulated by creating the vault
  // as a side effect of the retry re-pull's own listFolderFiles call, which runs and resolves
  // before buildLocalSnapshot is ever called). Under the old stale-`local` code, `local.vault` is
  // null at that point, so the retry's conflict check never fires and mergeAll(finalSnapshot, ...)
  // silently adopts the remote vault — permanently overwriting the user's brand-new local vault
  // and losing its wrapped private key. The fix re-reads IndexedDB (`localNow`) right before the
  // retry's merge, so it must both detect the conflict AND leave the freshly-created local vault
  // untouched.
  it('re-derives local from IndexedDB on the retry path so a vault created mid-retry is detected and never overwritten', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    // No vault yet — the first pull genuinely sees none either.

    const remoteVault = {
      key: 'private-vault', tagId: 'tag1', salt: 'remote-salt', iterations: 600000,
      publicKey: 'remote-pk', wrappedPrivateKey: { iv: 'iv-remote', ciphertext: 'ct-remote' },
    }
    let createdDuringRetry: { salt?: string; publicKey?: string } | null = null

    let listCalls = 0
    vi.mocked(listFolderFiles).mockImplementation(async () => {
      listCalls += 1
      if (listCalls === 3) {
        // The retry's re-pull is the 3rd call to listFolderFiles (1st pull, 1st push's internal
        // list, then this). Simulate the user finishing Private setup right as it resolves —
        // strictly before runSyncCycle ever calls buildLocalSnapshot(db) for the retry.
        await createVault(d, 'tag1', 'local-during-retry')
        const created = await d.get('settings', 'private-vault') as { salt?: string; publicKey?: string }
        createdDuringRetry = { salt: created.salt, publicKey: created.publicKey }
        return [{ id: 'f-bm', name: 'bookmarks.json' }, { id: 'f-vault', name: 'vault.json' }]
      }
      return [{ id: 'f-bm', name: 'bookmarks.json' }]
    })
    vi.mocked(downloadFileText).mockImplementation(async (_t, id) =>
      id === 'f-vault' ? JSON.stringify(remoteVault) : '[]')
    vi.mocked(getHeadRevisionId)
      .mockResolvedValueOnce('rev-bm-1')        // 1st pull: bookmarks.json base revision
      .mockResolvedValueOnce('rev-bm-CONFLICT') // 1st push's check on bookmarks.json — mismatches, throws
      .mockResolvedValueOnce('rev-bm-2')        // retry re-pull: bookmarks.json
      .mockResolvedValueOnce('rev-vault-1')     // retry re-pull: vault.json (now visible)
      .mockResolvedValueOnce('rev-bm-2')        // 2nd push's check on bookmarks.json — matches, succeeds
    vi.mocked(updateTextFile).mockImplementation(async (_t, id) => ({ id, name: 'bookmarks.json', headRevisionId: 'rev-bm-3' }))
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))

    const result = await runSyncCycle(d)

    expect(result.status).toBe('synced')
    expect(result.vaultConflict).toBe(true) // only visible once localNow is re-read on the retry
    expect(createdDuringRetry).not.toBeNull()
    const localVaultAfter = await d.get('settings', 'private-vault') as { salt?: string; publicKey?: string }
    // The vault the user just created mid-retry survives unchanged — not overwritten by the
    // remote vault that mergeAll(stale-local, remote) would otherwise have adopted.
    expect(localVaultAfter?.salt).toBe(createdDuringRetry!.salt)
    expect(localVaultAfter?.publicKey).toBe(createdDuringRetry!.publicKey)
    expect(localVaultAfter?.salt).not.toBe('remote-salt')
  })
})

describe('connectSync', () => {
  it('saves tokens, finds/creates the folder, and runs a sync cycle', async () => {
    const d = await initDB(); db = d
    vi.mocked(findSyncFolder).mockResolvedValue(null)
    vi.mocked(createSyncFolder).mockResolvedValue('new-folder')
    vi.mocked(listFolderFiles).mockResolvedValue([])
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))

    const result = await connectSync(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: SYNC_OAUTH_SCOPE, refreshToken: 'rt' })
    expect(result.status).toBe('synced')
    const status = await loadSyncStatus(d)
    expect(status.connected).toBe(true)
    expect(status.folderId).toBe('new-folder')
  })

  it('decodes and persists connectedEmail from the ID token on a successful connect', async () => {
    const d = await initDB(); db = d
    vi.mocked(findSyncFolder).mockResolvedValue(null)
    vi.mocked(createSyncFolder).mockResolvedValue('new-folder')
    vi.mocked(listFolderFiles).mockResolvedValue([])
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))
    const base64url = (s: string): string => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const idToken = `${base64url('{}')}.${base64url(JSON.stringify({ email: 'user@example.com' }))}.sig`

    await connectSync(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: SYNC_OAUTH_SCOPE, refreshToken: 'rt', idToken })
    const status = await loadSyncStatus(d)
    expect(status.connectedEmail).toBe('user@example.com')
  })

  // Fix I-2: connectSync is the one place holding tokens.scope, and the natural place to reject a
  // connection attempt with partial OAuth consent. hasRequiredScopes (Task 6) was dead code before
  // this fix — never called anywhere.
  it('returns status:error without saving tokens or touching Drive when the granted scope is missing drive.file', async () => {
    const d = await initDB(); db = d
    const result = await connectSync(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 'openid email profile', refreshToken: 'rt' })
    expect(result).toEqual(expect.objectContaining({ status: 'error', vaultConflict: false }))
    expect(findSyncFolder).not.toHaveBeenCalled()
    expect(createSyncFolder).not.toHaveBeenCalled()
    const persistedTokens = await loadSyncTokens(d)
    expect(persistedTokens).toBeNull()
    const status = await loadSyncStatus(d)
    expect(status.connected).not.toBe(true)
  })

  // Fix I-2: every other path in this module returns Promise<SyncCycleResult> and never rejects.
  // connectSync used to be the one exception — a Drive error here (403, network failure) propagated
  // as an unhandled rejection instead of resolving with {status:'error', ...}.
  it('resolves with status:error instead of rejecting when ensureSyncFolder fails', async () => {
    const d = await initDB(); db = d
    vi.mocked(findSyncFolder).mockRejectedValue(new Error('403: insufficient permission'))

    await expect(
      connectSync(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: SYNC_OAUTH_SCOPE, refreshToken: 'rt' }),
    ).resolves.toEqual(expect.objectContaining({ status: 'error', vaultConflict: false }))
  })
})
