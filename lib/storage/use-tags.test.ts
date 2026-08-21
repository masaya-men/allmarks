import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { IDBPDatabase } from 'idb'
import { initDB, type AllMarksDB } from './indexeddb'
import { addTag } from './tags'
import { useTags } from './use-tags'
import { setPrivateVaultSession } from '@/lib/private/vault-session'

const fakeKey = {} as CryptoKey

let db: IDBPDatabase<AllMarksDB> | null = null

beforeEach(async () => {
  // 前テストの残骸を全消去 (= fake-indexeddb は process 内 persistent)
  const databases = await indexedDB.databases()
  for (const info of databases) {
    if (info.name) indexedDB.deleteDatabase(info.name)
  }
})

afterEach(() => {
  setPrivateVaultSession(null)
  if (db) {
    db.close()
    db = null
  }
})

describe('useTags — Private vault filtering', () => {
  it('excludes the Private tag from the returned list while locked, includes it while unlocked', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<AllMarksDB>
    await addTag(database, { name: 'normal', color: '#fff', order: 0 })
    const privateTag = await addTag(database, { name: 'Private', color: '#000', order: 1, isPrivateVault: true })

    const { result, unmount } = renderHook(() => useTags())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.tags).toHaveLength(1)

    act(() => {
      setPrivateVaultSession({ tagId: privateTag.id, key: fakeKey })
    })
    expect(result.current.tags).toHaveLength(2)

    act(() => {
      setPrivateVaultSession(null)
    })
    expect(result.current.tags).toHaveLength(1)
    unmount()
  })

  it('privateTagId is stable regardless of lock state (the bug this task must not reintroduce)', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<AllMarksDB>
    const privateTag = await addTag(database, { name: 'Private', color: '#000', order: 0, isPrivateVault: true })

    const { result, unmount } = renderHook(() => useTags())
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Locked — privateTagId must still resolve (this is the whole point of the task).
    expect(result.current.privateTagId).toBe(privateTag.id)

    act(() => {
      setPrivateVaultSession({ tagId: privateTag.id, key: fakeKey })
    })
    // Unlocked — must be the exact same id, unchanged by lock state.
    expect(result.current.privateTagId).toBe(privateTag.id)
    unmount()
  })

  it('privateTagId is null when no Private tag has been created yet', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<AllMarksDB>
    await addTag(database, { name: 'normal', color: '#fff', order: 0 })

    const { result, unmount } = renderHook(() => useTags())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.privateTagId).toBeNull()
    unmount()
  })
})
