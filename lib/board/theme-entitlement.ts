import type { ThemeId, ThemeMeta } from './types'
import type { LicenseState } from './license-store'

/** No licenses are issued yet. The real key entry/validation is a later
 *  session; this receiver only needs the shape so the picker can render a
 *  lock and the wiring exists end-to-end. */
export const EMPTY_LICENSES: ReadonlySet<ThemeId> = new Set<ThemeId>()

/** Whether a theme may be applied. Free themes always; paid themes only when
 *  their id appears in the (currently always-empty) license set. */
export function isThemeUnlocked(meta: ThemeMeta, licenses: ReadonlySet<ThemeId>): boolean {
  return meta.tier === 'free' || licenses.has(meta.id)
}

/** 同期機能が解錠されているか。isThemeUnlockedと同じ土台に置く（設計
 *  device-sync-design.md §10）＝既にロードした状態を受け取るだけの純関数、
 *  自分ではIOしない。`state` はこの端末で一度もキーを発動していなければ null。 */
export function isSyncUnlocked(state: LicenseState | null): boolean {
  return state !== null && state.scope.includes('sync')
}
