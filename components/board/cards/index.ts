import type { ComponentType } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { DisplayMode } from '@/lib/board/types'
import { detectUrlType } from '@/lib/utils/url'
import { VideoThumbCard } from './VideoThumbCard'
import { ImageCard } from './ImageCard'
import { PlaceholderCard } from './PlaceholderCard'

export { VideoThumbCard, ImageCard, PlaceholderCard }

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
