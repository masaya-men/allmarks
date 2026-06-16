'use client'

import { useState, type JSX } from 'react'
import type { QuickTag } from '@/lib/tagger/order-tags-for-save'
import styles from './PipTagStrip.module.css'

export interface PipTagStripProps {
  /** Existing tags, relevant-first (from orderTagsForSave). */
  tags: readonly QuickTag[]
  /** Already-applied tag ids — rendered with ✓ prefix + data-has="true". */
  currentTagIds: readonly string[]
  /** Called when a chip is tapped. */
  onAdd: (tagId: string) => void
}

/**
 * Compact existing-tags strip for the PiP window.
 * All chips are always mounted in the DOM; collapse is visual-only so that
 * tests can find all tag names regardless of expanded state.
 * The `▾` expand button toggles a data-expanded attribute on the root which
 * CSS uses to hide/show overflow chips.
 *
 * Collapse-back is intentionally omitted for v1: the strip is opened via the
 * card "+" button and dismissed by closing the PiP / the card, so an in-strip
 * collapse-back would add complexity with no clear user need (YAGNI).
 */
export function PipTagStrip({ tags, currentTagIds, onAdd }: PipTagStripProps): JSX.Element | null {
  const [expanded, setExpanded] = useState(false)

  if (tags.length === 0) return null

  const hasOverflow = tags.length > 2

  return (
    <div
      className={styles.strip}
      data-expanded={expanded ? 'true' : 'false'}
    >
      <div className={styles.row}>
        {tags.map((t, i) => {
          const has = currentTagIds.includes(t.id)
          return (
            <button
              key={t.id}
              type="button"
              className={styles.chip}
              data-has={has ? 'true' : 'false'}
              data-overflow={i >= 2 ? 'true' : undefined}
              onMouseDown={(e): void => e.preventDefault()}
              onClick={() => onAdd(t.id)}
            >
              {has ? '✓ ' : ''}{t.name}
            </button>
          )
        })}
        {hasOverflow && !expanded && (
          <button
            type="button"
            className={styles.more}
            onMouseDown={(e): void => e.preventDefault()}
            onClick={() => setExpanded(true)}
            aria-label="Show all tags"
          >
            ▾
          </button>
        )}
      </div>
    </div>
  )
}
