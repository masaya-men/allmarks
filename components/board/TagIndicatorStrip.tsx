'use client'

import type { PointerEvent, ReactElement } from 'react'
import type { TagRecord } from '@/lib/storage/indexeddb'

interface Props {
  /** Tags already resolved (= bookmark.tags[] joined against the tags master).
   *  Empty array → strip renders nothing. */
  readonly tags: readonly TagRecord[]
  /** Card-level hover state from the parent. Drives opacity. */
  readonly isHovered: boolean
  /** Triggered by clicking a tag pill — toggles board-wide tag filter. */
  readonly onTagClick: (tagId: string) => void
  /** Maximum pills rendered before collapsing the tail into a "+N" badge. */
  readonly maxVisible?: number
}

// Position offsets — small negative values let the strip bleed off the
// card's top-left corner so it physically overlaps neighboring cards (the
// z-index above does the actual stacking work). Keep small; bigger bleed
// reads as detached.
const BLEED_TOP_PX = -6
const BLEED_LEFT_PX = -2

// Match the playback control's z-index tier so the strip is hover-promoted
// above neighbor cards in the masonry grid.
const STRIP_Z_INDEX = 50

export function TagIndicatorStrip({
  tags,
  isHovered,
  onTagClick,
  maxVisible = 3,
}: Props): ReactElement | null {
  if (tags.length === 0) return null

  const visible = tags.length > maxVisible ? tags.slice(0, maxVisible - 1) : tags
  const hiddenCount = tags.length - visible.length

  const stopDragSeed = (e: PointerEvent<HTMLElement>): void => e.stopPropagation()

  return (
    <div
      data-testid="tag-indicator-strip"
      style={{
        position: 'absolute',
        top: BLEED_TOP_PX,
        left: BLEED_LEFT_PX,
        display: 'flex',
        flexDirection: 'row',
        gap: 4,
        opacity: isHovered ? 1 : 0,
        pointerEvents: isHovered ? 'auto' : 'none',
        transition: 'opacity 120ms ease-out',
        zIndex: STRIP_Z_INDEX,
      }}
    >
      {visible.map((tag) => (
        <button
          key={tag.id}
          type="button"
          data-testid={`tag-pill-${tag.id}`}
          onPointerDown={stopDragSeed}
          onMouseDown={(e): void => e.stopPropagation()}
          onClick={(e): void => {
            e.stopPropagation()
            onTagClick(tag.id)
          }}
          style={{
            appearance: 'none',
            background: 'rgba(8, 8, 10, 0.72)',
            border: `1px solid ${tag.color}`,
            borderRadius: 999,
            color: 'rgba(255, 255, 255, 0.94)',
            padding: '2px 8px',
            fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
            fontSize: 10,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}
        >
          {tag.name}
        </button>
      ))}
      {hiddenCount > 0 && (
        <span
          data-testid="tag-pill-overflow"
          aria-label={`${hiddenCount} more tags`}
          onPointerDown={stopDragSeed}
          style={{
            background: 'rgba(8, 8, 10, 0.72)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
            borderRadius: 999,
            color: 'rgba(255, 255, 255, 0.85)',
            padding: '2px 8px',
            fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
            fontSize: 10,
            letterSpacing: '0.10em',
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  )
}
