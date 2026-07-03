'use client'

import { useEffect, useRef } from 'react'
import {
  NAV_DOCK,
  dashEase,
  dashProgress,
  isDockEligible,
  morphProgress,
  morphTotalMs,
  nextDockMode,
  type DockMode,
} from '@/lib/scroll/nav-dock-math'
import styles from './NavDockTraveler.module.css'

/**
 * N-05 — 本文 kicker（緑玉＋ページ名）がヘッダーのガラス帯に乗り上がり、
 * ナビの行の高さで止まって1文字ずつ衣装替え（morphing）。その後は
 * スクロール量に応じて右のナビ枠へ横移動し（逆走で左へ戻る＝完全可逆）、
 * ナビの自分のスロットに定着する traveler。
 *
 * - 実 kicker / ナビ実ラベルは CSS（html[data-nav-dock] 属性）で隠すだけ。
 *   属性はこのコンポーネントが mount 後にのみ書く＝SSR/prerender は従来表示のまま。
 * - 判定は nav-dock-math の範囲＋ラッチ式（Lenis の慣性で飛んでもすり抜けない）。
 *   帯上（morphing）の位置は毎フレーム実 rect からの純関数＝保存状態なし。
 *   時間制なのは衣装替えの波と、帯を離れる時の垂直帰還だけ。
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
      chSpans().forEach((s) => {
        delete s.dataset.dip
        delete s.dataset.swap
      })
    }

    /** その場で変身: ナビの行の高さへ寄せて凍結し、左から右へ1文字ずつ dip→swap。
     *  寸法モーフ（--mp 0→1）の滑らかさは CSS（.txt の transition）が担う。 */
    const toMorphing = (): void => {
      mode = 'morphing'
      html.dataset.navDock = 'morphing'
      setWordState('morphing', true)
      const a = anchor.getBoundingClientRect()
      const t = target.getBoundingClientRect()
      word.style.transition = `left ${NAV_DOCK.morphAlignMs}ms ease-out, top ${NAV_DOCK.morphAlignMs}ms ease-out`
      word.style.left = `${a.left}px`
      word.style.top = `${t.top}px`
      setMorph(1)
      chSpans().forEach((s, i) => {
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
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        // settle 中にモードが変わっていても巻き戻さない(現 mode を反映)
        setWordState(mode, false)
        frame()
      }, NAV_DOCK.morphAlignMs + 20)
    }

    /** 帯を離れて本文へ帰る。横スクラブは離脱時点で必ず 0（＝kicker と同じ左位置）
     *  なので垂直移動のみ＝斜めの軌跡にならない。文字は一斉に本文の姿へ。 */
    const toTravelingBack = (): void => {
      mode = 'traveling'
      html.dataset.navDock = 'traveling'
      clearMorphWave()
      word.dataset.cancel = 'true'
      setWordState('traveling', true)
      const a = anchor.getBoundingClientRect()
      word.style.transition = `left ${NAV_DOCK.morphCancelMs}ms cubic-bezier(.4,0,.2,1), top ${NAV_DOCK.morphCancelMs}ms cubic-bezier(.4,0,.2,1)`
      follow(a)
      setMorph(0)
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        delete word.dataset.cancel
        // settle 中にモードが変わっていても巻き戻さない(現 mode を反映)
        setWordState(mode, false)
        frame()
      }, NAV_DOCK.morphCancelMs + 20)
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
        if (mode === 'morphing' && next === 'traveling') {
          toTravelingBack()
          return
        }
        mode = next
        html.dataset.navDock = next
        setWordState(next, false)
      }

      if (settling) return
      word.style.transition = 'none'
      if (mode === 'morphing') {
        // とどまり→横移動→定着: 位置は anchorTop の純関数（スクラブ＝可逆）
        const t = target.getBoundingClientRect()
        const p = dashEase(dashProgress(a.top))
        word.style.left = `${a.left + (t.left - a.left) * p}px`
        word.style.top = `${t.top}px`
        return
      }
      follow(a)
      setMorph(0)
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
        ['--morph-total' as string]: `${morphTotalMs(chars.length)}ms`,
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
