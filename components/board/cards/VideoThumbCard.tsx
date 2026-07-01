'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { DisplayMode } from '@/lib/board/types'
import { detectUrlType } from '@/lib/utils/url'
import { getYoutubeThumb, isYoutubeShortsUrl } from '@/lib/embed/youtube-thumb'
import { fetchTikTokMeta } from '@/lib/embed/tiktok-meta'
import { fetchYoutubeOEmbed, isDegenerateYoutubeTitle } from '@/lib/embed/youtube-oembed'
import { paperAssetUrl, pickPaperAsset, IMAGE_CARD_BACKING_POOL, isPaperSheet, seedFractionFromId } from '@/lib/board/paper-assets'
import styles from './VideoThumbCard.module.css'
// Paper-atelier mat face is shared with ImageCard: the video thumbnail sits in
// the same ivory-mat window + serif caption so YouTube/TikTok cards match the
// photo cards on the paper theme (they used to render bare, with no mat — the
// "台紙に乗ってない" bug). Importing ImageCard's module keeps a single source of
// truth for the mat CSS (incl. the sheet-transparent :has() rule), so ImageCard
// stays byte-identical and needs no edit.
import imageStyles from './ImageCard.module.css'

type Props = {
  readonly item: BoardItem
  readonly displayMode: DisplayMode
  readonly persistMeasuredAspect?: (cardId: string, aspectRatio: number) => Promise<void>
  readonly cardWidth?: number
  readonly cardHeight?: number
  /** When true, renders the paper-atelier card face (mat backing + mounted
   *  thumbnail window + serif caption). Default false = bare thumbnail,
   *  unchanged from the default theme. */
  readonly paper?: boolean
}

const ASPECT_EPSILON = 0.005
/** YouTube Shorts are portrait 9:16. The i.ytimg.com thumbnail is a 16:9
 *  letterboxed frame, so measuring its pixels would clobber the correct
 *  portrait aspect back to landscape. Matches estimateAspectRatio('youtube-shorts'). */
const SHORTS_ASPECT = 9 / 16

export function VideoThumbCard({ item, persistMeasuredAspect, paper = false }: Props): ReactNode {
  const urlType = detectUrlType(item.url)
  const isShorts = urlType === 'youtube' && isYoutubeShortsUrl(item.url)
  const [tikTokThumb, setTikTokThumb] = useState<string | null>(null)
  const [tikTokTitle, setTikTokTitle] = useState<string | null>(null)
  const [ytTitle, setYtTitle] = useState<string | null>(null)
  const [ytLevel, setYtLevel] = useState<0 | 1 | 2 | 3>(0)
  const tikTokRequested = useRef(false)
  const ytOEmbedRequested = useRef(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // TikTok: always fetch oEmbed — we need it for both thumbnail and title.
  useEffect(() => {
    if (urlType !== 'tiktok' || tikTokRequested.current) return
    tikTokRequested.current = true
    void fetchTikTokMeta(item.url).then((meta) => {
      if (!meta) return
      if (meta.thumbnailUrl) setTikTokThumb(meta.thumbnailUrl)
      if (meta.title) setTikTokTitle(meta.title)
    })
  }, [urlType, item.url])

  // YouTube: only fetch oEmbed when the saved title is degenerate.
  // The bookmarklet stored "YouTube <videoId>" as a fallback when
  // document.title wasn't ready — oEmbed gives us the real title.
  useEffect(() => {
    if (urlType !== 'youtube' || ytOEmbedRequested.current) return
    if (!isDegenerateYoutubeTitle(item.title)) return
    ytOEmbedRequested.current = true
    void fetchYoutubeOEmbed(item.url).then((data) => {
      if (data?.title) setYtTitle(data.title)
    })
  }, [urlType, item.url, item.title])

  const thumbUrl =
    urlType === 'youtube' ? getYoutubeThumb(item.url, ytLevel) : tikTokThumb

  // Aspect handling:
  // - Shorts: force / repair to 9:16 and SKIP the pixel measure. The thumbnail
  //   is a 16:9 letterboxed frame; measuring it would flip the card back to
  //   landscape (the "縦動画が横長カード" bug). object-fit:cover in a 9:16 card
  //   then crops the pillarbox bars, showing the vertical video centered.
  // - Everything else: re-measure intrinsic aspect from natural width/height
  //   once the thumbnail loads, correcting stale persisted aspectRatio.
  useEffect(() => {
    if (!persistMeasuredAspect) return
    if (isShorts) {
      if (Math.abs(item.aspectRatio - SHORTS_ASPECT) >= ASPECT_EPSILON) {
        void persistMeasuredAspect(item.cardId, SHORTS_ASPECT)
      }
      return
    }
    if (!thumbUrl) return
    const img = imgRef.current
    if (!img) return
    const measure = (): void => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (w <= 0 || h <= 0) return
      const aspect = w / h
      if (Math.abs(aspect - item.aspectRatio) < ASPECT_EPSILON) return
      void persistMeasuredAspect(item.cardId, aspect)
    }
    if (img.complete && img.naturalWidth > 0) {
      measure()
      return undefined
    }
    img.addEventListener('load', measure)
    return (): void => img.removeEventListener('load', measure)
  }, [isShorts, thumbUrl, item.cardId, item.aspectRatio, persistMeasuredAspect])

  const handleImgError = (): void => {
    if (urlType === 'youtube' && ytLevel < 3) {
      setYtLevel((l) => (l + 1) as 0 | 1 | 2 | 3)
    }
  }

  // Touch unused state setters so tsc doesn't warn — these will feed the
  // Lightbox's tweet-style title resolution in a follow-up pass (currently
  // the bookmarklet-saved title is used directly).
  void tikTokTitle
  void ytTitle

  const thumb = thumbUrl ? (
    <img
      ref={imgRef}
      className={paper ? imageStyles.thumb : styles.thumb}
      data-active={paper ? 'true' : undefined}
      src={thumbUrl}
      onError={handleImgError}
      alt=""
      draggable={false}
      loading="lazy"
    />
  ) : null

  // Paper-atelier card face: same mat + window + serif caption as the paper
  // ImageCard, with the video thumbnail mounted in the window. Reuses the mat
  // pool so a video can pick a vintage mat or a torn sheet — paperCardHasTornBacking
  // (cards/index.ts) mirrors this pick so the decoration corners stay consistent.
  if (paper) {
    const matId = pickPaperAsset(seedFractionFromId(item.bookmarkId), IMAGE_CARD_BACKING_POOL)
    const matUrl = matId ? paperAssetUrl(matId) : null
    const sheet = isPaperSheet(matId)
    return (
      <div className={imageStyles.imageCard}>
        <div
          className={imageStyles.paperCard}
          data-paper-mat="true"
          data-paper-sheet={sheet ? 'true' : undefined}
          style={matUrl ? { backgroundImage: `url("${matUrl}")` } : undefined}
        >
          <div className={imageStyles.paperPhoto} data-paper-window="true">
            {thumb}
          </div>
          {item.title && <div className={imageStyles.paperCaption}>{item.title}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.videoCard}>
      {thumb ?? <div className={styles.placeholder} aria-hidden="true" />}
    </div>
  )
}
