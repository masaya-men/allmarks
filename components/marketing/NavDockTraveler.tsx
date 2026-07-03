'use client'

import { useEffect, useRef } from 'react'
import {
  NAV_DOCK,
  isDockEligible,
  morphProgress,
  morphTotalMs,
  nextDockMode,
  type DockMode,
} from '@/lib/scroll/nav-dock-math'
import styles from './NavDockTraveler.module.css'

/**
 * N-05 — 本文 kicker（緑玉＋ページ名）がヘッダーのガラス帯に乗り上がり、
 * ナビの行の高さで止まって1文字ずつ衣装替え（morphing）した後、
 * 右へダッシュしてナビの自分のスロットへバウンド着地する traveler。
 *
 * - 実 kicker / ナビ実ラベルは CSS（html[data-nav-dock] 属性）で隠すだけ。
 *   属性はこのコンポーネントが mount 後にのみ書く＝SSR/prerender は従来表示のまま。
 * - 判定は nav-dock-math の範囲＋ラッチ式（Lenis の慣性で飛んでもすり抜けない）。
 *   位置は毎フレーム実 DOM rect（getBoundingClientRect）追従。
 *   morphing 中だけは位置を凍結し、タイマーが波と完了を刻む。
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
    let morphTimer: number | undefined
    const charTimers: number[] = []
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

    const chSpans = (): HTMLElement[] =>
      Array.from(word.querySelectorAll<HTMLElement>('span[data-ch]'))

    /** 波のタイマーと文字の dip/swap 印を全て解除（morphing を離れるとき必ず呼ぶ） */
    const clearMorphWave = (): void => {
      charTimers.forEach((t) => window.clearTimeout(t))
      charTimers.length = 0
      window.clearTimeout(morphTimer)
      chSpans().forEach((s) => {
        delete s.dataset.dip
        delete s.dataset.swap
      })
    }

    /** 寸法モーフ（font-size/letter-spacing/weight/gap = --mp の calc）を
     *  実プロパティの transition で滑らかに動かすための共通文字列 */
    const morphTransition = (ms: number, ease: string): string[] => [
      `font-size ${ms}ms ${ease}`,
      `letter-spacing ${ms}ms ${ease}`,
      `font-weight ${ms}ms ${ease}`,
      `gap ${ms}ms ${ease}`,
    ]

    /** その場で変身: 位置を凍結（横はその場・高さはナビの行）し、
     *  左から右へ1文字ずつ dip→swap。完了タイマーで toDocked へ。 */
    const toMorphing = (): void => {
      mode = 'morphing'
      html.dataset.navDock = 'morphing'
      setWordState('morphing', true)
      const a = anchor.getBoundingClientRect()
      const t = target.getBoundingClientRect()
      const spans = chSpans()
      const total = morphTotalMs(spans.length)
      const ease = 'cubic-bezier(0.2, 0.85, 0.25, 1)'
      word.style.transition = [
        `left ${NAV_DOCK.morphAlignMs}ms ease-out`,
        `top ${NAV_DOCK.morphAlignMs}ms ease-out`,
        ...morphTransition(total, ease),
      ].join(', ')
      word.style.left = `${a.left}px`
      word.style.top = `${t.top}px`
      setMorph(1)
      spans.forEach((s, i) => {
        charTimers.push(
          window.setTimeout(() => {
            s.dataset.dip = 'true'
          }, i * NAV_DOCK.morphCharDelayMs),
          window.setTimeout(() => {
            delete s.dataset.dip
            s.dataset.swap = 'true'
          }, i * NAV_DOCK.morphCharDelayMs + NAV_DOCK.morphCharMs / 2),
        )
      })
      window.clearTimeout(morphTimer)
      morphTimer = window.setTimeout(() => {
        // キャンセル済みなら何もしない（clearMorphWave がタイマーを消すが二重防御）
        if (mode === 'morphing') toDocked()
      }, total + 40)
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

    /** 本文へ帰る（docked からは returnMs、morphing キャンセルは morphCancelMs）。
     *  文字は一斉に本文の姿へ（data-cancel で乗り上がり用 stagger を無効化） */
    const toTravelingBack = (ms: number): void => {
      mode = 'traveling'
      html.dataset.navDock = 'traveling'
      clearMorphWave()
      word.dataset.cancel = 'true'
      setWordState('traveling', true)
      const a = anchor.getBoundingClientRect()
      word.style.transition = [
        `left ${ms}ms cubic-bezier(.4,0,.2,1)`,
        `top ${ms}ms cubic-bezier(.4,0,.2,1)`,
        ...morphTransition(ms, 'ease'),
      ].join(', ')
      follow(a)
      setMorph(0)
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        delete word.dataset.cancel
        // settle 中にモードが変わっていても巻き戻さない(現 mode を反映)
        setWordState(mode, false)
        frame()
      }, ms + 20)
    }

    const frame = (): void => {
      if (!enabled) return
      const a = anchor.getBoundingClientRect()
      const next = nextDockMode(mode, a.top)
      const settling = word.dataset.settling === 'true'

      if (next !== mode) {
        if (next === 'morphing') {
          toMorphing()
          return
        }
        if ((mode === 'docked' || mode === 'morphing') && next === 'traveling') {
          toTravelingBack(mode === 'morphing' ? NAV_DOCK.morphCancelMs : NAV_DOCK.returnMs)
          return
        }
        mode = next
        html.dataset.navDock = next
        setWordState(next, false)
      }

      // morphing はタイマー駆動（位置凍結）。settle 中も触らない
      if (mode === 'morphing' || settling) return
      word.style.transition = 'none'
      if (mode === 'docked') {
        follow(target.getBoundingClientRect())
        setMorph(1)
      } else {
        follow(a)
        setMorph(0)
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
      clearMorphWave()
      delete word.dataset.cancel
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
      clearMorphWave()
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
      style={{
        ['--mp' as string]: 0,
        ['--morph-half' as string]: `${NAV_DOCK.morphCharMs / 2}ms`,
        ['--morph-cancel' as string]: `${NAV_DOCK.morphCancelMs}ms`,
      }}
    >
      <span className={styles.dot} />
      <span className={styles.txt}>
        {chars.map((c, i) => (
          <span
            key={`${c}-${i}`}
            data-ch
            className={styles.ch}
            style={{ ['--climb-delay' as string]: `${i * NAV_DOCK.charDelayMs}ms` }}
          >
            {c}
          </span>
        ))}
      </span>
    </span>
  )
}
