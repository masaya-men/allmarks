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
  /** Right-click on a pill. Receives viewport coords so the parent can
   *  open a context menu near the pill. When supplied, the pill
   *  suppresses the native browser menu. */
  readonly onTagContextMenu?: (e: { clientX: number; clientY: number }, tagId: string) => void
  /** Id of the tag whose right-click menu is currently open — rendered
   *  with a red text-glow so the user can locate the targeted pill. */
  readonly activeContextTagId?: string | null
  /** Maximum pills rendered before collapsing the tail into a "+N" badge. */
  readonly maxVisible?: number
}

// Bleed offsets — small negative values let the strip overhang the card's
// top-left corner so it physically overlaps neighboring cards in the
// masonry grid (the parent card wrapper lifts z-index on hover so the
// stacking actually works).
const BLEED_TOP_PX = -8
const BLEED_LEFT_PX = 0

// Match the playback control's z-index tier so the strip sits above
// neighbor cards in the hover-lifted stacking context.
const STRIP_Z_INDEX = 50

// Shared text affordance — white text + 2-tier text-shadow. Matches the
// CardCornerActions × glyph's drop-shadow recipe but for text instead of
// SVG. Tight drop (0 1px 2px) grounds the glyph, soft halo (0 0 4px)
// cushions it for any-background legibility. Same family across the
// chrome (× , ↺ , tag pills, +TAG) so they read as one editorial set.
const TEXT_STYLE: React.CSSProperties = {
  appearance: 'none',
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  color: 'rgba(255, 255, 255, 0.94)',
  textShadow: '0 1px 2px rgba(0, 0, 0, 0.65), 0 0 4px rgba(0, 0, 0, 0.35)',
  fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
  fontSize: 10,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  lineHeight: 1.4,
}

export function TagIndicatorStrip({
  tags,
  isHovered,
  onTagClick,
  onTagContextMenu,
  activeContextTagId,
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
        gap: 12,
        zIndex: STRIP_Z_INDEX,
        opacity: isHovered ? 1 : 0,
        pointerEvents: isHovered ? 'auto' : 'none',
        transition: 'opacity 120ms ease-out',
      }}
    >
      {visible.map((tag) => {
        const isContextActive = activeContextTagId === tag.id
        const pillStyle: React.CSSProperties = isContextActive
          ? {
              ...TEXT_STYLE,
              color: '#FF3B30',
              textShadow:
                '0 0 8px rgba(255, 59, 48, 0.65),' +
                ' 0 0 18px rgba(255, 59, 48, 0.25),' +
                ' 0 1px 2px rgba(0, 0, 0, 0.65)',
            }
          : TEXT_STYLE
        return (
          <button
            key={tag.id}
            type="button"
            data-testid={`tag-pill-${tag.id}`}
            data-tag-id={tag.id}
            onPointerDown={stopDragSeed}
            onMouseDown={(e): void => e.stopPropagation()}
            onClick={(e): void => {
              e.stopPropagation()
              onTagClick(tag.id)
            }}
            onContextMenu={(e): void => {
              if (!onTagContextMenu) return
              e.preventDefault()
              e.stopPropagation()
              onTagContextMenu({ clientX: e.clientX, clientY: e.clientY }, tag.id)
            }}
            style={pillStyle}
          >
            {tag.name}
          </button>
        )
      })}
      {hiddenCount > 0 && (
        <span
          data-testid="tag-pill-overflow"
          aria-label={`${hiddenCount} more tags`}
          onPointerDown={stopDragSeed}
          style={{ ...TEXT_STYLE, cursor: 'default' }}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  )
}
