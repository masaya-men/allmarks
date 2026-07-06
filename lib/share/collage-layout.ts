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

/** 幅を変えて高さをアスペクト維持で追従（下限クランプ）。左上固定。未知 id は同一参照。 */
export function resizeElement(positions: CollagePositions, id: string, nextWidth: number): CollagePositions {
  const p = positions[id]
  if (!p) return positions
  const aspect = p.w / p.h
  const w = Math.max(COLLAGE_MIN_WIDTH_PX, nextWidth)
  const h = w / aspect
  return { ...positions, [id]: { ...p, w, h } }
}

/** 掴んだ隅（4隅）。 */
export type CollageResizeCorner = 'tl' | 'tr' | 'bl' | 'br'

/**
 * 幅を変えつつ「掴んだ隅の対角の隅」を固定して x/y も動かす（自由配置で
 * 掴んだ隅がカーソルに付いてくる自然なリサイズ）。高さはアスペクト維持で追従、
 * 幅は下限クランプ。未知 id は同一参照。
 * - BR を掴む → TL 固定（x/y 不変）
 * - TL を掴む → BR 固定 / TR → BL 固定 / BL → TR 固定
 */
export function resizeElementFromCorner(
  positions: CollagePositions,
  id: string,
  corner: CollageResizeCorner,
  nextWidth: number,
): CollagePositions {
  const p = positions[id]
  if (!p) return positions
  const aspect = p.w / p.h
  const w = Math.max(COLLAGE_MIN_WIDTH_PX, nextWidth)
  const h = w / aspect
  // 左の隅（tl/bl）を掴む＝右辺を固定して左辺を動かす → x を差分だけずらす。
  // 上の隅（tl/tr）を掴む＝下辺を固定して上辺を動かす → y を差分だけずらす。
  const x = corner === 'tl' || corner === 'bl' ? p.x + (p.w - w) : p.x
  const y = corner === 'tl' || corner === 'tr' ? p.y + (p.h - h) : p.y
  return { ...positions, [id]: { x, y, w, h } }
}

/** 重なり順配列で id を最前面（末尾）へ。未知 id は複製を返す。 */
export function bringToFront(order: readonly string[], id: string): string[] {
  if (!order.includes(id)) return [...order]
  return [...order.filter((x) => x !== id), id]
}

/** アレンジで使える安全領域（画面px矩形）。上部クロム／下部 ShareToast に潜らせない。 */
export type CollageFitRect = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * 選択カード（自然サイズ）を skyline で詰め、rect の高さに収まる「最大倍率」を
 * 二分探索して全体を一律縮小し、rect 内に中央寄せで配置した座標を返す。
 * - 倍率の上限は 1（数枚なら盤面と同じ大きさ・膨らませない）。
 * - 収まる中で最大の倍率を採用（横幅いっぱいを使い、縦が rect.height に収まる最大）。
 * - 80px 下限は適用しない（自動配置は「全部1画面に収める」を優先）。
 * - 空 / 幅ゼロ / 高さゼロ は {} を返す。
 */
export function fitSelectionToScreen(
  cards: readonly CollageElement[],
  rect: CollageFitRect,
  gap: number,
): CollagePositions {
  if (cards.length === 0 || rect.width <= 0 || rect.height <= 0) return {}

  const packAt = (scale: number): ReturnType<typeof computeSkylineLayout> =>
    computeSkylineLayout({
      cards: cards.map((c) => ({ id: c.id, width: c.width * scale, height: c.height * scale })),
      containerWidth: rect.width,
      gap: gap * scale,
    })

  // 上限は 1（膨らませない）。自然サイズで収まればそのまま使う。
  let scale = 1
  if (packAt(1).totalHeight > rect.height) {
    // scale が大きいほど totalHeight は増える（単調）＝収まる最大倍率を二分探索。
    let lo = 0
    let hi = 1
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (packAt(mid).totalHeight <= rect.height) lo = mid
      else hi = mid
    }
    scale = lo
  }

  const packed = packAt(scale)
  // 実際に使った幅・高さを測り rect 内に中央寄せ。
  let contentW = 0
  let contentH = 0
  for (const id in packed.positions) {
    const p = packed.positions[id]
    if (p.x + p.w > contentW) contentW = p.x + p.w
    if (p.y + p.h > contentH) contentH = p.y + p.h
  }
  const offsetX = rect.x + Math.max(0, (rect.width - contentW) / 2)
  const offsetY = rect.y + Math.max(0, (rect.height - contentH) / 2)

  const out: Record<string, CardPosition> = {}
  for (const id in packed.positions) {
    const p = packed.positions[id]
    out[id] = { x: p.x + offsetX, y: p.y + offsetY, w: p.w, h: p.h }
  }
  return out
}
