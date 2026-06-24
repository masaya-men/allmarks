import type { ThemeId } from './types'
import { THEME_REGISTRY, DEFAULT_THEME_ID, getThemeMeta } from './theme-registry'
import { isThemeUnlocked } from './theme-entitlement'

/** Map a persisted theme id to one we can actually render: unknown ids and
 *  paid-but-unlocked ids fall back to the default so a stale/locked config
 *  never leaves the board un-themed. */
export function resolveThemeId(
  stored: string | undefined,
  licenses: ReadonlySet<ThemeId>,
): ThemeId {
  if (stored && Object.prototype.hasOwnProperty.call(THEME_REGISTRY, stored)) {
    const id = stored as ThemeId
    if (isThemeUnlocked(getThemeMeta(id), licenses)) return id
  }
  return DEFAULT_THEME_ID
}
