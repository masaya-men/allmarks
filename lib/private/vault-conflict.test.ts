import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { createVault, loadVaultRecord, retireVault, type PrivateVaultRecord } from '@/lib/private/vault-store'
import { addPrivateTag } from '@/lib/private/apply-tag-change'
import {
  saveVaultConflict, loadVaultConflict, clearVaultConflict,
  isLocalVaultTarget, isVaultConflictResolved, mergeIntoOtherVault,
} from './vault-conflict'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) { if (info.name) indexedDB.deleteDatabase(info.name) }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('vault-conflict persistence', () => {
  it('returns null when nothing saved', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await loadVaultConflict(d)).toBeNull()
  })

  it('round-trips a saved conflict, and clearVaultConflict removes it', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const other: PrivateVaultRecord = {
      key: 'private-vault', tagId: 'other-tag', salt: 's', iterations: 600000,
      publicKey: 'other-pk', wrappedPrivateKey: { iv: 'iv', ciphertext: 'ct' },
    }
    await saveVaultConflict(d, other)
    const loaded = await loadVaultConflict(d)
    expect(loaded?.otherRecord).toEqual(other)
    await clearVaultConflict(d)
    expect(await loadVaultConflict(d)).toBeNull()
  })
})

describe('isLocalVaultTarget', () => {
  it('is deterministic regardless of which side calls it', () => {
    const a: PrivateVaultRecord = {
      key: 'private-vault', tagId: 'tag-a', salt: 'salt-a', iterations: 600000,
      publicKey: 'pk-a', wrappedPrivateKey: { iv: 'iv-a', ciphertext: 'ct-a' },
    }
    const b: PrivateVaultRecord = {
      key: 'private-vault', tagId: 'tag-b', salt: 'salt-b', iterations: 600000,
      publicKey: 'pk-b', wrappedPrivateKey: { iv: 'iv-b', ciphertext: 'ct-b' },
    }
    // Exactly one of the two is the target from either side's point of view.
    expect(isLocalVaultTarget(a, b)).toBe(!isLocalVaultTarget(b, a))
  })
})

describe('isVaultConflictResolved', () => {
  it('is false when the other tag still exists (not tombstoned)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', { id: 'other-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true } as never)
    expect(await isVaultConflictResolved(d, 'other-tag')).toBe(false)
  })

  it('is true once the other tag is tombstoned', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', {
      id: 'other-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 2, theme: null,
      isPrivateVault: true, isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z',
    } as never)
    expect(await isVaultConflictResolved(d, 'other-tag')).toBe(true)
  })

  it('is false when the other tag has never existed locally yet', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await isVaultConflictResolved(d, 'never-seen-tag')).toBe(false)
  })
})

describe('mergeIntoOtherVault', () => {
  it('re-encrypts every bookmark tagged with the local Private tag under the other vault\'s public key, retags it, and retires the local vault + tag', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const otherVault = await (async () => {
      // Build a second, independent vault purely to get a real key pair/record
      // shape to merge into — done via a throwaway DB so its tagId/publicKey
      // are realistic, without needing a second real device in this test.
      const scratch = await initDB()
      const session = await createVault(scratch, 'other-tag', 'other-password', undefined)
      const record = await loadVaultRecord(scratch)
      scratch.close()
      return { record: record!, session }
    })()

    const localSession = await createVault(d, 'local-tag', 'local-password', undefined)
    await d.put('tags', {
      id: 'local-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true,
    } as never)
    await d.put('bookmarks', {
      id: 'bm-1', url: 'https://x.com', title: 'X', description: '', thumbnail: '', favicon: '',
      siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z', ogpStatus: 'fetched', tags: [],
    } as never)
    await addPrivateTag(d, 'bm-1', 'local-tag')

    await mergeIntoOtherVault(d, localSession, otherVault.record)

    const bookmark = (await d.get('bookmarks', 'bm-1')) as { tags: string[]; encryptedPayload?: unknown } | undefined
    expect(bookmark?.tags).toEqual(['other-tag'])
    expect(bookmark?.tags).not.toContain('local-tag')
    expect(bookmark?.encryptedPayload).toBeDefined()

    // The re-encrypted payload must actually be readable with the OTHER
    // vault's key — not just present. This is the test that would fail if
    // the wrong public key were used to re-encrypt.
    const { decryptWithPrivateKey } = await import('@/lib/private/crypto')
    const decrypted = await decryptWithPrivateKey<{ title: string }>(
      otherVault.session.privateKey, bookmark!.encryptedPayload as never,
    )
    expect(decrypted.title).toBe('X')

    // The local vault record is no longer simply absent after a merge — it
    // now points at the OTHER side's record, adopted immediately instead of
    // waiting for the next sync cycle to pull vault.json (see
    // mergeIntoOtherVault's final `db.put('settings', otherRecord)`).
    expect(await loadVaultRecord(d)).toEqual(otherVault.record)
    const localTag = await d.get('tags', 'local-tag')
    expect((localTag as { isDeleted?: boolean } | undefined)?.isDeleted).toBe(true)
  })
})

describe('retireVault', () => {
  it('deletes the local vault record', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await createVault(d, 'tag-1', 'password', undefined)
    expect(await loadVaultRecord(d)).not.toBeNull()
    await retireVault(d)
    expect(await loadVaultRecord(d)).toBeNull()
  })
})
