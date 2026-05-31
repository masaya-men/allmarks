'use client'

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import { pickPlaceholderImage } from '@/lib/board/placeholder-image'
import type { SwipeDecision } from './AmbientBackdrop'
import styles from './TriageCard.module.css'

/** role:
 *   - 'current'  = card that is on screen and may exit
 *   - 'incoming' = card sliding in from the opposite side of the swipe
 *  enterDirection is required for 'incoming' so we know which edge to
 *  enter from. For 'current' it's ignored.
 */
export function TriageCard({
  item, exitDecision, role = 'current', enterDirection,
  onSurfacePointerDown, liveTransform, transformTransition, isDragging, targetTagName,
}: {
  item: BoardItem
  exitDecision?: SwipeDecision | null
  role?: 'current' | 'incoming'
  enterDirection?: 'from-right' | 'from-left'
  /** Pointer-down on the card's image surface (the drag/tap handle). The text
   *  panel is intentionally NOT wired so it stays selectable. */
  onSurfacePointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void
  /** Inline transform applied while dragging (follow the pointer) or tossing
   *  (fly into the tag). Overrides the CSS enter/exit animation. */
  liveTransform?: string | null
  /** Animate the transform (true during the toss-into-tag), or apply it
   *  instantly (false during a 1:1 drag follow). */
  transformTransition?: boolean
  /** True while the card is being carried — adds the lifted chrome. */
  isDragging?: boolean
  /** Tag name the card is currently aimed at, shown as a floating label. */
  targetTagName?: string | null
}): ReactElement {
  let host = ''
  try { host = new URL(item.url).hostname.replace(/^www\./, '') } catch { /* ignore */ }

  // A live transform (drag follow / toss) takes over from the CSS keyframe
  // animations — applying both would fight over `transform`.
  const usingLiveTransform = liveTransform != null
  const animClass = usingLiveTransform
    ? ''
    : role === 'incoming'
      ? (enterDirection === 'from-left' ? styles.enterFromLeft : styles.enterFromRight)
      : exitDecision === 'yes' ? styles.exitYes
      : exitDecision === 'no' ? styles.exitNo
      : ''

  const hasThumb = Boolean(item.thumbnail)
  // Text-only cards (no thumbnail) reuse the board's deterministic AI
  // placeholder image (same URL-hash pick → same image as on the board /
  // share mirror) instead of a flat black panel, so the manage screen matches
  // the board. Null only if no placeholders are registered → black panel
  // fallback below.
  const placeholder = hasThumb ? null : pickPlaceholderImage(item.url)
  const cardStyle: CSSProperties = {
    ['--item-aspect' as string]: String(item.aspectRatio || 1),
    ...(usingLiveTransform
      ? {
          transform: liveTransform!,
          transition: transformTransition ? 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease' : 'none',
        }
      : {}),
  }
  const cls = [styles.card, animClass, isDragging ? styles.dragging : ''].filter(Boolean).join(' ')
  return (
    <div className={cls} style={cardStyle} data-testid="triage-card">
      {targetTagName && (
        <div className={styles.targetLabel} data-testid="triage-target-label">
          <span className={styles.targetLabelArrow}>→</span>
          {targetTagName}
        </div>
      )}
      {hasThumb ? (
        <div
          className={styles.media}
          style={{ backgroundImage: `url("${item.thumbnail!.replace(/"/g, '%22')}")` }}
          onPointerDown={onSurfacePointerDown}
          data-testid="triage-card-surface"
        />
      ) : placeholder ? (
        <div
          className={styles.media}
          style={{ backgroundImage: `url("${placeholder.url}")` }}
          onPointerDown={onSurfacePointerDown}
          data-testid="triage-card-surface"
        />
      ) : (
        <div
          className={styles.hostnamePanel}
          onPointerDown={onSurfacePointerDown}
          data-testid="triage-card-surface"
        >
          {host || 'link'}
        </div>
      )}
      <div className={styles.text}>
        <h1 className={styles.title}>{item.title}</h1>
        {item.description && <p className={styles.description}>{item.description}</p>}
        <div className={styles.meta}><span>{host}</span></div>
      </div>
    </div>
  )
}
