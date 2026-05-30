'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import styles from './TagContextMenu.module.css'

type Props = {
  /** Viewport-space coordinates where the user invoked the menu. */
  readonly x: number
  readonly y: number
  /** Tag name shown in the small caps header so the user can confirm
   *  which tag the menu is targeting. */
  readonly tagName: string
  /** Number of bookmarks this tag is currently attached to, shown as
   *  a quiet "N USES" tag below the name. */
  readonly bookmarkCount: number
  /** Fired when the user picks RENAME. The parent opens the rename dialog. */
  readonly onRename: () => void
  /** Fired when the user picks DELETE TAG. The parent opens the
   *  hold-to-confirm dialog. */
  readonly onDelete: () => void
  /** Fired on Esc, outside click, or after a row activates. */
  readonly onClose: () => void
}

const MENU_WIDTH = 220
const MENU_MARGIN = 8

/** Right-click context menu for a tag chip. Editorial AllMarks tonality:
 *  rgba(8,8,10,0.96) panel, monospace 11px small caps header showing
 *  the tag name, single DELETE row in warning red. Viewport-clamped so
 *  it never spills off-screen. Closes on Esc, outside click, or after
 *  activating the row. */
export function TagContextMenu({
  x, y, tagName, bookmarkCount, onRename, onDelete, onClose,
}: Props): ReactElement {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>(() => ({
    left: x,
    top: y,
  }))

  /* Measure after mount and re-clamp so a tall panel or near-edge
     invocation doesn't spill out of the viewport. */
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    const w = rect.width || MENU_WIDTH
    const h = rect.height
    const maxLeft = window.innerWidth - w - MENU_MARGIN
    const maxTop = window.innerHeight - h - MENU_MARGIN
    setPosition({
      left: Math.max(MENU_MARGIN, Math.min(x, maxLeft)),
      top: Math.max(MENU_MARGIN, Math.min(y, maxTop)),
    })
  }, [x, y])

  /* Esc closes. Outside click closes. Use pointerdown so it fires
     before the next contextmenu / click can reopen something else. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    const onPointerDown = (e: PointerEvent): void => {
      const panel = panelRef.current
      if (!panel) return
      const target = e.target as HTMLElement | null
      /* Right-clicking a DIFFERENT chip should re-aim the menu, not
         dismiss it. The parent's onContextMenu fires in the same
         gesture and will setContextMenu({...new}); closing here would
         lose to that and leave the menu shut. */
      if (target?.closest('[data-tag-id]')) return
      if (!panel.contains(target)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown)
    return (): void => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [onClose])

  const usesLabel = `${bookmarkCount} ${bookmarkCount === 1 ? 'USE' : 'USES'}`

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      style={{ left: position.left, top: position.top }}
      role="menu"
      aria-label={`Actions for tag ${tagName}`}
      data-testid="tag-context-menu"
      onContextMenu={(e): void => e.preventDefault()}
    >
      <div className={styles.header}>
        <span className={styles.headerName}>{tagName}</span>
        <span className={styles.headerCount}>{usesLabel}</span>
      </div>
      <button
        type="button"
        className={styles.row}
        role="menuitem"
        data-testid="tag-context-menu-rename"
        onClick={(): void => { onRename(); onClose() }}
      >
        <span className={styles.rowIcon} aria-hidden="true">✎</span>
        <span className={styles.rowLabel}>Rename</span>
      </button>
      <button
        type="button"
        className={`${styles.row} ${styles.rowDanger}`}
        role="menuitem"
        data-testid="tag-context-menu-delete"
        onClick={(): void => { onDelete(); onClose() }}
      >
        <span className={styles.rowIcon} aria-hidden="true">⚠</span>
        <span className={styles.rowLabel}>Delete tag</span>
      </button>
    </div>
  )
}
