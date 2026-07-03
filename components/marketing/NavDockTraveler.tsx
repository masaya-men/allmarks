'use client'

import { useEffect, useRef } from 'react'
import {
  NAV_DOCK,
  isDockEligible,
  morphProgress,
  nextDockMode,
  type DockMode,
} from '@/lib/scroll/nav-dock-math'
import styles from './NavDockTraveler.module.css'

/**
 * N-05 — 本文 kicker（緑玉＋ページ名）がヘッダーのガラス帯に乗り上がり、
 * 右へダッシュしてナビの自分のスロットへバウンド着地する traveler。
 *
 * - 実 kicker / ナビ実ラベルは CSS（html[data-nav-dock] 属性）で隠すだけ。
 *   属性はこのコンポーネントが mount 後にのみ書く＝SSR/prerender は従来表示のまま。
 * - 判定は nav-dock-math の範囲＋ラッチ式（Lenis の慣性で飛んでもすり抜けない）。
 *   位置は毎フレーム実 DOM rect（getBoundingClientRect）追従。
 * - reduced-motion / ≤960px / kicker≠ナビ語（ローカライズ言語）→ 属性を書かず演出オフ。
 */
export function NavDockTraveler({ label }: { label: string }): React.ReactElement {
  const wordRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const word = wordRef.current
    const anchor = document.querySelector<HTMLElement>('[data-nav-dock-anchor]')
    const target = document.querySelector<HTMLElement>('[data-nav-dock-target]')
    if (!word || !anchor || !target) return

    const html = document.documentElement
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let mode: DockMode = 'armed'
    let settleTimer: number | undefined
    let raf = 0
    let enabled = false

    const eligible = (): boolean =>
      isDockEligible({
        reducedMotion: reduced.matches,
        viewportWidth: window.innerWidth,
        kickerText: anchor.textContent,
        navLabel: label,
      })

    const setWordState = (state: DockMode, settling: boolean): void => {
      word.dataset.state = state
      word.dataset.settling = settling ? 'true' : 'false'
    }

    const follow = (rect: DOMRect): void => {
      word.style.left = `${rect.left}px`
      word.style.top = `${rect.top}px`
    }

    const setMorph = (p: number): void => {
      word.style.setProperty('--mp', p.toFixed(3))
    }

    const toDocked = (): void => {
      mode = 'docked'
      html.dataset.navDock = 'docked'
      setWordState('docked', true)
      const t = target.getBoundingClientRect()
      word.style.transition = `left ${NAV_DOCK.zipMs}ms cubic-bezier(.34,1.42,.64,1), top ${NAV_DOCK.zipMs}ms cubic-bezier(.34,1.42,.64,1)`
      follow(t)
      setMorph(1)
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        // settle 中にモードが変わっていても巻き戻さない(現 mode を反映)
        setWordState(mode, false)
        frame()
      }, NAV_DOCK.zipMs + 40)
    }

    const toTravelingBack = (): void => {
      mode = 'traveling'
      html.dataset.navDock = 'traveling'
      setWordState('traveling', true)
      const a = anchor.getBoundingClientRect()
      word.style.transition = `left ${NAV_DOCK.returnMs}ms cubic-bezier(.4,0,.2,1), top ${NAV_DOCK.returnMs}ms cubic-bezier(.4,0,.2,1)`
      follow(a)
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        // settle 中にモードが変わっていても巻き戻さない(現 mode を反映)
        setWordState(mode, false)
        frame()
      }, NAV_DOCK.returnMs + 20)
    }

    const frame = (): void => {
      if (!enabled) return
      const a = anchor.getBoundingClientRect()
      const next = nextDockMode(mode, a.top)
      const settling = word.dataset.settling === 'true'

      if (next !== mode) {
        if (next === 'docked') {
          toDocked()
          return
        }
        if (mode === 'docked' && next === 'traveling') {
          toTravelingBack()
          return
        }
        mode = next
        html.dataset.navDock = next
        setWordState(next, false)
      }

      if (settling) return
      word.style.transition = 'none'
      if (mode === 'docked') {
        follow(target.getBoundingClientRect())
        setMorph(1)
      } else {
        follow(a)
        setMorph(mode === 'armed' ? 0 : morphProgress(a.top))
      }
    }

    const onScroll = (): void => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        frame()
      })
    }

    const enable = (): void => {
      if (enabled) return
      enabled = true
      mode = 'armed'
      html.dataset.navDock = 'armed'
      setWordState('armed', false)
      frame()
    }

    const disable = (): void => {
      if (!enabled) return
      enabled = false
      window.clearTimeout(settleTimer)
      delete html.dataset.navDock
      setWordState('armed', false)
    }

    const evaluate = (): void => {
      if (eligible()) enable()
      else disable()
      if (enabled) frame()
    }

    evaluate()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', evaluate)
    reduced.addEventListener('change', evaluate)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', evaluate)
      reduced.removeEventListener('change', evaluate)
      window.clearTimeout(settleTimer)
      if (raf) window.cancelAnimationFrame(raf)
      delete html.dataset.navDock
    }
  }, [label])

  const chars = [...label]
  return (
    <span
      ref={wordRef}
      className={styles.word}
      aria-hidden="true"
      data-state="armed"
      data-settling="false"
      style={{ ['--mp' as string]: 0 }}
    >
      <span className={styles.dot} />
      <span className={styles.txt}>
        {chars.map((c, i) => (
          <span
            key={`${c}-${i}`}
            className={styles.ch}
            style={{ transitionDelay: `${i * NAV_DOCK.charDelayMs}ms` }}
          >
            {c}
          </span>
        ))}
      </span>
    </span>
  )
}
