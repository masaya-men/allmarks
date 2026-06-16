'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type SyntheticEvent,
} from 'react'
import { TagAddPopover, type SuggestionEntry } from '@/components/board/TagAddPopover'
import type { TagRecord } from '@/lib/storage/indexeddb'
import styles from './PipCard.module.css'

/** Match the board's hover leave-grace so moving the pointer briefly off the
 *  popover (e.g. across the gap to a chip) doesn't snap it shut. */
const POPOVER_LEAVE_GRACE_MS = 700

export interface PipCardProps {
  readonly id: string
  readonly thumbnail: string
  readonly favicon: string
  readonly title: string
  /** Width / height ratio of the source content. Optional — when omitted,
   *  PipCard auto-detects it from the loaded image's natural dimensions.
   *  When aspect < 1 (vertical reel), the inner thumbnail expands taller
   *  than the carousel frame so verticals read as actually vertical. */
  readonly aspectRatio?: number
  /** True for the centred/active carousel card — only it shows the + TAG affordance. */
  readonly isActive?: boolean
  /** Whole-feature toggle. When false, no + TAG button is rendered. */
  readonly tagEnabled?: boolean
  /** Full tag master (for the popover's ALL TAGS section + chip lookups). */
  readonly allTags?: readonly TagRecord[]
  /** Tag ids already on this bookmark. */
  readonly currentTagIds?: readonly string[]
  /** Pre-ranked SUGGESTED entries (relevant-first existing tags). */
  readonly suggestedEntries?: readonly SuggestionEntry[]
  /** Attach an existing tag to this bookmark. */
  readonly onAddExisting?: (tagId: string) => void
  /** Create (or reuse) a tag by name and attach it to this bookmark. */
  readonly onAddNew?: (name: string) => void
}

export function PipCard({
  id,
  thumbnail,
  favicon,
  title,
  aspectRatio,
  isActive,
  tagEnabled,
  allTags,
  currentTagIds,
  suggestedEntries,
  onAddExisting,
  onAddNew,
}: PipCardProps): ReactElement {
  const [imgErrored, setImgErrored] = useState(false)
  const [detectedAspect, setDetectedAspect] = useState<number | undefined>()
  const [tagOpen, setTagOpen] = useState(false)
  const [tagClosing, setTagClosing] = useState(false)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Collapse the popover back to the "+ TAG" button when this card stops being
  // the active one, so returning to it later starts closed (no surprise re-open).
  useEffect(() => {
    if (!isActive) {
      setTagOpen(false)
      setTagClosing(false)
    }
  }, [isActive])

  // Clean up any pending leave-grace timer on unmount.
  useEffect(() => {
    return () => {
      if (leaveTimerRef.current !== null) clearTimeout(leaveTimerRef.current)
    }
  }, [])

  const canTag =
    isActive === true &&
    tagEnabled !== false &&
    onAddExisting !== undefined &&
    (allTags?.length ?? 0) > 0

  // ---- popover open/close lifecycle (mirrors the board's hover-grace) ----
  const cancelClose = useCallback((): void => {
    if (leaveTimerRef.current !== null) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    setTagClosing(false)
  }, [])

  const scheduleClose = useCallback((): void => {
    if (leaveTimerRef.current !== null) clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null
      setTagClosing(true)
    }, POPOVER_LEAVE_GRACE_MS)
  }, [])

  const beginClose = useCallback((): void => {
    if (leaveTimerRef.current !== null) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    setTagClosing(true)
  }, [])

  const finishClose = useCallback((): void => {
    setTagOpen(false)
    setTagClosing(false)
  }, [])

  const handleLoad = useCallback((e: SyntheticEvent<HTMLImageElement>): void => {
    if (aspectRatio !== undefined) return
    const img = e.currentTarget
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setDetectedAspect(img.naturalWidth / img.naturalHeight)
    }
  }, [aspectRatio])

  const showThumbnail = thumbnail !== '' && !imgErrored
  const showFavicon = !showThumbnail && favicon !== ''
  const showGeneric = !showThumbnail && !showFavicon

  const effectiveAspect = aspectRatio ?? detectedAspect

  // Hand the per-card aspect to PipCard.module.css; the outer .card sizes
  // itself via min/calc so each card lands at its native shape. Vertical
  // content stays narrow + tall, landscape stays wide + short — the
  // carousel's row spacing varies with it, accepted as the cost of
  // honouring real aspect ratios over uniform card slots.
  const styleVar: CSSProperties | undefined = effectiveAspect !== undefined
    ? ({ '--pip-card-aspect': effectiveAspect } as CSSProperties)
    : undefined

  return (
    <div
      className={styles.card}
      data-testid={`pip-card-${id}`}
      data-card-id={id}
      aria-label={title}
      style={styleVar}
    >
      <div className={styles.cardInner}>
        {showThumbnail && (
          <img
            className={styles.thumbnail}
            src={thumbnail}
            alt=""
            data-role="thumbnail"
            aria-hidden="true"
            onLoad={handleLoad}
            onError={() => setImgErrored(true)}
          />
        )}
        {showFavicon && (
          <div className={styles.faviconFallback}>
            <img src={favicon} alt="" data-role="favicon-fallback" aria-hidden="true" />
          </div>
        )}
        {showGeneric && (
          <div className={styles.genericPlaceholder} data-role="generic-placeholder" aria-hidden="true" />
        )}
      </div>
      {canTag && (
        <div
          className={styles.tagAffordance}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <button
            type="button"
            data-testid="pip-add-tag-button"
            aria-label="Add tag"
            className={styles.addTagButton}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              if (tagOpen) beginClose()
              else {
                cancelClose()
                setTagOpen(true)
              }
            }}
          >
            + TAG
          </button>
          {tagOpen && (
            <div
              className={styles.tagPopover}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <TagAddPopover
                allTags={allTags ?? []}
                currentTagIds={currentTagIds ?? []}
                suggestedEntries={suggestedEntries ?? []}
                closing={tagClosing}
                onExited={finishClose}
                onAddExisting={(tagId) => onAddExisting?.(tagId)}
                onAddNew={(name) => {
                  onAddNew?.(name)
                  beginClose()
                }}
                onClose={beginClose}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
