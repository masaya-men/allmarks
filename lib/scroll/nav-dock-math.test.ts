// lib/scroll/nav-dock-math.test.ts
import { describe, expect, it } from 'vitest'
import {
  NAV_DOCK,
  dashEase,
  dashProgress,
  isDockEligible,
  morphProgress,
  morphTotalMs,
  nextDockMode,
} from './nav-dock-math'

describe('morphProgress', () => {
  it('glassStart より下では 0', () => {
    expect(morphProgress(500)).toBe(0)
    expect(morphProgress(NAV_DOCK.glassStart)).toBe(0)
  })
  it('dockY で 1、さらに上（負方向）でも 1 に張り付く', () => {
    expect(morphProgress(NAV_DOCK.dockY)).toBe(1)
    expect(morphProgress(-200)).toBe(1)
  })
  it('中間は線形補間（glassStart と dockY の中点で 0.5）', () => {
    const mid = (NAV_DOCK.glassStart + NAV_DOCK.dockY) / 2
    expect(morphProgress(mid)).toBeCloseTo(0.5, 5)
  })
})

describe('nextDockMode（範囲＋ラッチ式＝Lenis の慣性で1フレームに大きく飛んでもすり抜けない）', () => {
  it('armed: ガラス帯進入（進捗>glassOnAt）で traveling', () => {
    expect(nextDockMode('armed', NAV_DOCK.glassStart - 20)).toBe('traveling')
  })
  it('armed: 帯より下では armed のまま', () => {
    expect(nextDockMode('armed', 400)).toBe('armed')
  })
  it('traveling: anchorTop <= dockY で morphing（大きく飛び越しても範囲判定で捕まえる）', () => {
    expect(nextDockMode('traveling', NAV_DOCK.dockY)).toBe('morphing')
    expect(nextDockMode('traveling', -500)).toBe('morphing')
  })
  it('morphing: どれだけ下へ飛んでも morphing を維持（帯上の全期間＝位置は anchorTop の純関数）', () => {
    expect(nextDockMode('morphing', NAV_DOCK.dockY)).toBe('morphing')
    expect(nextDockMode('morphing', -500)).toBe('morphing')
  })
  it('morphing: dockY+releaseGap まで戻したらキャンセルで traveling', () => {
    expect(nextDockMode('morphing', NAV_DOCK.dockY + NAV_DOCK.releaseGap)).toBe('traveling')
    expect(nextDockMode('morphing', NAV_DOCK.dockY + NAV_DOCK.releaseGap - 1)).toBe('morphing')
  })
  it('traveling: 帯の外（restGap 分のヒステリシス）へ戻ったら armed', () => {
    expect(nextDockMode('traveling', NAV_DOCK.glassStart + NAV_DOCK.restGap + 1)).toBe('armed')
  })
  it('traveling: 帯内にいる間は traveling を維持', () => {
    expect(nextDockMode('traveling', 60)).toBe('traveling')
    expect(nextDockMode('traveling', NAV_DOCK.glassStart + 2)).toBe('traveling')
  })
})

describe('dashProgress（スクロール駆動の横移動 0→1。とどまり holdPx → 横断 dashPx）', () => {
  const dashStartY = NAV_DOCK.dockY - NAV_DOCK.holdPx
  it('発動直後〜とどまり区間は 0（その場に留まる）', () => {
    expect(dashProgress(NAV_DOCK.dockY)).toBe(0)
    expect(dashProgress(dashStartY)).toBe(0)
  })
  it('dashPx 区間で線形に 0→1（中点で 0.5）', () => {
    expect(dashProgress(dashStartY - NAV_DOCK.dashPx / 2)).toBeCloseTo(0.5, 5)
  })
  it('dashPx を越えたら 1 に張り付く（枠に定着）', () => {
    expect(dashProgress(dashStartY - NAV_DOCK.dashPx)).toBe(1)
    expect(dashProgress(-10000)).toBe(1)
  })
})

describe('dashEase（出だし素早く・終端で僅かに行き過ぎて「はまる」easeOutBack 系）', () => {
  it('両端は 0 と 1 に一致', () => {
    expect(dashEase(0)).toBeCloseTo(0, 8)
    expect(dashEase(1)).toBeCloseTo(1, 8)
  })
  it('序盤から速い（0.3 で既に半分を越える）', () => {
    expect(dashEase(0.3)).toBeGreaterThan(0.5)
  })
  it('終端手前で僅かに 1 を行き過ぎる（overshoot ≒ +1.5%）', () => {
    const peak = dashEase(0.74)
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThan(1.03)
  })
})

describe('isDockEligible', () => {
  const base = { reducedMotion: false, viewportWidth: 1489, kickerText: 'Features', navLabel: 'Features' }
  it('全条件成立で true', () => {
    expect(isDockEligible(base)).toBe(true)
  })
  it('reduced-motion で false（ユーザー確定 2026-07-03: OS設定を尊重して全オフ）', () => {
    expect(isDockEligible({ ...base, reducedMotion: true })).toBe(false)
  })
  it('960px 以下は false（ナビにスロットが無い）', () => {
    expect(isDockEligible({ ...base, viewportWidth: 960 })).toBe(false)
    expect(isDockEligible({ ...base, viewportWidth: 961 })).toBe(true)
  })
  it('kicker とナビ語の不一致（ローカライズ済み13言語）は false', () => {
    expect(isDockEligible({ ...base, kickerText: '기능' })).toBe(false)
    expect(isDockEligible({ ...base, kickerText: null })).toBe(false)
  })
  it('大文字小文字・前後空白は無視して一致扱い（kicker は CSS uppercase 表示のため）', () => {
    expect(isDockEligible({ ...base, kickerText: '  FEATURES ' })).toBe(true)
  })
})

describe('morphTotalMs（変身の総時間 = ラベル長で決まる）', () => {
  it('8文字(FEATURES) = 7*morphCharDelayMs + morphCharMs = 450ms', () => {
    expect(morphTotalMs(8)).toBe(450)
  })
  it('1文字 = morphCharMs のみ', () => {
    expect(morphTotalMs(1)).toBe(NAV_DOCK.morphCharMs)
  })
  it('0 以下でも正の時間を返す（防御）', () => {
    expect(morphTotalMs(0)).toBe(NAV_DOCK.morphCharMs)
  })
})
