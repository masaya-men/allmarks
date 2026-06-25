'use client'

import type { PointerEvent, ReactElement } from 'react'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { useIsPaperTheme } from '@/lib/board/use-is-paper-theme'
import { paperAssetUrl, pickPaperAsset, type PaperAssetId } from '@/lib/board/paper-assets'

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

// Washi tapes the paper-theme tag labels are written ON (theme-following: a tag
// reads as a hand-labelled strip of masking tape, in handwriting ink).
const WASHI_IDS: readonly PaperAssetId[] = [
  'washi-tape-1', 'washi-tape-2', 'washi-tape-3', 'washi-tape-4', 'washi-tape-5',
  'washi-tape-6', 'washi-tape-7', 'washi-tape-8', 'washi-tape-9',
]

/** FNV-1a → 0..1, stable per tag id (picks the tape variant + a tilt). */
function seedFractionFromId(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 4294967296
}

// Handwriting ink label on a washi tape — paper theme. Reuses the same
// Yomogi→Caveat handwriting stack as the card caption (ImageCard.module.css).
const PAPER_TEXT_STYLE: React.CSSProperties = {
  appearance: 'none',
  border: 'none',
  margin: 0,
  padding: '5px 15px 7px',
  backgroundColor: 'transparent',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '100% 100%',
  color: '#3a2a1c',
  fontFamily: "'Yomogi', var(--font-handwriting, 'Caveat'), cursive",
  fontSize: 13,
  lineHeight: 1.15,
  letterSpacing: '0.01em',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

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
  // タグ名は常に小文字で表示する (= ユーザーが付けた中身。 アプリの枠ラベルは
  // 大文字のままで、 タグ名だけ小文字に統一して視覚的に区別する)。保存値は不変。
  textTransform: 'lowercase',
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
  const isPaper = useIsPaperTheme()
  if (tags.length === 0) return null

  const visible = tags.length > maxVisible ? tags.slice(0, maxVisible - 1) : tags
  const hiddenCount = tags.length - visible.length

  const stopDragSeed = (e: PointerEvent<HTMLElement>): void => e.stopPropagation()

  return (
    <div
      data-testid="tag-indicator-strip"
      style={{
        position: 'absolute',
        // Paper: nudge inward + down so the washi tapes clear the TL photo-corner
        // and don't clip above the card; default keeps the bleed-overhang pills.
        top: isPaper ? 4 : BLEED_TOP_PX,
        left: isPaper ? 12 : BLEED_LEFT_PX,
        display: 'flex',
        flexDirection: isPaper ? 'column' : 'row',
        alignItems: 'flex-start',
        gap: isPaper ? 6 : 12,
        // Paper: sit ABOVE the card's photo-corner / decoration overlay so the
        // labelled tape stays readable (a tape applied over the corner).
        zIndex: isPaper ? 90 : STRIP_Z_INDEX,
        opacity: isHovered ? 1 : 0,
        pointerEvents: isHovered ? 'auto' : 'none',
        transition: 'opacity 120ms ease-out',
      }}
    >
      {visible.map((tag) => {
        const isContextActive = activeContextTagId === tag.id
        // Paper theme: write the tag on a hand-torn washi tape in handwriting
        // ink (theme-following). Tape variant + tilt are stable per tag id.
        let base: React.CSSProperties = TEXT_STYLE
        if (isPaper) {
          const seed = seedFractionFromId(tag.id)
          const washiUrl = paperAssetUrl(pickPaperAsset(seed, WASHI_IDS) ?? 'washi-tape-1')
          base = {
            ...PAPER_TEXT_STYLE,
            backgroundImage: washiUrl ? `url("${washiUrl}")` : undefined,
            transform: `rotate(${((seed - 0.5) * 9).toFixed(1)}deg)`,
          }
        }
        const pillStyle: React.CSSProperties = isContextActive
          ? isPaper
            ? { ...base, color: '#9e1b14', textShadow: '0 0 6px rgba(158, 27, 20, 0.4)' }
            : {
                ...TEXT_STYLE,
                color: '#FF3B30',
                textShadow:
                  '0 0 8px rgba(255, 59, 48, 0.65),' +
                  ' 0 0 18px rgba(255, 59, 48, 0.25),' +
                  ' 0 1px 2px rgba(0, 0, 0, 0.65)',
              }
          : base
        return (
          <button
            key={tag.id}
            type="button"
            data-testid={`tag-pill-${tag.id}`}
            data-tag-id={tag.id}
            onPointerDown={stopDragSeed}
            // stopPropagation keeps the click off the card's reorder-drag seed;
            // preventDefault blocks focus-on-mouse-click so the pill doesn't
            // keep a focus ring that a later board keyboard shortcut would light
            // up (same fix as the triage tag chips). Tab focus is untouched.
            onMouseDown={(e): void => { e.stopPropagation(); e.preventDefault() }}
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
          style={isPaper
            ? { ...PAPER_TEXT_STYLE, backgroundImage: undefined, padding: '5px 4px 7px', cursor: 'default' }
            : { ...TEXT_STYLE, cursor: 'default' }}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  )
}
