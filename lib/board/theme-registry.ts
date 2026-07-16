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
    chromeMotion: 'signature',
    motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' },
  },
  // Flat sits second (user-chosen order): Sound Wave → Flat → Paper.
  flat: {
    id: 'flat',
    direction: 'vertical',
    backgroundClassName: 'flat',
    labelKey: 'board.theme.flat',
    colorScheme: 'light',
    tier: 'free',
    kind: 'pattern',
    scrollMeterVariant: 'line',
    chromeMotion: 'quiet',
    motion: { entry: 'fade', text: 'quiet', shutdown: 'fade' },
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
    chromeMotion: 'quiet',
    motion: { entry: 'paper-drift', text: 'ink-underline', shutdown: 'paper-fade' },
    decorations: true,
  },
}

export const DEFAULT_THEME_ID: ThemeId = 'dotted-notebook'

export function getThemeMeta(id: ThemeId): ThemeMeta {
  return THEME_REGISTRY[id]
}

export function listThemeIds(): ReadonlyArray<ThemeId> {
  return Object.keys(THEME_REGISTRY) as ThemeId[]
}
