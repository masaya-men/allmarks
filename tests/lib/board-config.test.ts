import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { DEFAULT_BOARD_CONFIG, loadBoardConfig, saveBoardConfig } from '@/lib/storage/board-config'
import { BOARD_FILTER_ALL, BOARD_FILTER_INBOX, makeTagsFilter } from '@/lib/board/board-filter-helpers'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) {
    if (info.name) indexedDB.deleteDatabase(info.name)
  }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('BoardConfig v9 extensions', () => {
  it('defaults include displayMode=visual and activeFilter=ALL object', () => {
    expect(DEFAULT_BOARD_CONFIG.displayMode).toBe('visual')
    expect(DEFAULT_BOARD_CONFIG.activeFilter).toEqual({ kind: 'all' })
  })

  it('round-trips displayMode and activeFilter', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await saveBoardConfig(d, {
      ...DEFAULT_BOARD_CONFIG,
      displayMode: 'editorial',
      activeFilter: BOARD_FILTER_INBOX,
    })
    const loaded = await loadBoardConfig(d)
    expect(loaded.displayMode).toBe('editorial')
    expect(loaded.activeFilter).toEqual(BOARD_FILTER_INBOX)
  })

  it('round-trips tags filter (v16 object form)', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await saveBoardConfig(d, {
      ...DEFAULT_BOARD_CONFIG,
      activeFilter: makeTagsFilter(['abc123'], 'and'),
    })
    const loaded = await loadBoardConfig(d)
    expect(loaded.activeFilter).toEqual({ kind: 'tags', tagIds: ['abc123'], mode: 'and' })
  })

  it('default ALL filter survives round-trip', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await saveBoardConfig(d, DEFAULT_BOARD_CONFIG)
    const loaded = await loadBoardConfig(d)
    expect(loaded.activeFilter).toEqual(BOARD_FILTER_ALL)
  })
})
