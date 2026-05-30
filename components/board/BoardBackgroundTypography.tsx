'use client'

import type { BoardFilter } from '@/lib/board/types'
import type { TagRecord } from '@/lib/storage/indexeddb'
import styles from './BoardBackgroundTypography.module.css'

/**
 * Animation variants for the board's background typography layer.
 *
 * `'static'` is the only one wired up today — it renders the headline as a
 * plain, motionless white wordmark. Other names are reserved so future
 * motion experiments can be added by extending the CSS selectors on
 * `.host[data-variant=...]` (or by introducing a JS/canvas driver) without
 * having to refactor the host component or its wire-up in BoardRoot.
 *
 * Reserved variants:
 *   - 'dvd-bounce' — 4-corner pong like the classic idle-DVD screensaver
 *   - 'glitch'     — full-screen じじっじじっ chromatic-aberration / RGB flicker
 *   - 'multi'      — repeated copies tiled or scattered across the canvas
 *   - 'marquee'    — endless horizontal ticker
 *   - 'card-wind'  — physical jiggle reacting to nearby card motion
 */
export type BoardBgTypoVariant =
  | 'static'
  | 'dvd-bounce'
  | 'glitch'
  | 'multi'
  | 'marquee'
  | 'card-wind'

const VALID_VARIANTS: ReadonlySet<BoardBgTypoVariant> = new Set([
  'static',
  'dvd-bounce',
  'glitch',
  'multi',
  'marquee',
  'card-wind',
])

export function isBoardBgTypoVariant(value: string): value is BoardBgTypoVariant {
  return VALID_VARIANTS.has(value as BoardBgTypoVariant)
}

/**
 * Resolve the headline string shown by the background typography layer
 * for the current filter. Special filters get a fixed label; tag filters
 * expand to every active tag name joined by ` · ` so the wordmark mirrors
 * the multi-select state directly (session 82 — replaces the old
 * `name +N-1` chrome-mirroring abbreviation).
 *
 * The host CSS allows wrapping to two lines once the font hits its floor
 * (= clamp min), so a long sequence of tags soft-folds rather than
 * shrinking past the legible threshold.
 *
 * Returns an empty string when no tags resolve (= every id was deleted)
 * so the host hides itself.
 */
export function deriveBoardBgTypoText(
  filter: BoardFilter,
  tags: readonly TagRecord[],
): string {
  switch (filter.kind) {
    case 'all': return 'AllMarks'
    case 'inbox': return 'Inbox'
    case 'archive': return 'Archive'
    case 'dead': return 'Dead Links'
    case 'tags': {
      if (filter.tagIds.length === 0) return 'AllMarks'
      // タグ名は常に小文字で表示 (= ユーザーが付けた中身)。 'AllMarks' / 'Inbox' /
      // 'Dead Links' 等のアプリ枠ラベルは TitleCase のまま、 タグ名だけ小文字に揃える。
      const names = filter.tagIds
        .map((id) => tags.find((t) => t.id === id)?.name.toLowerCase())
        .filter((n): n is string => !!n)
      if (names.length === 0) return ''
      return names.join(' · ')
    }
  }
}

type Props = {
  readonly activeFilter: BoardFilter
  readonly tags: readonly TagRecord[]
  readonly variant?: BoardBgTypoVariant
}

export function BoardBackgroundTypography({
  activeFilter,
  tags,
  variant = 'static',
}: Props): React.ReactElement | null {
  const text = deriveBoardBgTypoText(activeFilter, tags)
  if (!text) return null

  return (
    <div
      className={styles.host}
      data-variant={variant}
      data-testid="board-bg-typography"
      aria-hidden="true"
    >
      <span className={styles.text}>{text}</span>
    </div>
  )
}
