import { describe, it, expect, beforeEach } from 'vitest'
import { loadBoardConfig, saveBoardConfig, DEFAULT_BOARD_CONFIG } from './board-config'
import type { BoardConfig } from '@/lib/board/types'

// Minimal in-memory fake for SettingsRecord store
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function makeFakeDb(): any {
  const store = new Map<string, unknown>()
  return {
    get: async (_name: string, key: string) => store.get(key),
    put: async (_name: string, value: any) => { store.set(value.key, value); return value.key },
  }
}

describe('board config storage', () => {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  let db: any
  beforeEach(() => { db = makeFakeDb() })

  it('returns default when nothing saved', async () => {
    const cfg = await loadBoardConfig(db)
    expect(cfg).toEqual(DEFAULT_BOARD_CONFIG)
  })

  it('round-trips saved config', async () => {
    const saved: BoardConfig = {
      ...DEFAULT_BOARD_CONFIG,
      frameRatio: { kind: 'preset', presetId: 'story-reels' },
      themeId: 'grid-paper',
    }
    await saveBoardConfig(db, saved)
    const loaded = await loadBoardConfig(db)
    expect(loaded).toEqual(saved)
  })

  it('persists motionEnabled', async () => {
    let loaded = await loadBoardConfig(db)
    expect(loaded.motionEnabled).toBe(true)

    const modified: BoardConfig = {
      ...loaded,
      motionEnabled: false,
    }
    await saveBoardConfig(db, modified)
    loaded = await loadBoardConfig(db)
    expect(loaded.motionEnabled).toBe(false)
  })

  it('defaults roundedCorners to true and round-trips it', async () => {
    let loaded = await loadBoardConfig(db)
    expect(loaded.roundedCorners).toBe(true)

    await saveBoardConfig(db, { ...loaded, roundedCorners: false })
    loaded = await loadBoardConfig(db)
    expect(loaded.roundedCorners).toBe(false)
  })
})
