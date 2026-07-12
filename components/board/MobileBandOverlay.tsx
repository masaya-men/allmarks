'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import type { CollageFitRect } from '@/lib/share/collage-layout'
import styles from './MobileBandOverlay.module.css'

export type MobileBandOverlayProps = {
  /** 撮影される 1.91:1 の帯（.outerFrame 座標）。 */
  readonly band: CollageFitRect
}

/** スマホのコラージュ編集中に「この範囲が画像になる」を示すガイド。帯の外側を
 *  巨大な box-shadow で減光し（＝写らない領域がそのまま暗く見える WYSIWYG）、
 *  境界は細い破線。pointer-events:none なので帯の内外どちらの編集も邪魔しない。
 *  data-no-capture なので撮影には写らない。 */
export function MobileBandOverlay(props: MobileBandOverlayProps): ReactElement | null {
  const { band } = props
  if (!(band.width > 0) || !(band.height > 0)) return null
  return (
    <div
      className={styles.band}
      data-no-capture
      data-testid="mobile-band-overlay"
      style={{
        left: `${band.x}px`,
        top: `${band.y}px`,
        width: `${band.width}px`,
        height: `${band.height}px`,
        zIndex: BOARD_Z_INDEX.SHARE_BAND_OVERLAY,
      }}
    />
  )
}
