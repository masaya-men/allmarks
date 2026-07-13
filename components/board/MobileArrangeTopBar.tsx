'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './MobileArrangeTopBar.module.css'

export type MobileArrangeTopBarProps = {
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly onUndo: () => void
  readonly onRedo: () => void
  /** カードが選択されているか（前面/背面/削除を出すか）。 */
  readonly hasSelection: boolean
  readonly onBringToFront: () => void
  readonly onSendToBack: () => void
  readonly onDelete: () => void
}

/** スマホのコラージュ編集段の上部バー。常に UNDO/REDO、カード選択中は
 *  TO FRONT / TO BACK / DELETE を出す。data-no-capture で撮影に写らない。
 *  MobileArrangeBar と同じグラス素材。デスクトップにはマウントしない。 */
export function MobileArrangeTopBar(props: MobileArrangeTopBarProps): ReactElement {
  return (
    <div
      className={styles.bar}
      style={{ zIndex: BOARD_Z_INDEX.SHARE_ARRANGE_TOOLBAR }}
      data-no-capture
      data-testid="mobile-arrange-topbar"
    >
      <div className={styles.group}>
        <button type="button" className={styles.action} onClick={props.onUndo} disabled={!props.canUndo} data-testid="mobile-arrange-undo">
          UNDO
        </button>
        <button type="button" className={styles.action} onClick={props.onRedo} disabled={!props.canRedo} data-testid="mobile-arrange-redo">
          REDO
        </button>
      </div>
      {props.hasSelection && (
        <div className={styles.group} data-testid="mobile-arrange-selection-tools">
          <button type="button" className={styles.action} onClick={props.onBringToFront} data-testid="mobile-arrange-to-front">
            TO FRONT
          </button>
          <button type="button" className={styles.action} onClick={props.onSendToBack} data-testid="mobile-arrange-to-back">
            TO BACK
          </button>
          <button type="button" className={styles.danger} onClick={props.onDelete} data-testid="mobile-arrange-delete">
            DELETE
          </button>
        </div>
      )}
    </div>
  )
}
