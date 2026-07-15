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
      themeId: 'flat',
    }
    await saveBoardConfig(db, saved)
    const loaded = await loadBoardConfig(db)
    expect(loaded).toEqual(saved)
  })

  it('migrates the retired grid-paper theme to Sound Wave, carrying the grid into that slot', async () => {
    // Simulate an old saved config that still names the removed theme.
    await saveBoardConfig(db, { ...DEFAULT_BOARD_CONFIG, themeId: 'grid-paper' } as unknown as BoardConfig)
    const loaded = await loadBoardConfig(db)
    expect(loaded.themeId).toBe('dotted-notebook')
    // Sound Wave now carries the classic grid so the board stays the same.
    expect(loaded.themeCustomizations?.['dotted-notebook']).toEqual({
      boardColor: '#0e0e11',
      patternType: 'grid',
      patternColor: 'rgba(255, 255, 255, 0.18)',
      patternSize: 40,
      patternStroke: 1,
    })
    // The retired key is not left dangling.
    expect((loaded.themeCustomizations as Record<string, unknown>)?.['grid-paper']).toBeUndefined()
  })

  it("carries a grid-paper user's own customization into the Sound Wave slot", async () => {
    const tweaked = { boardColor: '#111111', patternType: 'dots' as const, patternSize: 24 }
    await saveBoardConfig(db, {
      ...DEFAULT_BOARD_CONFIG,
      themeId: 'grid-paper',
      themeCustomizations: { 'grid-paper': tweaked },
    } as unknown as BoardConfig)
    const loaded = await loadBoardConfig(db)
    expect(loaded.themeId).toBe('dotted-notebook')
    expect(loaded.themeCustomizations?.['dotted-notebook']).toEqual(tweaked)
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
