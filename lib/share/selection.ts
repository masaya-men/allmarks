// lib/share/selection.ts — selective-share (SELECT CARDS) の選択集合ロジック。
// UI から独立した純関数群。上限は共有ペイロードの MAX_CARDS と同じ値。
import { SHARE_LIMITS_V2 } from './types-v2'

export type SelectionToggleResult = {
  readonly ids: ReadonlySet<string>
  /** True when an add was refused (toggle) or truncated (addAll) by the cap. */
  readonly capped: boolean
}

export function toggleSelection(
  ids: ReadonlySet<string>,
  bookmarkId: string,
  max: number = SHARE_LIMITS_V2.MAX_CARDS,
): SelectionToggleResult {
  if (ids.has(bookmarkId)) {
    const next = new Set(ids)
    next.delete(bookmarkId)
    return { ids: next, capped: false }
  }
  if (ids.size >= max) return { ids, capped: true }
  const next = new Set(ids)
  next.add(bookmarkId)
  return { ids: next, capped: false }
}

export function addAllVisible(
  ids: ReadonlySet<string>,
  visibleIdsInBoardOrder: ReadonlyArray<string>,
  max: number = SHARE_LIMITS_V2.MAX_CARDS,
): SelectionToggleResult {
  const next = new Set(ids)
  let capped = false
  for (const id of visibleIdsInBoardOrder) {
    if (next.has(id)) continue
    if (next.size >= max) {
      capped = true
      break
    }
    next.add(id)
  }
  return { ids: next, capped }
}

/** 共有ペイロードは盤面順（新しい順）— クリック順ではない（spec §3）。 */
export function selectedInBoardOrder<T extends { readonly bookmarkId: string }>(
  itemsInBoardOrder: ReadonlyArray<T>,
  ids: ReadonlySet<string>,
): T[] {
  return itemsInBoardOrder.filter((it) => ids.has(it.bookmarkId))
}
