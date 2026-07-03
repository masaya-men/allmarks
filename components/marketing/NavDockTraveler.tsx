'use client'

import { useEffect, useRef } from 'react'
import {
  NAV_DOCK,
  bandClimbProgress,
  charHopArc,
  crossGlow,
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
 * 境界（ヘッダー下端の hairline）のマイクロ演出（v3・全てスクロール駆動）:
 * - 乗り上がりは「跳ね（hop）」の波: 引き継ぎ瞬間は実 kicker と完全同姿、
 *   帯に入るほど左の文字から順に小さく跳ねる（--hop 0..1 を JS が毎フレーム書く）
 * - hairline 横断中の文字は、線より上の部分だけ僅かに横へずれる（屈折・--cut で clip）
 * - 玉は下から線に触れた瞬間に一度だけノック（squash＋リング、これのみ時間制）
 * - hairline は語の真上の区間だけほのかに灯る（crossGlow）
 *
 * - 実 kicker / ナビ実ラベルは CSS（html[data-nav-dock] 属性）で隠すだけ。
 *   属性はこのコンポーネントが mount 後にのみ書く＝SSR/prerender は従来表示のまま。
 * - 判定は nav-dock-math の範囲＋ラッチ式（Lenis の慣性で飛んでもすり抜けない）。
 * - reduced-motion / ≤960px / kicker≠ナビ語（ローカライズ言語）→ 属性を書かず演出オフ。
 */
export function NavDockTraveler({ label }: { label: string }): React.ReactElement {
  const wordRef = useRef<HTMLSpanElement>(null)
  const glowRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const word = wordRef.current
    const glowEl = glowRef.current
    const anchor = document.querySelector<HTMLElement>('[data-nav-dock-anchor]')
    const target = document.querySelector<HTMLElement>('[data-nav-dock-target]')
    if (!word || !glowEl || !anchor || !target) return

    const html = document.documentElement
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const spans = Array.from(word.querySelectorAll<HTMLElement>('span[data-ch]'))
    let mode: DockMode = 'armed'
    let settleTimer: number | undefined
    let knockTimer: number | undefined
    let knockArmed = false
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

    /** 境界演出の後始末（屈折 clip・グロー・跳ね残り） */
    const clearBoundaryFx = (): void => {
      delete word.dataset.refract
      glowEl.style.opacity = '0'
      spans.forEach((s) => s.style.setProperty('--hop', '0'))
    }

    /** 波のタイマーと文字の dip/swap 印を全て解除（morphing を離れるとき必ず呼ぶ） */
    const clearMorphWave = (): void => {
      charTimers.forEach((t) => window.clearTimeout(t))
      charTimers.length = 0
      spans.forEach((s) => {
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
      clearBoundaryFx()
      // キャンセル整定中に再進入した場合、削除タイマーごと消えるので旗を直接下ろす
      delete word.dataset.cancel
      const a = anchor.getBoundingClientRect()
      const t = target.getBoundingClientRect()
      word.style.transition = `left ${NAV_DOCK.morphAlignMs}ms ease-out, top ${NAV_DOCK.morphAlignMs}ms ease-out`
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
        // 本文から乗るときだけ玉のノックを武装（上へ降りるときは解除）
        if (mode === 'armed' && next === 'traveling') knockArmed = true
        if (next === 'armed') {
          knockArmed = false
          // settling 中に armed へ抜けても後始末が漏れないようここで掃除
          // （cancel はタイマー任せにせず即下ろす。armed では traveler 非表示）
          clearBoundaryFx()
          delete word.dataset.cancel
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
      if (mode !== 'traveling') {
        clearBoundaryFx()
        return
      }

      // ── 境界のマイクロ演出（全てスクロール駆動・毎フレーム位置から算出）──
      const P = bandClimbProgress(a.top)
      for (let i = 0; i < spans.length; i++) {
        spans[i].style.setProperty('--hop', charHopArc(P, i, spans.length).toFixed(4))
      }

      // hairline 近傍でのみ rect を読む（強制レイアウトを横断窓に限定）
      const near = a.top < NAV_DOCK.headerH + 8 && a.top > NAV_DOCK.headerH - 48
      if (!near) {
        delete word.dataset.refract
        glowEl.style.opacity = '0'
        return
      }
      const wr = word.getBoundingClientRect()
      const crossing = a.top < NAV_DOCK.headerH && a.top + wr.height > NAV_DOCK.headerH
      if (crossing) {
        word.dataset.refract = 'true'
        spans.forEach((s) => {
          const r = s.getBoundingClientRect()
          s.style.setProperty('--cut', `${(NAV_DOCK.headerH - r.top).toFixed(2)}px`)
        })
      } else {
        delete word.dataset.refract
      }

      const g = crossGlow(a.top, wr.height)
      glowEl.style.opacity = g.toFixed(3)
      if (g > 0) {
        glowEl.style.left = `${a.left - 10}px`
        glowEl.style.width = `${wr.width + 20}px`
      }

      if (knockArmed && a.top <= NAV_DOCK.headerH) {
        knockArmed = false
        word.dataset.knock = 'true'
        window.clearTimeout(knockTimer)
        knockTimer = window.setTimeout(() => {
          delete word.dataset.knock
        }, NAV_DOCK.knockMs + 20)
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
      window.clearTimeout(knockTimer)
      clearMorphWave()
      clearBoundaryFx()
      delete word.dataset.cancel
      delete word.dataset.knock
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
      window.clearTimeout(knockTimer)
      clearMorphWave()
      if (raf) window.cancelAnimationFrame(raf)
      delete html.dataset.navDock
    }
  }, [label])

  const chars = [...label]
  return (
    <>
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
            <span key={`${c}-${i}`} data-ch data-c={c} className={styles.ch}>
              {c}
            </span>
          ))}
        </span>
      </span>
      <span ref={glowRef} className={styles.hairGlow} aria-hidden="true" />
    </>
  )
}
