import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { createVault, loadVaultRecord, retireVault, type PrivateVaultRecord } from '@/lib/private/vault-store'
import { addPrivateTag } from '@/lib/private/apply-tag-change'
import {
  saveVaultConflict, loadVaultConflict, clearVaultConflict,
  isLocalVaultTarget, isVaultConflictResolved, mergeIntoOtherVault,
  findOtherPrivateVaultTagIds, anyOtherPrivateTagUnresolved,
  acknowledgeVaultConflict, findUnacknowledgedOtherPrivateVaultTagIds,
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

  it('throws before touching anything if the other vault\'s publicKey is malformed (fail-safe, not silent corruption)', async () => {
    // Guards against the scenario a security review raised: if the target's
    // record were corrupted/garbled in transit, this must fail loudly and
    // leave the source device's own vault/tags/bookmarks completely intact
    // and retryable — never silently "succeed" while producing content
    // nobody can ever decrypt. importPublicKey is called before any
    // mutation (see mergeIntoOtherVault's first line), so a malformed key
    // should throw immediately and nothing below it should ever run.
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const localSession = await createVault(d, 'local-tag', 'local-password', undefined)
    await d.put('tags', {
      id: 'local-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true,
    } as never)
    await d.put('bookmarks', {
      id: 'bm-1', url: 'https://x.com', title: 'X', description: '', thumbnail: '', favicon: '',
      siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z', ogpStatus: 'fetched', tags: [],
    } as never)
    await addPrivateTag(d, 'bm-1', 'local-tag')
    // addPrivateTag already encrypts under the LOCAL vault's own (real) key
    // at this point — capture that as the "untouched" baseline, since a
    // failed merge attempt below must leave this exact state alone, not
    // leave encryptedPayload undefined (which was never true to begin with).
    const before = (await d.get('bookmarks', 'bm-1')) as { tags: string[]; encryptedPayload?: unknown } | undefined
    expect(before?.encryptedPayload).toBeDefined()

    const malformedOther: PrivateVaultRecord = {
      key: 'private-vault', tagId: 'other-tag', salt: 's', iterations: 600000,
      // Valid base64 (so atob() itself doesn't throw) but not a valid
      // DER-encoded SPKI structure, so crypto.subtle.importKey rejects it
      // at the ASN.1-parsing stage — this is the failure mode a corrupted
      // (not merely garbled-in-transit-as-text) record would hit.
      publicKey: btoa('this is definitely not a real DER-encoded SPKI public key'),
      wrappedPrivateKey: { iv: 'iv', ciphertext: 'ct' },
    }
    await expect(mergeIntoOtherVault(d, localSession, malformedOther)).rejects.toThrow()

    const after = (await d.get('bookmarks', 'bm-1')) as { tags: string[]; encryptedPayload?: unknown } | undefined
    expect(after?.tags).toEqual(['local-tag'])
    expect(after?.encryptedPayload).toEqual(before?.encryptedPayload)
    const localTag = await d.get('tags', 'local-tag')
    expect((localTag as { isDeleted?: boolean } | undefined)?.isDeleted).toBeUndefined()
    const stillLocal = await loadVaultRecord(d)
    expect(stillLocal?.tagId).toBe('local-tag')
  })
})

describe('findOtherPrivateVaultTagIds', () => {
  it('returns every isPrivateVault tag id except myTagId', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', { id: 'my-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true } as never)
    await d.put('tags', { id: 'other-tag', name: 'Private', color: '#000', order: 1, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true } as never)
    expect(await findOtherPrivateVaultTagIds(d, 'my-tag')).toEqual(['other-tag'])
  })

  it('ignores non-Private tags entirely', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', { id: 'my-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true } as never)
    await d.put('tags', { id: 'ordinary-tag', name: 'Recipes', color: '#111', order: 1, createdAt: 1, updatedAt: 1, theme: null } as never)
    expect(await findOtherPrivateVaultTagIds(d, 'my-tag')).toEqual([])
  })

  it('returns an empty array when no other Private tag exists', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', { id: 'my-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true } as never)
    expect(await findOtherPrivateVaultTagIds(d, 'my-tag')).toEqual([])
  })

  it('STILL sees the other tag after it is tombstoned (the whole point of reading the raw store)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', { id: 'my-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true } as never)
    await d.put('tags', {
      id: 'other-tag', name: 'Private', color: '#000', order: 1, createdAt: 1, updatedAt: 2, theme: null,
      isPrivateVault: true, isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z',
    } as never)
    expect(await findOtherPrivateVaultTagIds(d, 'my-tag')).toEqual(['other-tag'])
  })
})

describe('anyOtherPrivateTagUnresolved', () => {
  it('is true when the other tag exists and is not tombstoned', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', {
      id: 'other-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true,
    } as never)
    expect(await anyOtherPrivateTagUnresolved(d, ['other-tag'])).toBe(true)
  })

  it('is false once the other tag is tombstoned', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', {
      id: 'other-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 2, theme: null,
      isPrivateVault: true, isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z',
    } as never)
    expect(await anyOtherPrivateTagUnresolved(d, ['other-tag'])).toBe(false)
  })

  it('is true when at least one of several ids is still unresolved', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', {
      id: 'resolved-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 2, theme: null,
      isPrivateVault: true, isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z',
    } as never)
    await d.put('tags', {
      id: 'unresolved-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true,
    } as never)
    expect(await anyOtherPrivateTagUnresolved(d, ['resolved-tag', 'unresolved-tag'])).toBe(true)
  })

  it('is false for an empty id list', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await anyOtherPrivateTagUnresolved(d, [])).toBe(false)
  })
})

describe('acknowledgeVaultConflict / findUnacknowledgedOtherPrivateVaultTagIds', () => {
  it('returns the same as findOtherPrivateVaultTagIds when nothing has been acknowledged yet', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', { id: 'my-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true } as never)
    await d.put('tags', {
      id: 'other-tag', name: 'Private', color: '#000', order: 1, createdAt: 1, updatedAt: 2, theme: null,
      isPrivateVault: true, isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z',
    } as never)
    expect(await findUnacknowledgedOtherPrivateVaultTagIds(d, 'my-tag')).toEqual(await findOtherPrivateVaultTagIds(d, 'my-tag'))
    expect(await findUnacknowledgedOtherPrivateVaultTagIds(d, 'my-tag')).toEqual(['other-tag'])
  })

  it('no longer includes a tag id once it has been acknowledged', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', { id: 'my-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true } as never)
    await d.put('tags', {
      id: 'other-tag', name: 'Private', color: '#000', order: 1, createdAt: 1, updatedAt: 2, theme: null,
      isPrivateVault: true, isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z',
    } as never)
    await acknowledgeVaultConflict(d, 'other-tag')
    expect(await findUnacknowledgedOtherPrivateVaultTagIds(d, 'my-tag')).toEqual([])
    // The raw (unfiltered) view must still see it — acknowledgment is a
    // separate signal, not a mutation of the tag record itself.
    expect(await findOtherPrivateVaultTagIds(d, 'my-tag')).toEqual(['other-tag'])
  })

  it('acknowledging one other tag id does not affect a different other tag id still being reported', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', { id: 'my-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true } as never)
    await d.put('tags', {
      id: 'acked-tag', name: 'Private', color: '#000', order: 1, createdAt: 1, updatedAt: 2, theme: null,
      isPrivateVault: true, isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z',
    } as never)
    await d.put('tags', {
      id: 'unacked-tag', name: 'Private', color: '#000', order: 2, createdAt: 1, updatedAt: 2, theme: null,
      isPrivateVault: true, isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z',
    } as never)
    await acknowledgeVaultConflict(d, 'acked-tag')
    expect(await findUnacknowledgedOtherPrivateVaultTagIds(d, 'my-tag')).toEqual(['unacked-tag'])
  })

  it('acknowledging the same tag id twice does not duplicate it in the stored record', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await acknowledgeVaultConflict(d, 'other-tag')
    await acknowledgeVaultConflict(d, 'other-tag')
    const record = (await d.get('settings', 'private-vault-conflict-acknowledged')) as { tagIds: string[] } | undefined
    expect(record?.tagIds).toEqual(['other-tag'])
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
