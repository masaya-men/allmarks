'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './MobileArrangeBar.module.css'

export type MobileArrangeBarProps = {
  /** 選び直し（select 段へ戻る）。編集内容は破棄される。 */
  readonly onBack: () => void
  /** いまの配置のまま撮影してリンクを作る。 */
  readonly onCreate: () => void
  /** 撮影〜リンク作成中は CREATE を無効化。 */
  readonly creating: boolean
}

/** スマホのコラージュ編集段のボトムバー。デスクトップの ShareToast(CREATE) の
 *  モバイル版に相当する。data-no-capture なので撮影には写らない。 */
export function MobileArrangeBar(props: MobileArrangeBarProps): ReactElement {
  return (
    <div
      className={styles.bar}
      style={{ zIndex: BOARD_Z_INDEX.SHARE_TOAST }}
      data-no-capture
      data-testid="mobile-arrange-bar"
    >
      <span className={styles.hint}>DRAG TO ARRANGE — THE BRIGHT BAND BECOMES THE IMAGE</span>
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={props.onBack} data-testid="mobile-arrange-back">
          BACK
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={props.onCreate}
          disabled={props.creating}
          data-testid="mobile-arrange-create"
        >
          {props.creating ? 'CREATING…' : 'CREATE'}
        </button>
      </div>
    </div>
  )
}
