import type { CollagePositions } from './collage-layout'

/** 編集 state のスナップショット（取り消し/やり直し用）。3マップの参照を保持する。
 *  state は毎編集ごとに新オブジェクトへ差し替わる（不変）ので参照保持で安全。 */
export type CollageSnapshot = {
  readonly positions: CollagePositions
  readonly order: readonly string[]
  readonly rotations: Readonly<Record<string, number>>
}

/** 履歴の上限（古いものから捨てる）。 */
export const MAX_COLLAGE_HISTORY = 40

/** 2つのスナップショットが「見た目上」等しいか（no-op を積まない判定）。
 *  order は順序含めて一致、positions/rotations は key 集合と各値の一致で比較。 */
export function snapshotsEqual(a: CollageSnapshot, b: CollageSnapshot): boolean {
  if (a === b) return true
  if (a.order.length !== b.order.length) return false
  for (let i = 0; i < a.order.length; i++) {
    if (a.order[i] !== b.order[i]) return false
  }
  const ka = Object.keys(a.positions)
  if (ka.length !== Object.keys(b.positions).length) return false
  for (const k of ka) {
    const va = a.positions[k]
    const vb = b.positions[k]
    if (!va || !vb) return false
    if (va.x !== vb.x || va.y !== vb.y || va.w !== vb.w || va.h !== vb.h) return false
  }
  const kra = Object.keys(a.rotations)
  if (kra.length !== Object.keys(b.rotations).length) return false
  for (const k of kra) {
    if (a.rotations[k] !== b.rotations[k]) return false
  }
  return true
}

/** stack に snap を積み、max を超えたら古いもの（先頭）から捨てた新配列を返す。 */
export function pushSnapshot(
  stack: readonly CollageSnapshot[],
  snap: CollageSnapshot,
  max: number,
): CollageSnapshot[] {
  const next = [...stack, snap]
  return next.length > max ? next.slice(next.length - max) : next
}
