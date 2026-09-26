export type Slot = { x: number; y: number; h: number }
export type MasonryLayout = { cw: number; slots: Record<number, Slot> }

/** 見本の masonry: order の順に、いちばん低い列へ積む。a = 幅/高さ。 */
export function masonry(specs: readonly { a: number }[], order: readonly number[], W: number, cols: number, gap: number): MasonryLayout {
  const cw = (W - gap * (cols - 1)) / cols
  const hs: number[] = new Array(cols).fill(0)
  const slots: Record<number, Slot> = {}
  for (const id of order) {
    const c = hs.indexOf(Math.min(...hs))
    const h = cw / specs[id].a
    slots[id] = { x: c * (cw + gap), y: hs[c], h }
    hs[c] += h + gap
  }
  return { cw, slots }
}
