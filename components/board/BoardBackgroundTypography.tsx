'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { BoardFilter } from '@/lib/board/types'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { getEntryAnimation } from '@/lib/animation/tag-entry'
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
  /** Master on/off (the TITLE toggle). Drives the resting visibility. */
  readonly enabled?: boolean
  /** Increments on each USER toggle of the TITLE switch. The entry / power-down
   *  effect plays only when this changes — so hydrating a saved "off" (which
   *  flips `enabled` without a toggle) snaps silently instead of animating on
   *  every load. Initial mount + hydration leave it untouched. */
  readonly toggleNonce?: number
}

export function BoardBackgroundTypography({
  activeFilter,
  tags,
  variant = 'static',
  enabled = true,
  toggleNonce = 0,
}: Props): ReactElement | null {
  const text = deriveBoardBgTypoText(activeFilter, tags)

  // The wordmark span stays mounted whenever there's text (so the WAAPI target
  // always exists — animating right after a remount races React's commit). Its
  // visibility is driven by `shown`, which lags `enabled` on the way out so the
  // power-down animation can finish before we hide the host.
  const textRef = useRef<HTMLSpanElement>(null)
  const animRef = useRef<Animation | null>(null)
  const [shown, setShown] = useState(enabled)
  const prevNonceRef = useRef(toggleNonce)

  useEffect(() => {
    const isToggle = toggleNonce !== prevNonceRef.current
    prevNonceRef.current = toggleNonce
    // Not a user toggle (initial mount / hydration / filter change): snap to the
    // current state without animating.
    if (!isToggle) { setShown(enabled); return }

    const el = textRef.current
    if (!el) { setShown(enabled); return }
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    animRef.current?.cancel()
    animRef.current = null

    if (enabled) {
      // Reveal immediately; the entry animation boots the wordmark up from a
      // collapsed CRT line (same effect cards use when they appear on filter).
      setShown(true)
      if (reduce) {
        animRef.current = el.animate([{ opacity: '0' }, { opacity: '1' }], { duration: 180, easing: 'ease-out', fill: 'none' })
      } else {
        const a = getEntryAnimation('wave')
        if (a) animRef.current = el.animate(a.keyframes, a.options)
      }
    } else {
      // Power down (the entry reversed), THEN hide the host.
      const finish = (): void => { setShown(false); animRef.current = null }
      if (reduce) {
        const anim = el.animate([{ opacity: '1' }, { opacity: '0' }], { duration: 160, easing: 'ease-in', fill: 'forwards' })
        anim.onfinish = finish
        animRef.current = anim
      } else {
        const a = getEntryAnimation('wave')
        if (a) {
          const anim = el.animate(a.keyframes, { ...a.options, direction: 'reverse', fill: 'forwards' })
          anim.onfinish = finish
          animRef.current = anim
        } else {
          setShown(false)
        }
      }
    }
  }, [enabled, toggleNonce])

  useEffect(() => (): void => { animRef.current?.cancel() }, [])

  if (!text) return null

  return (
    <div
      className={styles.host}
      data-variant={variant}
      data-testid="board-bg-typography"
      data-enabled={enabled ? 'true' : 'false'}
      aria-hidden="true"
      style={{ opacity: shown ? 1 : 0 }}
    >
      <span ref={textRef} className={styles.text}>{text}</span>
    </div>
  )
}
