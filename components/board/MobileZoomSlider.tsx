'use client'

import { useRef, type PointerEvent, type ReactElement } from 'react'
import { STAGE_ZOOM_MAX, STAGE_ZOOM_MIN } from '@/lib/share/stage-zoom'
import styles from './MobileZoomSlider.module.css'

export type MobileZoomSliderProps = {
  /** 現在のズーム率（stageTransform.scale）。つまみ位置を決める controlled。 */
  readonly scale: number
  /** つまみ操作で新しいズーム率を通知（BoardRoot が pivot 中心に適用する）。 */
  readonly onScaleChange: (nextScale: number) => void
}

const RANGE = STAGE_ZOOM_MAX - STAGE_ZOOM_MIN

/** スマホ ARRANGE のボードズーム・スライダー（N-58）。選択解除なしでいつでもボードを
 *  拡大できる見える操作。位置指定は持たず、ARRANGE バーの縦積みの中に1行として載る。
 *  値域は STAGE_ZOOM_MIN..MAX（線形）。撮影の transform ラッパーの外に置かれ、
 *  data-no-capture なので共有画像には写らない（そもそもボードズームは state に無影響）。 */
export function MobileZoomSlider(props: MobileZoomSliderProps): ReactElement {
  const trackRef = useRef<HTMLDivElement | null>(null)

  const fraction = Math.min(1, Math.max(0, (props.scale - STAGE_ZOOM_MIN) / RANGE))

  const scaleFromClientX = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return props.scale
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return STAGE_ZOOM_MIN + f * RANGE
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.button > 0) return
    e.preventDefault()
    const el = trackRef.current
    if (!el) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* jsdom / synthetic pointer */
    }
    props.onScaleChange(scaleFromClientX(e.clientX))
    const move = (ev: globalThis.PointerEvent): void => {
      props.onScaleChange(scaleFromClientX(ev.clientX))
    }
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      try {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      } catch {
        /* jsdom / synthetic pointer */
      }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  return (
    <div className={styles.wrap} data-no-capture data-testid="mobile-zoom-slider">
      <span className={styles.glyph} aria-hidden="true">
        {/* minimal magnifier glyph (mono, currentColor) */}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M15.5 15.5 L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handlePointerDown}
        data-testid="mobile-zoom-slider-track"
        role="slider"
        aria-label="Board zoom"
        aria-valuemin={STAGE_ZOOM_MIN}
        aria-valuemax={STAGE_ZOOM_MAX}
        aria-valuenow={Math.round(props.scale * 10) / 10}
      >
        <div className={styles.fill} style={{ width: `${fraction * 100}%` }} />
        <div className={styles.thumb} style={{ left: `${fraction * 100}%` }} data-testid="mobile-zoom-slider-thumb" />
      </div>
    </div>
  )
}
