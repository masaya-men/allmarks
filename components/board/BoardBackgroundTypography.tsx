'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import type { BoardFilter, ThemeId } from '@/lib/board/types'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { getEntryAnimation } from '@/lib/animation/tag-entry'
import { getShutdownAnimationClass } from '@/lib/animation/tag-shutdown'
import { getThemeMeta } from '@/lib/board/theme-registry'
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
  /** When true, play the boot-up entry effect once on mount. Set true only for a
   *  user TITLE toggle; false on the initial page load so the wordmark is just
   *  there. Visibility itself is NOT driven by this — the parent mounts this
   *  component only when the title is on, so "rendered = visible" is absolute. */
  readonly playEntry?: boolean
  /** When true, play the CRT shutdown — the exact same effect a card runs when
   *  it drops out of a tag filter — once on the wordmark. The parent keeps this
   *  component mounted for the shutdown's fixed duration, then unmounts it on a
   *  timer; visibility is NEVER driven by the animation's finish event, so the
   *  "on but vanished" race cannot return. */
  readonly closing?: boolean
  /** The active board theme id. Selects which entry/shutdown motion the wordmark
   *  plays — the wordmark mirrors the card CRT/paper effects so the whole board
   *  speaks one motion language. paper-atelier → paper-drift / paper-fade;
   *  default themes → wave. */
  readonly themeId: ThemeId
}

/**
 * The big background wordmark. Reliability rule: this component is rendered by
 * the parent ONLY when the title should be visible (`{enabled && <... />}`), so
 * being mounted == being shown — full stop. The entry animation is a one-shot
 * decoration on mount (`fill: 'none'`, so it never holds a final state and can
 * never hide the wordmark). No visibility state, no exit-animation callbacks —
 * those were the source of the "on but vanished" races.
 */
export function BoardBackgroundTypography({
  activeFilter,
  tags,
  variant = 'static',
  playEntry = false,
  closing = false,
  themeId,
}: Props): ReactElement | null {
  const text = deriveBoardBgTypoText(activeFilter, tags)
  const textRef = useRef<HTMLSpanElement>(null)

  // One-shot entry on mount. Effects run after the element is committed, so the
  // target always exists (no rAF race). `fill: 'none'` means the wordmark snaps
  // back to its plain CSS state when the animation ends — it cannot get stuck
  // hidden. eslint-disable: intentionally mount-only.
  useEffect(() => {
    // Never play the entry while exiting (a fresh mount is always closing:false,
    // so this only guards the rare re-toggle-during-close reuse of this node).
    if (closing) return
    if (!playEntry) return
    const el = textRef.current
    if (!el) return
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      el.animate([{ opacity: '0' }, { opacity: '1' }], { duration: 180, easing: 'ease-out', fill: 'none' })
      return
    }
    const a = getEntryAnimation(getThemeMeta(themeId).motion.entry)
    if (a) el.animate(a.keyframes, { ...a.options, fill: 'none' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!text) return null

  // While exiting, layer the card CRT-shutdown class onto the wordmark so it
  // collapses to a line, flashes green, and pops out exactly like a card. The
  // class brings its own scanline + flicker overlays via ::before/::after. The
  // parent unmounts this node on a timer once the shutdown has run.
  const shutdownClass = closing ? getShutdownAnimationClass(getThemeMeta(themeId).motion.shutdown) : undefined

  return (
    <div
      className={styles.host}
      data-variant={variant}
      data-testid="board-bg-typography"
      data-closing={closing ? 'true' : 'false'}
      aria-hidden="true"
    >
      <span
        ref={textRef}
        className={shutdownClass ? `${styles.text} ${shutdownClass}` : styles.text}
      >
        {text}
      </span>
    </div>
  )
}
