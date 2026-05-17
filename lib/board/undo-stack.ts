/**
 * In-memory undo / redo stack types for board-level mutations.
 *
 * Stored as a discriminated union so the BoardRoot's apply switch is
 * exhaustive (TypeScript will flag a missing case). The stack itself is
 * just an array of entries with a hard size cap — old entries fall off
 * the head once the cap is hit, matching how every desktop editor
 * truncates undo history.
 */

export const MAX_UNDO_STACK = 30

export type UndoEntry =
  | {
      readonly kind: 'reorder'
      /** Pre-action order: id → orderIndex pairs for every bookmark whose
       *  index changed. Sort by orderIndex on apply to reproduce. */
      readonly prev: ReadonlyArray<{
        readonly id: string
        readonly orderIndex: number
      }>
    }
  | { readonly kind: 'delete'; readonly bookmarkId: string }
  | {
      readonly kind: 'resize'
      readonly bookmarkId: string
      /** Width to restore on undo. */
      readonly prevWidth: number
      /** Whether the pre-action width was a user-set custom width. If
       *  false, undo means "clear the override" (back to size-slider
       *  default), not "set this exact width". */
      readonly prevCustom: boolean
    }
  | { readonly kind: 'add'; readonly bookmarkIds: readonly string[] }
  | { readonly kind: 'cardWidth'; readonly prevWidthPx: number }
  | { readonly kind: 'cardGap'; readonly prevGapPx: number }

export function pushBounded<T>(
  stack: readonly T[],
  entry: T,
  max: number = MAX_UNDO_STACK,
): readonly T[] {
  if (stack.length < max) return [...stack, entry]
  // Drop the oldest entry (head) to make room.
  return [...stack.slice(1), entry]
}
