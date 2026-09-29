'use client'

import { useEffect, useRef } from 'react'
import { meterProgress, meterTickAt, scrollFromPointer } from '@/lib/marketing/lp/page-scroll-meter'
import styles from './PageScrollMeter.module.css'

/**
 * 区切りの目盛りを付ける区画(上から順に 3 つ: Problem・Features・最後の黒い区画)を探す関数。
 * CSS Modules はクラス名が変わるので、id と data 属性で探す。見つからない区画は目盛りを出さない。
 */
const TICK_TARGETS: readonly ((scope: HTMLElement) => HTMLElement | null)[] = [
  (scope) => scope.querySelector<HTMLElement>('#problem'),
  (scope) => scope.querySelector<HTMLElement>('#features'),
  (scope) => scope.querySelector<HTMLElement>('[data-finale-cta]')?.closest('section') ?? null,
]

/** 測り直しのデバウンス(他の区画のリサイズ処理と同じ 160ms)。 */
const RESIZE_DEBOUNCE_MS = 160

/**
 * PageScrollMeter — LP の右端に出すスクロールメーター(ページ全体の進み具合)。
 *
 * LandingPage が LP の間だけ標準のスクロールバーを隠す(<html data-lp-scrollbar="custom">)ので、その代わりに、
 * LP の「まっすぐな黒い線」の言葉づかいで、ふつうのスクロールバーの見た目にはしない細い線を右端に固定で出す。
 * 幅 2px の下地と、進んだ分だけ上から伸びる線。Problem・Features・最後の黒い区画が始まる位置に、下地の左へ
 * 長さ 8px の目盛り。入れ物にだけ mix-blend-mode: difference を付けるので、白い紙の上では黒、黒い締めと
 * フッターの上では白に見える。.content の外(BackgroundGrid の直後)に置くのは、本文の描画結果と混ぜるため。
 *
 * 操作: 幅 20px の見えない当たり判定を押すとその位置へ瞬時にスクロールし、つまんだまま動かすと追従する
 * (pointer capture)。飾りの補助なので aria-hidden(ホイール・キーボードの普通のスクロールはそのまま使える)。
 * 位置 → スクロール位置の変換と、進み・目盛りの計算は lib/marketing/lp/page-scroll-meter.ts の純関数。
 *
 * 寸法(ページの高さ・目盛りの位置・メーターの位置)は、レイアウト時・リサイズ時(160ms デバウンス)・
 * fonts.ready 後・load 時・LP 自身の大きさが変わった時にだけ測ってキャッシュする。スクロール中は測らず、
 * scroll イベント + rAF で 1 フレーム 1 回、値が変わった時だけ transform を書く。
 * 動きを減らす設定: 動きの演出は無い(太さの変化の transition だけ CSS で外す)。
 */
export function PageScrollMeter(): React.ReactElement {
  const rootRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const hitRef = useRef<HTMLDivElement>(null)
  const tickRefs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    const root = rootRef.current
    const fill = fillRef.current
    const hit = hitRef.current
    const scope = root?.parentElement
    if (!root || !fill || !hit || !scope) return undefined
    const ticks = tickRefs.current

    // ── 測った値(レイアウト時にだけ更新) ──
    let pageH = 0
    let viewH = 0
    let maxScroll = 0
    let trackTop = 0
    let trackH = 0
    let written = ''
    let disposed = false

    // 線の伸びを書く。書くのは transform だけで、値が変わった時だけ。
    const draw = (): void => {
      const s = meterProgress(window.scrollY, pageH, viewH).toFixed(4)
      if (s === written) return
      written = s
      fill.style.transform = `scaleY(${s})`
    }

    // 測る: ページの高さ・メーターの位置・区切りの目盛りの位置。
    const layout = (): void => {
      if (disposed) return
      pageH = document.documentElement.scrollHeight
      viewH = window.innerHeight
      maxScroll = Math.max(0, pageH - viewH)
      const rect = root.getBoundingClientRect()
      trackTop = rect.top
      trackH = rect.height
      const scrollNow = window.scrollY
      TICK_TARGETS.forEach((find, i) => {
        const tick = ticks[i]
        if (!tick) return
        const section = find(scope)
        if (!section) {
          tick.style.display = 'none'
          return
        }
        const sectionTop = section.getBoundingClientRect().top + scrollNow
        // 1px の線なので、整数 px に置く(% だと等倍の画面で 2px にじむ)。メーターの高さが変わればリサイズ時に
        // 測り直す。下端(進み 1)の目盛りは、線がメーターの外へはみ出さないよう 1px 内側に収める。
        const y = Math.min(Math.max(trackH - 1, 0), Math.round(meterTickAt(sectionTop, pageH, viewH) * trackH))
        tick.style.top = `${y}px`
        tick.style.display = 'block'
      })
      draw()
    }

    // ── スクロール: scroll イベント + rAF で 1 フレーム 1 回 ──
    let rafId = 0
    const onScroll = (): void => {
      if (rafId !== 0) return
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        draw()
      })
    }

    // ── 測り直すきっかけ: リサイズ(160ms デバウンス)・fonts.ready・load・LP 自身の大きさの変化 ──
    let resizeTimer: number | undefined
    const onResize = (): void => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(layout, RESIZE_DEBOUNCE_MS)
    }

    // ── 操作: 押した位置へスクロール / つまんだまま動かすと追従 / 離すと終わり ──
    let dragging = false
    let hovering = false
    const paintActive = (): void => {
      root.classList.toggle(styles.active, hovering || dragging)
    }
    const scrollToPointer = (clientY: number): void => {
      window.scrollTo({ top: scrollFromPointer(clientY, trackTop, trackH, maxScroll), left: 0, behavior: 'instant' })
    }
    const onPointerDown = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      dragging = true
      hit.setPointerCapture(e.pointerId)
      paintActive()
      scrollToPointer(e.clientY)
    }
    const onPointerMove = (e: PointerEvent): void => {
      if (dragging) scrollToPointer(e.clientY)
    }
    const onPointerEnd = (e: PointerEvent): void => {
      if (!dragging) return
      dragging = false
      if (hit.hasPointerCapture(e.pointerId)) hit.releasePointerCapture(e.pointerId)
      paintActive()
    }
    const onPointerEnter = (): void => {
      hovering = true
      paintActive()
    }
    const onPointerLeave = (): void => {
      hovering = false
      paintActive()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('load', layout)
    hit.addEventListener('pointerdown', onPointerDown)
    hit.addEventListener('pointermove', onPointerMove)
    hit.addEventListener('pointerup', onPointerEnd)
    hit.addEventListener('pointercancel', onPointerEnd)
    hit.addEventListener('lostpointercapture', onPointerEnd)
    hit.addEventListener('pointerenter', onPointerEnter)
    hit.addEventListener('pointerleave', onPointerLeave)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize)
    resizeObserver?.observe(scope)
    if (document.fonts?.ready) {
      void document.fonts.ready.then(layout)
    }

    layout()

    return () => {
      disposed = true
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('load', layout)
      hit.removeEventListener('pointerdown', onPointerDown)
      hit.removeEventListener('pointermove', onPointerMove)
      hit.removeEventListener('pointerup', onPointerEnd)
      hit.removeEventListener('pointercancel', onPointerEnd)
      hit.removeEventListener('lostpointercapture', onPointerEnd)
      hit.removeEventListener('pointerenter', onPointerEnter)
      hit.removeEventListener('pointerleave', onPointerLeave)
      resizeObserver?.disconnect()
      window.clearTimeout(resizeTimer)
      if (rafId !== 0) window.cancelAnimationFrame(rafId)
      root.classList.remove(styles.active)
      fill.style.transform = ''
      for (const tick of ticks) {
        if (tick) {
          tick.style.display = ''
          tick.style.top = ''
        }
      }
    }
  }, [])

  return (
    <div ref={rootRef} className={styles.meter} aria-hidden="true" data-lp-page-scroll-meter>
      <span className={styles.track} />
      <span ref={fillRef} className={styles.fill} />
      {TICK_TARGETS.map((_, i) => (
        <span
          key={i}
          className={styles.tick}
          ref={(el) => {
            tickRefs.current[i] = el
          }}
        />
      ))}
      <div ref={hitRef} className={styles.hit} />
    </div>
  )
}
