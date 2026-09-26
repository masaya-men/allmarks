import type { Pt } from './types'

export function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x }
/** 見本の eio(3次の ease-in-out)。 */
export function eio(t: number): number { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
/** f が a→b を進む割合(ease 済み・範囲外は 0/1)。 */
export function E(f: number, a: number, b: number): number { return eio(clamp01((f - a) / (b - a))) }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }

export type Waypoint = readonly [t: number, x: number, y: number]
/** 時刻 t における通過点列上の位置(区間ごとに eio で補間)。 */
export function wp(t: number, pts: readonly Waypoint[]): Pt {
  const first = pts[0]
  if (t <= first[0]) return { x: first[1], y: first[2] }
  for (let k = 1; k < pts.length; k++) {
    const b = pts[k]
    if (t <= b[0]) {
      const a = pts[k - 1]
      const u = eio((t - a[0]) / (b[0] - a[0]))
      return { x: a[1] + (b[1] - a[1]) * u, y: a[2] + (b[2] - a[2]) * u }
    }
  }
  const last = pts[pts.length - 1]
  return { x: last[1], y: last[2] }
}
/** クリックの押し込み表示の窓(tc の少し前から少し後まで)。 */
export function isPress(t: number, tc: number): boolean { return t >= tc - 0.012 && t < tc + 0.03 }
