import type { ThemeId, ThemeMeta } from './types'

/** No licenses are issued yet. The real key entry/validation is a later
 *  session; this receiver only needs the shape so the picker can render a
 *  lock and the wiring exists end-to-end. */
export const EMPTY_LICENSES: ReadonlySet<ThemeId> = new Set<ThemeId>()

/** Whether a theme may be applied. Free themes always; paid themes only when
 *  their id appears in the (currently always-empty) license set. */
export function isThemeUnlocked(meta: ThemeMeta, licenses: ReadonlySet<ThemeId>): boolean {
  return meta.tier === 'free' || licenses.has(meta.id)
}
