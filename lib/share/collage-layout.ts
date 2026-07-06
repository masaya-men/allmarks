import { computeSkylineLayout } from '@/lib/board/skyline-layout'
import type { CardPosition } from '@/lib/board/types'

/** 自由配置キャンバスの1要素の実測サイズ（初期詰め込みに使う）。 */
export type CollageElement = { readonly id: string; readonly width: number; readonly height: number }
/** id → 現在の自由配置座標。CardPosition = {x,y,w,h}。 */
export type CollagePositions = Readonly<Record<string, CardPosition>>

/** リサイズ下限。既存 size-migration の MIN_CARD_WIDTH と同値（80px）。 */
export const COLLAGE_MIN_WIDTH_PX = 80

/** 選択カードを skyline で1回だけ詰め、その配置を自由配置の初期値にする。 */
export function seedCollagePositions(
  cards: readonly CollageElement[],
  containerWidth: number,
  gap: number,
): CollagePositions {
  const { positions } = computeSkylineLayout({
    cards: cards.map((c) => ({ id: c.id, width: c.width, height: c.height })),
    containerWidth,
    gap,
  })
  return { ...positions }
}

/** 要素を絶対座標へ移動（サイズ不変）。未知 id は同一参照を返す。 */
export function moveElement(positions: CollagePositions, id: string, x: number, y: number): CollagePositions {
  const p = positions[id]
  if (!p) return positions
  return { ...positions, [id]: { ...p, x, y } }
}

/** 幅を変えて高さをアスペクト維持で追従（下限クランプ）。未知 id は同一参照。 */
export function resizeElement(positions: CollagePositions, id: string, nextWidth: number): CollagePositions {
  const p = positions[id]
  if (!p) return positions
  const aspect = p.w / p.h
  const w = Math.max(COLLAGE_MIN_WIDTH_PX, nextWidth)
  const h = w / aspect
  return { ...positions, [id]: { ...p, w, h } }
}

/** 重なり順配列で id を最前面（末尾）へ。未知 id は複製を返す。 */
export function bringToFront(order: readonly string[], id: string): string[] {
  if (!order.includes(id)) return [...order]
  return [...order.filter((x) => x !== id), id]
}
