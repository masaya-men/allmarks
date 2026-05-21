'use client'

import { type ReactNode } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import {
  detectUrlType,
  extractYoutubeId,
  isYoutubeShorts,
  extractVimeoId,
  extractTikTokVideoId,
} from '@/lib/utils/url'
import { YouTubeEmbed } from './YouTubeEmbed'
import { VimeoEmbed } from './VimeoEmbed'
import { SoundCloudEmbed } from './SoundCloudEmbed'
import { TikTokEmbed } from './TikTokEmbed'

/** True when the URL is a platform we can mount an inline audio player for.
 *  Tweets and Instagram are intentionally excluded: X video has no inline
 *  autoplay path here and Instagram can't be embedded for playback at all
 *  (link-out only). */
export function canPlayInline(url: string): boolean {
  const t = detectUrlType(url)
  return t === 'youtube' || t === 'vimeo' || t === 'soundcloud' || t === 'tiktok'
}

/**
 * Mounts the correct extracted embed player for a card's URL, sized to the
 * card via the same `aspectRatio` the Lightbox embeds use. Phase 1 uses this
 * for the single audio-active card (Tier 3). Returns null for non-playable
 * types so callers can `canPlayInline()`-guard and never render an empty box.
 */
export function InlineMediaPlayer({
  item,
  aspectRatio,
}: {
  readonly item: BoardItem
  readonly aspectRatio: number | undefined
}): ReactNode {
  const type = detectUrlType(item.url)
  const thumb = item.thumbnail

  if (type === 'youtube') {
    const id = extractYoutubeId(item.url)
    if (id) {
      return (
        <YouTubeEmbed
          videoId={id}
          title={item.title}
          vertical={isYoutubeShorts(item.url)}
          thumbnail={thumb}
          aspectRatio={aspectRatio}
          autoStart
        />
      )
    }
  }
  if (type === 'vimeo') {
    const id = extractVimeoId(item.url)
    if (id) {
      return <VimeoEmbed videoId={id} title={item.title} thumbnail={thumb} aspectRatio={aspectRatio} autoStart />
    }
  }
  if (type === 'soundcloud') {
    return <SoundCloudEmbed url={item.url} title={item.title} thumbnail={thumb} aspectRatio={aspectRatio} autoStart />
  }
  if (type === 'tiktok') {
    const id = extractTikTokVideoId(item.url)
    if (id) {
      return (
        <TikTokEmbed
          videoId={id}
          url={item.url}
          title={item.title}
          thumbnail={thumb}
          aspectRatio={aspectRatio}
          autoStart
        />
      )
    }
  }
  return null
}
