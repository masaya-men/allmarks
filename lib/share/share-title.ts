export type ShareTitleConfig = {
  readonly enabled: boolean
  readonly text: string | null // null = 既定（絞り込み中のタグ名）を使う
  readonly size: number        // フォント px
  readonly x: number
  readonly y: number
}

export const TITLE_DEFAULT_PX = 120
export const TITLE_MIN_PX = 24
export const TITLE_MAX_PX = 800

export function defaultShareTitleConfig(enabled: boolean, viewportW: number, viewportH: number): ShareTitleConfig {
  return { enabled, text: null, size: TITLE_DEFAULT_PX, x: Math.round(viewportW / 2), y: Math.round(viewportH / 2) }
}

export function resolveTitleText(c: ShareTitleConfig, defaultText: string): string {
  if (!c.enabled) return ''
  return c.text === null ? defaultText : c.text
}

export function setTitleSize(c: ShareTitleConfig, next: number): ShareTitleConfig {
  return { ...c, size: Math.max(TITLE_MIN_PX, Math.min(TITLE_MAX_PX, next)) }
}

export function moveTitle(c: ShareTitleConfig, x: number, y: number): ShareTitleConfig {
  return { ...c, x, y }
}
