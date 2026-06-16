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
        {tags.map((tag) => {
          const has = currentTagIds.includes(tag.id)
          return (
            <button
              key={tag.id}
              type="button"
              className={styles.chip}
              data-has={has ? 'true' : 'false'}
              onMouseDown={(e): void => e.preventDefault()}
              onClick={() => onAdd(tag.id)}
            >
              {has ? '✓ ' : ''}{tag.name}
            </button>
          )
        })}
        {hasOverflow && !expanded && (
          <button
            type="button"
            className={styles.more}
            onMouseDown={(e): void => e.preventDefault()}
            onClick={() => setExpanded(true)}
            aria-label="Show more tags"
          >
            ▾
          </button>
        )}
      </div>
    </div>
  )
}
