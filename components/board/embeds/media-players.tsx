'use client'

import { type ReactNode } from 'react'
import type { MediaSlot } from '@/lib/embed/types'
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
import { TweetVideoEmbed, type MediaVariant } from './TweetVideoEmbed'

/** Structural subset of BoardItem / LightboxItem the registry needs. */
export type PlayableItem = {
  readonly url: string
  readonly title: string
  readonly thumbnail?: string | undefined
  readonly aspectRatio?: number | undefined
  readonly hasVideo?: boolean
  readonly mediaSlots?: readonly MediaSlot[]
}

type RenderOpts = {
  readonly variant: MediaVariant
  readonly autoStart?: boolean
  /** Controlled per-card volume (0–100) for inline cards. Undefined → the
   *  embed uses the global default (Lightbox). */
  readonly volume?: number
  /** Controlled play/pause for inline cards. Undefined → uncontrolled. */
  readonly paused?: boolean
  /** Tier 1 viewport autoplay: start muted (autoplay-policy compliant, no audio). */
  readonly muted?: boolean
  /** Tier 1 only: called once when the embed detects it cannot play.
   *  The overlay is unmounted so the card thumbnail shows. Never set for Tier 3. */
  readonly onUnplayable?: () => void
}

/** True when the item carries a directly-playable mp4 video slot. Platform-
 *  agnostic: tweets today, and any future platform (e.g. Bluesky) that
 *  populates mediaSlots[].videoUrl, are covered by this one predicate. */
function hasVideoSlot(item: PlayableItem): boolean {
  return !!item.mediaSlots?.some((s: MediaSlot) => s.type === 'video' && !!s.videoUrl)
}

type MediaEntry = {
  /** Does this entry handle the item? */
  readonly match: (item: PlayableItem) => boolean
  /** False for link-out media (e.g. Instagram) that renders in the Lightbox
   *  but is NOT inline-playable on the board. */
  readonly playableInline: boolean
  /** True when Tier 1 viewport autoplay (muted, in-view) is allowed for this
   *  platform. Stricter than playableInline: excludes TikTok (unreliable embed
   *  autoplay + uncloseable CTA) and SoundCloud (audio — muted = no visible
   *  motion). Tier 3 click-to-play uses only playableInline and supports all. */
  readonly tier1Autoplay: boolean
  readonly render: (item: PlayableItem, opts: RenderOpts) => ReactNode | null
}

/** THE source of truth. Order matters: first match wins. Add a platform here
 *  and both the board (`canPlayInline` / `resolveInlinePlayer`) and the
 *  Lightbox (`resolveLightboxPlayer`) pick it up. */
const ENTRIES: readonly MediaEntry[] = [
  {
    match: (i) => detectUrlType(i.url) === 'youtube' && !!extractYoutubeId(i.url),
    playableInline: true,
    tier1Autoplay: true,
    render: (i, o) => {
      const id = extractYoutubeId(i.url)
      return id ? (
        <YouTubeEmbed
          videoId={id}
          title={i.title}
          vertical={isYoutubeShorts(i.url)}
          thumbnail={i.thumbnail}
          aspectRatio={i.aspectRatio}
          autoStart={o.variant === 'inline' && o.autoStart === true}
          volume={o.volume}
          paused={o.paused}
          muted={o.muted}
          onUnplayable={o.onUnplayable}
        />
      ) : null
    },
  },
  {
    match: (i) => detectUrlType(i.url) === 'vimeo' && !!extractVimeoId(i.url),
    playableInline: true,
    tier1Autoplay: true,
    render: (i, o) => {
      const id = extractVimeoId(i.url)
      return id ? (
        <VimeoEmbed
          videoId={id}
          title={i.title}
          thumbnail={i.thumbnail}
          aspectRatio={i.aspectRatio}
          autoStart={o.variant === 'inline' && o.autoStart === true}
          volume={o.volume}
          paused={o.paused}
          muted={o.muted}
          onUnplayable={o.onUnplayable}
        />
      ) : null
    },
  },
  {
    match: (i) => detectUrlType(i.url) === 'tiktok' && !!extractTikTokVideoId(i.url),
    playableInline: true,
    tier1Autoplay: false,
    render: (i, o) => {
      const id = extractTikTokVideoId(i.url)
      return id ? (
        <TikTokEmbed
          videoId={id}
          url={i.url}
          title={i.title}
          thumbnail={i.thumbnail}
          aspectRatio={i.aspectRatio}
          autoStart={o.variant === 'inline' && o.autoStart === true}
          volume={o.volume}
          paused={o.paused}
          muted={o.muted}
        />
      ) : null
    },
  },
  {
    match: (i) => detectUrlType(i.url) === 'soundcloud',
    playableInline: true,
    tier1Autoplay: false,
    render: (i, o) => (
      <SoundCloudEmbed
        url={i.url}
        title={i.title}
        thumbnail={i.thumbnail}
        aspectRatio={i.aspectRatio}
        autoStart={o.variant === 'inline' && o.autoStart === true}
        volume={o.volume}
        paused={o.paused}
        muted={o.muted}
      />
    ),
  },
  {
    // mp4 video slot — tweets now, future mediaSlots platforms automatically.
    match: (i) => hasVideoSlot(i) || (detectUrlType(i.url) === 'tweet' && i.hasVideo === true),
    playableInline: true,
    tier1Autoplay: true,
    render: (i, o) => (
      <TweetVideoEmbed
        item={{ url: i.url, title: i.title, thumbnail: i.thumbnail, mediaSlots: i.mediaSlots }}
        variant={o.variant}
        autoStart={o.variant === 'inline' && o.autoStart === true}
        volume={o.volume}
        paused={o.paused}
        muted={o.muted}
        onUnplayable={o.onUnplayable}
      />
    ),
  },
]

/** True when the board can mount an inline player for this item. Derived from
 *  the registry — there is no separate hardcoded platform list to keep in sync. */
export function canPlayInline(item: PlayableItem): boolean {
  return ENTRIES.some((e) => e.playableInline && e.match(item))
}

/** True when the board may AUTO-play this item muted in-view (Tier 1).
 *  Stricter than canPlayInline: excludes TikTok (unreliable embed autoplay +
 *  uncloseable CTA) and SoundCloud (audio — muted = no visible motion).
 *  Tier 3 click-to-play still uses canPlayInline and supports all types. */
export function canViewportAutoplay(item: PlayableItem): boolean {
  return ENTRIES.some((e) => e.playableInline && e.tier1Autoplay && e.match(item))
}

/** Options for the board inline player. */
export type InlinePlayerOpts = {
  readonly autoStart: boolean
  /** Controlled per-card volume (0–100). */
  readonly volume?: number
  /** Controlled play/pause. */
  readonly paused?: boolean
  /** Tier 1 viewport autoplay: start muted (no audio). */
  readonly muted?: boolean
  /** Tier 1 only: called once when the embed detects it cannot play.
   *  The overlay is unmounted so the card thumbnail shows. Never set for Tier 3. */
  readonly onUnplayable?: () => void
}

/** Board inline player (autoplay; muted for Tier 2 hover, with sound for Tier 3).
 *  Null when not inline-playable. */
export function resolveInlinePlayer(item: PlayableItem, opts: InlinePlayerOpts): ReactNode | null {
  const entry = ENTRIES.find((e) => e.playableInline && e.match(item))
  return entry
    ? entry.render(item, { variant: 'inline', autoStart: opts.autoStart, volume: opts.volume, paused: opts.paused, muted: opts.muted, onUnplayable: opts.onUnplayable })
    : null
}

/** Lightbox media component (no autostart). Null when no registry entry
 *  matches → caller falls back to image/text (and the Instagram link-out). */
export function resolveLightboxPlayer(item: PlayableItem): ReactNode | null {
  const entry = ENTRIES.find((e) => e.match(item))
  return entry ? entry.render(item, { variant: 'lightbox' }) : null
}
