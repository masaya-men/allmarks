// lib/board/marquee-select.ts — TAG MODE のラバーバンド（矩形ドラッグ）選択で使う
// 純粋な幾何ヘルパー。DOM 操作（querySelectorAll / getBoundingClientRect）は
// 呼び出し側（BoardRoot / InteractionLayer）の責務 — ここは座標の計算だけ。

export type Rect = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/** ポインタの始点・現在地（どちらの向きにドラッグしてもよい）から、
 *  left <= right / top <= bottom に正規化した矩形を作る。 */
export function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2),
  }
}

/** 2 つの矩形が(縁だけでなく面として)重なっているか。どちらかが幅/高さ 0 の
 *  退化した矩形（ドラッグ開始直後）は重ならない扱い。 */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

/** 矩形と交差するカードの bookmarkId だけを、渡された順序を保ったまま返す。
 *  purely a filter — 呼び出し側が DOM から集めた {id, rect} の一覧を渡す。 */
export function idsWithinRect(
  rect: Rect,
  cards: ReadonlyArray<{ readonly bookmarkId: string; readonly rect: Rect }>,
): string[] {
  return cards.filter((c) => rectsIntersect(rect, c.rect)).map((c) => c.bookmarkId)
}
