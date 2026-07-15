/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
import type { IDBPDatabase } from 'idb'
import type { BoardConfig, ThemeCustomization } from '@/lib/board/types'
import { BOARD_FILTER_ALL } from '@/lib/board/board-filter-helpers'
import { DEFAULT_THEME_ID } from '@/lib/board/theme-registry'
import { GRID_MIGRATION_CUSTOMIZATION } from '@/lib/board/theme-customization'
import { DEFAULT_PRESET_ID } from '@/lib/board/frame-presets'

/** The retired standalone Grid theme's id (removed from ThemeId). Typed as a bare
 *  string so we can still recognise it in old saved configs (ThemeId no longer
 *  overlaps it) and migrate it. */
const RETIRED_GRID_THEME_ID: string = 'grid-paper'

/** Migrate a config whose saved theme was the retired Grid: point it at Sound
 *  Wave (dotted-notebook) and carry the grid look into that slot so the board
 *  stays pixel-identical. Prefer the user's own grid-paper tweaks if present;
 *  otherwise the classic grid. Idempotent — a non-grid config passes through. */
function migrateRetiredGridTheme(config: BoardConfig): BoardConfig {
  if (config.themeId !== RETIRED_GRID_THEME_ID) return config
  const customs = { ...(config.themeCustomizations ?? {}) } as Record<string, ThemeCustomization>
  const carried = customs[RETIRED_GRID_THEME_ID] ?? GRID_MIGRATION_CUSTOMIZATION
  customs['dotted-notebook'] = carried
  delete customs[RETIRED_GRID_THEME_ID]
  return { ...config, themeId: 'dotted-notebook', themeCustomizations: customs }
}

const CONFIG_KEY = 'board-config'

export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  frameRatio: { kind: 'preset', presetId: DEFAULT_PRESET_ID },
  themeId: DEFAULT_THEME_ID,
  displayMode: 'visual',
  activeFilter: BOARD_FILTER_ALL,
  motionEnabled: true,
  bgTypoEnabled: true,
  roundedCorners: true,
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type ConfigRecord = { key: string; config: BoardConfig }

export async function loadBoardConfig(db: DbLike): Promise<BoardConfig> {
  const record = (await db.get('settings', CONFIG_KEY)) as ConfigRecord | undefined
  const merged = { ...DEFAULT_BOARD_CONFIG, ...(record?.config ?? {}) }
  // Remap the retired Grid theme BEFORE anything reads themeId (getThemeMeta would
  // throw on 'grid-paper' now that it's gone from the registry).
  return migrateRetiredGridTheme(merged)
}

export async function saveBoardConfig(db: DbLike, config: BoardConfig): Promise<void> {
  const record: ConfigRecord = { key: CONFIG_KEY, config }
  await db.put('settings', record)
}
