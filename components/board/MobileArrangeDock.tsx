'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './MobileArrangeDock.module.css'

export type MobileArrangeDockProps = {
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly onUndo: () => void
  readonly onRedo: () => void
  readonly onZoomOut: () => void
  readonly onZoomIn: () => void
  readonly onZoomFit: () => void
  readonly hasSelection: boolean
  readonly onBringToFront: () => void
  readonly onSendToBack: () => void
  readonly onRemove: () => void
  readonly onBack: () => void
  readonly onCreate: () => void
  readonly creating: boolean
}

export function MobileArrangeDock(props: MobileArrangeDockProps): ReactElement {
  return (
    <div className={styles.dock} style={{ zIndex: BOARD_Z_INDEX.SHARE_TOAST }} data-no-capture data-testid="mobile-arrange-dock">
      {props.hasSelection && (
        <div className={styles.rowContext} data-testid="mobile-arrange-selection-tools">
          <button type="button" className={styles.chip} onClick={props.onBringToFront} data-testid="mobile-arrange-to-front">TO FRONT</button>
          <button type="button" className={styles.chip} onClick={props.onSendToBack} data-testid="mobile-arrange-to-back">TO BACK</button>
          <button type="button" className={styles.chipDanger} onClick={props.onRemove} data-testid="mobile-arrange-remove" aria-label="Remove from image">🗑</button>
        </div>
      )}
      <div className={styles.rowTools}>
        <div className={styles.group}>
          <button type="button" className={styles.icon} onClick={props.onUndo} disabled={!props.canUndo} data-testid="mobile-arrange-undo" aria-label="Undo">↺</button>
          <button type="button" className={styles.icon} onClick={props.onRedo} disabled={!props.canRedo} data-testid="mobile-arrange-redo" aria-label="Redo">↻</button>
        </div>
        <div className={styles.group}>
          <button type="button" className={styles.icon} onClick={props.onZoomOut} data-testid="mobile-arrange-zoom-out" aria-label="Zoom out">−</button>
          <button type="button" className={styles.icon} onClick={props.onZoomFit} data-testid="mobile-arrange-zoom-fit" aria-label="Fit board">⤢</button>
          <button type="button" className={styles.icon} onClick={props.onZoomIn} data-testid="mobile-arrange-zoom-in" aria-label="Zoom in">＋</button>
        </div>
        <button type="button" className={styles.ghost} onClick={props.onBack} disabled={props.creating} data-testid="mobile-arrange-back">BACK</button>
      </div>
      <button type="button" className={styles.create} onClick={props.onCreate} disabled={props.creating} data-testid="mobile-arrange-create">
        {props.creating ? 'CREATING…' : 'CREATE'}
      </button>
    </div>
  )
}
