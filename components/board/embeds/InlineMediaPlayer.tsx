'use client'

import { type ReactNode } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import { resolveInlinePlayer, canPlayInline } from './media-players'

// Re-export so existing call sites (CardsLayer) keep importing from here.
export { canPlayInline }

/**
 * Mounts the correct inline player for a board card via the media-players
 * registry (the single source of truth for "what plays this item"). Phase 1
 * Tier 3: the indicator press is the user gesture, so autoStart=true makes the
 * player begin with audio. Returns null for non-playable items so callers can
 * `canPlayInline`-guard and never render an empty box.
 */
export function InlineMediaPlayer({
  item,
  volume,
  paused,
  muted,
}: {
  readonly item: BoardItem
  /** Controlled per-card volume (0–100). */
  readonly volume?: number
  /** Controlled play/pause. */
  readonly paused?: boolean
  /** Tier 1 viewport autoplay: mount muted (no audio). */
  readonly muted?: boolean
}): ReactNode {
  return resolveInlinePlayer(item, { autoStart: true, volume, paused, muted })
}
