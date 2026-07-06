import { computeSkylineLayout } from '@/lib/board/skyline-layout'
import { BOARD_SLIDERS } from '@/lib/board/constants'
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

/** justified fill の既定値（spec §3.2）。サイズ上限＝盤面既定カード幅、隙間比＝盤面の
 *  CARD_GAP:CARD_WIDTH 比。呼び出し側は基本 opts を渡さず、これらの既定で動く。 */
const DEFAULT_MAX_CARD_WIDTH = BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX
const DEFAULT_GAP_RATIO = BOARD_SLIDERS.CARD_GAP_DEFAULT_PX / BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX

/** fitSelectionToScreen の任意設定。既定は盤面の値（DEFAULT_*）。 */
export type FitOptions = {
  /** カードのレンダリング幅の上限（px）。既定＝盤面既定カード幅。 */
  readonly maxCardWidth?: number
  /** 隙間 ÷ カード高さ。既定＝盤面の CARD_GAP:CARD_WIDTH 比。 */
  readonly gapRatio?: number
}

/** 1行の確定レイアウト（行高・各カード幅・行内 gap・使用幅）。 */
type RowLayout = {
  readonly ids: readonly string[]
  readonly widths: readonly number[]
  readonly height: number
  readonly gap: number
  readonly rowWidth: number
}

/**
 * 目標行高 targetH でカードを justified rows に割る。document 順に行へ流し込み、
 * 目標高での自然幅が rectWidth に達したら行を閉じ、その行を rectWidth ちょうどに満たす
 * 行高（閉形）で確定する。最後の部分行は引き伸ばさず targetH。各行は「その行の最大幅
 * カードが maxCardWidth を超えない」よう行高を頭打ちする。総高（行高＋行間 gap の和）も返す。
 */
function layoutAtTargetHeight(
  ids: readonly string[],
  aspects: readonly number[],
  targetH: number,
  rectWidth: number,
  gapRatio: number,
  maxCardWidth: number,
): { readonly rows: RowLayout[]; readonly totalHeight: number } {
  const n = ids.length
  const rows: RowLayout[] = []
  let start = 0
  while (start < n) {
    // start から順に足し、目標高 targetH での自然幅が rectWidth に達したら閉じる。
    let end = start
    let aspectSum = 0
    let closed = false
    while (end < n) {
      aspectSum += aspects[end]
      const count = end - start + 1
      const naturalW = aspectSum * targetH + (count - 1) * gapRatio * targetH
      end++
      if (naturalW >= rectWidth) {
        closed = true
        break
      }
    }
    const rowIds = ids.slice(start, end)
    const rowAspects = aspects.slice(start, end)
    const count = rowIds.length
    const sumA = rowAspects.reduce((a, b) => a + b, 0)
    let maxA = 0
    for (const a of rowAspects) if (a > maxA) maxA = a
    // 閉じた（満杯）行は幅ちょうどの行高、最後の部分行は目標 targetH。
    const hFill = closed ? rectWidth / (sumA + (count - 1) * gapRatio) : targetH
    // per-row cap: 最大幅カード（maxA * h）が maxCardWidth を超えない行高に頭打ち。
    const h = Math.min(hFill, maxA > 0 ? maxCardWidth / maxA : maxCardWidth)
    const gap = gapRatio * h
    const widths = rowAspects.map((a) => a * h)
    const rowWidth = widths.reduce((a, b) => a + b, 0) + (count - 1) * gap
    rows.push({ ids: rowIds, widths, height: h, gap, rowWidth })
    start = end
  }
  let totalHeight = 0
  for (let i = 0; i < rows.length; i++) {
    totalHeight += rows[i].height
    if (i < rows.length - 1) totalHeight += rows[i].gap // 行間は上の行の gap
  }
  return { rows, totalHeight }
}

/**
 * 選択カードを justified rows で rect に充填する（spec §3）。
 * - カードは縦横比だけ使う（盤面の絶対サイズ＝customWidth は無視）。
 * - 各行を rect 幅いっぱいに揃え、目標行高 H を二分探索して総高を rect 高さに合わせる
 *   ＝右も下も端まで充填。H の上限は maxCardWidth（それ以上は per-row cap で頭打ち）。
 * - 幅を満たさない行（cap が効いた行・最後の部分行）は水平中央寄せ、総高の残余は垂直中央寄せ
 *   ＝少数カードは巨大化せず中央にまとまる（左上に固まらない）。
 * - 座標は rect.x/rect.y を加えた画面px絶対座標（移動/リサイズ/回転はこの座標系のまま）。
 * - 空 / 幅ゼロ / 高さゼロ は {} を返す。
 */
export function fitSelectionToScreen(
  cards: readonly CollageElement[],
  rect: CollageFitRect,
  opts?: FitOptions,
): CollagePositions {
  if (cards.length === 0 || rect.width <= 0 || rect.height <= 0) return {}
  const maxCardWidth = opts?.maxCardWidth ?? DEFAULT_MAX_CARD_WIDTH
  const gapRatio = opts?.gapRatio ?? DEFAULT_GAP_RATIO

  const ids = cards.map((c) => c.id)
  const aspects = cards.map((c) => (c.height > 0 ? c.width / c.height : 1))

  const build = (H: number): { readonly rows: RowLayout[]; readonly totalHeight: number } =>
    layoutAtTargetHeight(ids, aspects, H, rect.width, gapRatio, maxCardWidth)

  // 目標行高 H を選ぶ。総高は per-row cap と行分割の離散性のため H について単調でない
  // （＝二分探索は谷にはまり下側を大きく空ける）。そこで H を (0, maxCardWidth] で密にスキャンし、
  // rect.height に収まる中で総高が最大（＝最も埋まる）レイアウトを採る。build は O(n) と軽いので
  // スキャンで十分速い。極小 H の層は必ず収まるのでフォールバック下限になる。
  const STEPS = 240
  let chosen = build(maxCardWidth / STEPS)
  for (let i = 2; i <= STEPS; i++) {
    const laid = build((maxCardWidth * i) / STEPS)
    if (laid.totalHeight <= rect.height + 0.5 && laid.totalHeight > chosen.totalHeight) {
      chosen = laid
    }
  }

  // 縦方向の残余の扱い（spec §3.6）。justified rows は行数が離散なので、収まる最大の行数でも
  // 総高が rect.height に届かず下端が余ることがある。残余は行間に配分して上端→下端まで
  // ブリードさせ、下の帯を消す。ただし配分は「1行あたり平均行高まで」に頭打ちする＝行数が
  // 少ないとき（数枚を数行）に行が離れすぎてスカスカにならないようにし、配分しきれない残余は
  // 上下中央に置く。1行だけ（少数カード）は配分せず中央寄せ＝左上/上端に張り付かない。
  const rows = chosen.rows
  const residual = Math.max(0, rect.height - chosen.totalHeight)
  const gapsCount = rows.length - 1
  let extraRowGap = 0
  let offsetY = rect.y + residual / 2
  if (gapsCount >= 1 && residual > 0) {
    const avgRowHeight = rows.reduce((s, r) => s + r.height, 0) / rows.length
    extraRowGap = Math.min(residual / gapsCount, avgRowHeight)
    offsetY = rect.y + (residual - extraRowGap * gapsCount) / 2
  }

  const out: Record<string, CardPosition> = {}
  let y = offsetY
  for (const row of chosen.rows) {
    // 幅を満たさない行（cap／部分行）は水平中央寄せ。満杯行は rowWidth≈rect.width で offset≈0。
    const offsetX = rect.x + Math.max(0, (rect.width - row.rowWidth) / 2)
    let x = offsetX
    for (let i = 0; i < row.ids.length; i++) {
      const w = row.widths[i]
      out[row.ids[i]] = { x, y, w, h: row.height }
      x += w + row.gap
    }
    y += row.height + row.gap + extraRowGap
  }
  return out
}
