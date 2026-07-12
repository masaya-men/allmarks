'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { MobileZoomSlider } from './MobileZoomSlider'
import styles from './MobileArrangeBar.module.css'

export type MobileArrangeBarProps = {
  /** 選び直し（select 段へ戻る）。編集内容は破棄される。 */
  readonly onBack: () => void
  /** いまの配置のまま撮影してリンクを作る。 */
  readonly onCreate: () => void
  /** 撮影〜リンク作成中は CREATE を無効化。 */
  readonly creating: boolean
  /** スマホのボードズーム・スライダー（省略時は出さない＝デスクトップ/従来不変）。 */
  readonly zoom?: {
    readonly scale: number
    readonly onScaleChange: (nextScale: number) => void
  }
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
      {props.zoom && <MobileZoomSlider scale={props.zoom.scale} onScaleChange={props.zoom.onScaleChange} />}
      <span className={styles.hint}>TAP A CARD TO SELECT — PINCH TO RESIZE OR ROTATE — SLIDER ZOOMS THE BOARD</span>
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={props.onBack} disabled={props.creating} data-testid="mobile-arrange-back">
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
