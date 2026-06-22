import type { ComponentType } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { DisplayMode } from '@/lib/board/types'
import { detectUrlType } from '@/lib/utils/url'
import { VideoThumbCard } from './VideoThumbCard'
import { ImageCard } from './ImageCard'
import { PlaceholderCard } from './PlaceholderCard'
import { PLACEHOLDER_ASPECT } from './placeholder-aspect'

export { VideoThumbCard, ImageCard, PlaceholderCard, PLACEHOLDER_ASPECT }

export type CardComponentProps = {
  readonly item: BoardItem
  readonly persistMeasuredAspect?: (cardId: string, aspectRatio: number) => Promise<void>
  /** Reports the card's actual rendered height in px to the parent layout.
   * Used by text-heavy cards where height does not scale with width. */
  readonly reportIntrinsicHeight?: (cardId: string, heightPx: number) => void
  readonly cardWidth?: number
  readonly cardHeight?: number
  readonly displayMode: DisplayMode
  /** Tier 1: advance through mediaSlots on an interval (hard cut). Only consumed by ImageCard. */
  readonly autoCycle?: boolean
}

export type CardComponent = ComponentType<CardComponentProps>

/**
 * Pick the appropriate card component based on URL type and OGP availability.
 * Pure function — easy to test in isolation.
 *
 * 3 経路に整理 (session 88):
 * - 'youtube' or 'tiktok' → VideoThumbCard (常に — サムネは自分で fetch)
 * - thumbnail あり → ImageCard (tweet with media を含む)
 * - それ以外 (= thumbnail 無し / title だけ / 両方無し) → PlaceholderCard
 *
 * 旧 TextCard / MinimalCard は廃止して PlaceholderCard に統合 (= 画像 bg +
 * 中央タイトル + 左上ホスト名)。 「文字だけのカード」 と「メタタグ不在の薄い
 * カード」 の見た目が同じ視覚言語で揃う。
 */
export function pickCard(item: BoardItem): CardComponent {
  const type = detectUrlType(item.url)
  if (type === 'youtube' || type === 'tiktok') return VideoThumbCard
  if (item.thumbnail) return ImageCard
  return PlaceholderCard
}

/** True when the card renders as a (thumbnail-less) PlaceholderCard. */
export function isPlaceholderCard(item: BoardItem): boolean {
  return pickCard(item) === PlaceholderCard
}

/**
 * Deterministic masonry height for a card at a given render width.
 *
 * PlaceholderCard cards have a FIXED aspect (width / PLACEHOLDER_ASPECT) that
 * does NOT depend on the card mounting and reporting its measured height.
 * Computing it eagerly keeps the layout stable from the very first frame:
 * otherwise a placeholder's estimated `aspectRatio` (usually ≠ 1.25) is used
 * until the card mounts, then the on-mount report snaps the height to 1.25 and
 * every card below it shifts — the "cards reshuffle / left-gap while scrolling"
 * bug. Image / video cards scale by their (measured or estimated) aspectRatio.
 *
 * This is the single source of truth for card height — the board render layout
 * (CardsLayer), the scroll-range layout (BoardRoot), and the share preview all
 * use it so they never diverge for thumbnail-less cards.
 */
export function itemSkylineHeight(item: BoardItem, width: number): number {
  if (isPlaceholderCard(item)) return width / PLACEHOLDER_ASPECT
  return item.aspectRatio > 0 ? width / item.aspectRatio : width
}
