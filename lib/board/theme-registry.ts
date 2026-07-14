import type { ThemeId, ThemeMeta } from './types'

export const THEME_REGISTRY: Record<ThemeId, ThemeMeta> = {
  'dotted-notebook': {
    id: 'dotted-notebook',
    direction: 'vertical',
    backgroundClassName: 'dottedNotebook',
    labelKey: 'board.theme.dottedNotebook',
    colorScheme: 'dark',
    tier: 'free',
    kind: 'pattern',
    scrollMeterVariant: 'waveform',
    motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' },
  },
  'grid-paper': {
    id: 'grid-paper',
    direction: 'vertical',
    backgroundClassName: 'gridPaper',
    labelKey: 'board.theme.gridPaper',
    colorScheme: 'dark',
    tier: 'free',
    kind: 'pattern',
    scrollMeterVariant: 'waveform',
    motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' },
  },
  'paper-atelier': {
    id: 'paper-atelier',
    direction: 'vertical',
    backgroundClassName: 'paperAtelier',
    labelKey: 'board.theme.paperAtelier',
    colorScheme: 'light',
    tier: 'free',
    kind: 'work',
    scrollMeterVariant: 'ruler',
    motion: { entry: 'paper-drift', text: 'ink-underline', shutdown: 'paper-fade' },
    decorations: true,
  },
  flat: {
    id: 'flat',
    direction: 'vertical',
    backgroundClassName: 'flat',
    labelKey: 'board.theme.flat',
    colorScheme: 'light',
    tier: 'free',
    kind: 'pattern',
    scrollMeterVariant: 'line',
    motion: { entry: 'fade', text: 'default', shutdown: 'fade' },
  },
}

export const DEFAULT_THEME_ID: ThemeId = 'dotted-notebook'

export function getThemeMeta(id: ThemeId): ThemeMeta {
  return THEME_REGISTRY[id]
}

export function listThemeIds(): ReadonlyArray<ThemeId> {
  return Object.keys(THEME_REGISTRY) as ThemeId[]
}
