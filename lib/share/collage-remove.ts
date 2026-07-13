import type { CardPosition } from '@/lib/board/types'
import type { CollagePositions } from './collage-layout'

/** コラージュの3マップ（位置・重なり順・回転）から id を除いた新オブジェクトを返す。
 *  元は変えない。order から消えるので撮影対象からも外れる。未知 id は値の等しい新オブジェクト。 */
export function removeFromCollage(
  positions: CollagePositions,
  order: readonly string[],
  rotations: Readonly<Record<string, number>>,
  id: string,
): { positions: CollagePositions; order: string[]; rotations: Record<string, number> } {
  const nextPositions: Record<string, CardPosition> = {}
  for (const key of Object.keys(positions)) {
    if (key !== id) {
      const p = positions[key]
      if (p) nextPositions[key] = p
    }
  }
  const nextRotations: Record<string, number> = {}
  for (const key of Object.keys(rotations)) {
    if (key !== id) {
      const r = rotations[key]
      if (r !== undefined) nextRotations[key] = r
    }
  }
  return { positions: nextPositions, order: order.filter((x) => x !== id), rotations: nextRotations }
}
