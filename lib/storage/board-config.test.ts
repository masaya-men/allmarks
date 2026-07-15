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

  it("carries a grid-paper user's own customization into the Sound Wave slot (base-merged onto the grid)", async () => {
    const tweaked = { boardColor: '#111111', patternType: 'dots' as const, patternSize: 24 }
    await saveBoardConfig(db, {
      ...DEFAULT_BOARD_CONFIG,
      themeId: 'grid-paper',
      themeCustomizations: { 'grid-paper': tweaked },
    } as unknown as BoardConfig)
    const loaded = await loadBoardConfig(db)
    expect(loaded.themeId).toBe('dotted-notebook')
    // their tweaks win; untouched fields keep the grid look (not Sound Wave defaults)
    expect(loaded.themeCustomizations?.['dotted-notebook']).toEqual({
      boardColor: '#111111', // user
      patternType: 'dots', // user
      patternColor: 'rgba(255, 255, 255, 0.18)', // grid base
      patternSize: 24, // user
      patternStroke: 1, // grid base
    })
  })

  it('a PARTIAL grid-paper tweak (only pattern colour) still keeps the grid — untouched fields fall back to the grid, not to Sound Wave', async () => {
    await saveBoardConfig(db, {
      ...DEFAULT_BOARD_CONFIG,
      themeId: 'grid-paper',
      themeCustomizations: { 'grid-paper': { patternColor: '#ff0000' } },
    } as unknown as BoardConfig)
    const loaded = await loadBoardConfig(db)
    const c = loaded.themeCustomizations?.['dotted-notebook']
    expect(c?.patternType).toBe('grid') // NOT 'none' — the grid survives
    expect(c?.boardColor).toBe('#0e0e11') // grid board, not Sound Wave's #0a0a0a
    expect(c?.patternColor).toBe('#ff0000') // the user's tweak applied
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
