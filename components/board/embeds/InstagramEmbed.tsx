'use client'

import { type ReactNode } from 'react'
import styles from '../Lightbox.module.css'
import { EmbedPosterBox } from './EmbedShell'

/** Instagram post — replaces the original `/embed` iframe with a poster +
 *  external link. Background: Instagram's embed iframe is non-interactive
 *  for video playback (Meta routes any "play" tap straight to instagram.com),
 *  so the prior two-tap "click our overlay → reveals iframe → click again →
 *  goes to Instagram" path was just a confusing detour to the same
 *  destination. There is no public API to fetch the actual mp4 (Twitter has
 *  syndication; Instagram only exposes login-required private endpoints
 *  whose use violates Meta's ToS). The honest UX is therefore: show the
 *  poster image we already have, and a single clear "Instagramで開く ↗"
 *  overlay that opens the post in a new tab. No wasted iframe load. */
export function InstagramEmbed({
  shortcode,
  thumbnail,
  title,
  aspectRatio,
}: {
  readonly shortcode: string
  readonly thumbnail: string | undefined
  readonly title: string
  readonly aspectRatio: number | undefined
}): ReactNode {
  const postUrl = `https://www.instagram.com/p/${shortcode}/`
  return (
    <EmbedPosterBox
      aspectRatio={aspectRatio}
      fallbackAspect={1}
      thumbnail={thumbnail}
      alt={title}
    >
      <a
        className={styles.embedOpenLink}
        href={postUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram で開く"
      >
        <span className={styles.embedOpenBadge}>
          {/* external-link icon — the upper-right arrow makes it obvious
              this leaves the app, distinguishing it from a regular play
              button which would imply inline playback. */}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 3h7v7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 3l-9 9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Instagramで開く
        </span>
      </a>
    </EmbedPosterBox>
  )
}
