import { describe, it, expect } from 'vitest'
import {
  featState,
  featTarget,
  featureLayouts,
  featFollow,
  featSpeedCap,
  cursorTip,
  FEATURE_CARDS,
  CARD_FILM,
  CARD_DRAG,
  FEAT_SPEED_BASE,
  FEAT_LAG_FREE,
  FEAT_SPEED_GAIN,
  FEAT_DT_MAX_MS,
  FEAT_FOLLOW_TAU_MS,
  type FeatureGeometry,
  type FeatureHover,
  type FeatureState,
} from './feature-timeline'

/* SHARE(610,28)は MOTION(690,28)と music(330,28)の一直線上 = 04 でカーソルが通過する位置(通過中に光らないことの確認用) */
const g: FeatureGeometry = {
  L: featureLayouts(700),
  bw: 700, bh: 460, bx: 16, by: 58, shotK: 0.2,
  pills: { all: { x: 8, w: 30 }, music: { x: 60, w: 44 }, design: { x: 126, w: 50 } },
  tip: cursorTip(40),
  to: {
    motion: { x: 690, y: 28 }, share: { x: 610, y: 28 }, music: { x: 330, y: 28 }, design: { x: 400, y: 28 },
    start: { x: 366, y: 300 }, copy: { x: 420, y: 500 },
  },
}
/** 段 seg の中の進み f(0..1)に当たる P。 */
const at = (seg: number, f: number): number => seg + 0.08 + 0.72 * f
const idx = (tag: string): number[] => FEATURE_CARDS.map((c, i) => (c.tag === tag ? i : -1)).filter((i) => i >= 0)
/** 段 seg を f=0→1 まで 0.001 刻みで見た状態。 */
const scan = (seg: number): FeatureState[] => Array.from({ length: 1001 }, (_, k) => featState(at(seg, k / 1000), g))
const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y)
/** 02 の終わりにドラッグしたカードが着く位置 = 03 のカーソルの出発点。 */
const E1 = {
  x: g.bx + g.L.C.slots[CARD_DRAG].x + g.L.A.cw * 0.5,
  y: g.by + g.L.C.slots[CARD_DRAG].y + g.L.A.cw * 0.45,
}

describe('featureLayouts', () => {
  it('uses 3 columns at 700px and puts every card in layout C', () => {
    const L = featureLayouts(700)
    expect(L.C.cw).toBeCloseTo((700 - 20) / 3)
    expect(Object.keys(L.C.slots)).toHaveLength(FEATURE_CARDS.length)
    expect(L.A.slots[0]).toBeUndefined()
  })
})

describe('featState', () => {
  it('P<=0 is the very start: the new card is not visible yet', () => {
    const s = featState(0, g)
    expect(s.seg).toBe(0); expect(s.f).toBe(0); expect(s.cards[0].visible).toBe(false)
  })
  it('01: the paste pill is done after the card lands', () => {
    expect(featState(at(0, 0.6), g).pasteDone).toBe(true)
  })
  it('03: the film plays, MOTION is on, the film card is emphasised', () => {
    const s = featState(at(2, 0.3), g)
    expect(s.playing).toBe(true); expect(s.motionOn).toBe(true)
    expect(s.focus).toBeGreaterThan(0.99); expect(s.cards[CARD_FILM].scale).toBeCloseTo(1.03)
  })
  it('03: the cursor presses MOTION at f=.70 and a ring expands', () => {
    const s = featState(at(2, 0.71), g)
    expect(s.cursor.pressed).toBe(true); expect(s.ring).not.toBeNull()
    expect(featState(at(2, 0.69), g).motionOn).toBe(true)
    expect(featState(at(2, 0.71), g).motionOn).toBe(false)
  })
  it('03: after the click everything is stopped', () => {
    const s = featState(at(2, 0.9), g)
    expect(s.playing).toBe(false); expect(s.motionOn).toBe(false)
  })
  it('04: music first (pressed at .33), then design only (pressed at .75)', () => {
    expect(featState(at(3, 0.34), g).cursor.pressed).toBe(true)
    expect(featState(at(3, 0.76), g).cursor.pressed).toBe(true)
    const m = featState(at(3, 0.45), g)
    expect(m.activeTag).toBe('music')
    for (const i of idx('music')) expect(m.cards[i].visible).toBe(true)
    for (const i of [...idx('design'), ...idx('life')]) expect(m.cards[i].visible).toBe(false)
    const d = featState(at(3, 0.95), g)
    expect(d.activeTag).toBe('design')
    for (const i of idx('design')) expect(d.cards[i].visible).toBe(true)
    for (const i of [...idx('music'), ...idx('life')]) expect(d.cards[i].visible).toBe(false)
  })
  it('05: the start screen covers the board, then wipes away after the click at .45', () => {
    const a = featState(at(4, 0.2), g)
    expect(a.startVisible).toBe(true); expect(a.startOpacity).toBeGreaterThan(0.99)
    expect(featState(at(4, 0.45), g).startPress).toBe(true)
    const b = featState(at(4, 0.95), g)
    expect(b.startVisible).toBe(false); expect(b.frameT).toBe(1); expect(b.chipOpacity).toBeGreaterThan(0.99)
  })
  it('06: SHARE press at .33 → the board becomes an image → copy pressed at .89 → copied', () => {
    expect(featState(at(5, 0.33), g).sharePress).toBe(true)
    expect(featState(at(5, 0.7), g).copied).toBe(false)
    const s = featState(at(5, 0.95), g)
    expect(s.copied).toBe(true); expect(s.boardScale).toBeCloseTo(0.8); expect(s.chipsT).toBe(1)
  })
  it('the rail follows P/6', () => { expect(featState(3, g).rail).toBe(0.5) })
})

describe('cursor', () => {
  it('cursorTip puts the tip at (5, 2.5) of the 24px viewBox and scales with the size', () => {
    expect(cursorTip(24)).toEqual({ x: 5, y: 2.5 })
    expect(cursorTip(40).x).toBeCloseTo((40 * 5) / 24)
    expect(cursorTip(30).y).toBeCloseTo((30 * 2.5) / 24)
    expect(cursorTip(80).x).toBeCloseTo(2 * cursorTip(40).x)
  })
  it('stays fully visible from 02 to just before the end of 06, and fades only at the end of 06', () => {
    expect(featState(0, g).cursor.opacity).toBe(0)
    expect(featState(1, g).cursor.opacity).toBe(0)
    for (let P = 1.13; P <= 5.89; P += 0.01) expect(featState(P, g).cursor.opacity).toBeCloseTo(1, 6)
    const fading = [5.9, 5.93, 5.96, 5.99].map((P) => featState(P, g).cursor.opacity)
    expect(fading[0]).toBeCloseTo(1, 6)
    for (let k = 1; k < fading.length; k++) expect(fading[k]).toBeLessThan(fading[k - 1])
    expect(featState(6, g).cursor.opacity).toBe(0)
  })
  it('shown (the green first-appearance ring) is true only while the cursor is visible', () => {
    expect(featState(0, g).cursor.shown).toBe(false)
    expect(featState(1, g).cursor.shown).toBe(false)
    expect(featState(at(1, 0.2), g).cursor.shown).toBe(true)
    expect(featState(5.5, g).cursor.shown).toBe(true)
    expect(featState(6, g).cursor.shown).toBe(false)
  })
  it('each step starts with the cursor exactly where the previous step left it', () => {
    for (let seg = 2; seg <= 5; seg++) {
      const prevEnd = featState(at(seg - 1, 1), g).cursor
      const start = featState(at(seg, 0), g).cursor
      expect(start.x).toBeCloseTo(prevEnd.x, 6); expect(start.y).toBeCloseTo(prevEnd.y, 6)
      /* 段の境目(P が整数)をまたいでも動かない */
      const before = featState(seg - 1e-6, g).cursor
      const after = featState(seg + 1e-6, g).cursor
      expect(after.x).toBeCloseTo(before.x, 3); expect(after.y).toBeCloseTo(before.y, 3)
    }
  })
  it('the resting places are the drag drop point, MOTION, design, the start button, then copy', () => {
    const end = (seg: number): { x: number; y: number } => featState(at(seg, 1), g).cursor
    expect(dist(end(1), E1)).toBeLessThan(1e-6)
    expect(dist(end(2), g.to.motion)).toBeLessThan(1e-6)
    expect(dist(end(3), g.to.design)).toBeLessThan(1e-6)
    expect(dist(end(4), g.to.start)).toBeLessThan(1e-6)
    expect(dist(end(5), g.to.copy)).toBeLessThan(1e-6)
  })
})

describe('hover (only the current target, only while stopped on it just before the press)', () => {
  const expected: FeatureHover[][] = [[], [], ['motion'], ['music', 'design'], ['start'], ['share', 'copy']]
  for (let seg = 0; seg <= 5; seg++) {
    it(`step 0${seg + 1}: ${expected[seg].length ? expected[seg].join(' then ') : 'no target'}`, () => {
      const runs: FeatureHover[] = []
      let prev: FeatureHover | null = null
      for (const s of scan(seg)) {
        if (s.hover && s.hover !== prev) runs.push(s.hover)
        prev = s.hover
        if (s.hover) {
          /* ホバー中 = カーソルは対象の上にいて、まだ押していない(押し込み・波紋の前) */
          expect(dist(s.cursor, g.to[s.hover])).toBeLessThan(1)
          expect(s.cursor.pressed).toBe(false)
          expect(s.ring).toBeNull()
        }
      }
      expect(runs).toEqual(expected[seg])
    })
  }
  it('the window runs from arriving on the target until the press starts', () => {
    const on = scan(2).filter((s) => s.hover === 'motion')
    expect(on[0].f).toBeGreaterThanOrEqual(0.6 - 1e-9)
    expect(on[on.length - 1].f).toBeLessThan(0.7 - 0.012 + 1e-9)
    expect(featState(at(2, 0.55), g).hover).toBeNull()
    expect(featState(at(2, 0.7), g).hover).toBeNull()
    expect(featState(at(2, 0.9), g).hover).toBeNull()
  })
  it('04: passing over SHARE on the way to music does not light SHARE (or anything)', () => {
    let crossed = false
    for (const s of scan(3)) {
      if (s.f < 0.24 && dist(s.cursor, g.to.share) < 6) { crossed = true; expect(s.hover).toBeNull() }
    }
    expect(crossed).toBe(true)
  })
  it('05: design (where the cursor still sits at the start) does not stay lit', () => {
    const s = featState(at(4, 0), g)
    expect(dist(s.cursor, g.to.design)).toBeLessThan(1e-6)
    expect(s.hover).toBeNull()
  })
  it('04: leaving music (after pressing) does not light music again', () => {
    for (const f of [0.34, 0.4, 0.5, 0.56, 0.6]) expect(featState(at(3, f), g).hover).toBeNull()
  })
})

describe('featTarget', () => {
  it('maps pin progress to P with the same offset as the mock and clamps', () => {
    expect(featTarget(0)).toBe(0); expect(featTarget(1)).toBe(6); expect(featTarget(0.5)).toBeCloseTo(3.1)
  })
})

describe('follow (how the shown position catches up with the scroll)', () => {
  const FRAME = 1000 / 60
  /** 固定区間を一定の速さ(段/秒)で最後まで回す間の追従を 60fps で再現する。 */
  function scrollThrough(stepsPerSec: number, afterSec = 0): { maxLag: number; atPinEnd: number; final: number } {
    const total = 6.6 / stepsPerSec
    let cur = 0, maxLag = 0, atPinEnd = 0
    for (let t = 0; t <= total + afterSec; t += FRAME / 1000) {
      const target = featTarget(Math.min(1, t / total))
      cur = featFollow(cur, target, FRAME)
      maxLag = Math.max(maxLag, Math.abs(target - cur))
      if (t <= total) atPinEnd = cur
    }
    return { maxLag, atPinEnd, final: cur }
  }

  it('featSpeedCap: the base speed while the lag is small, faster the more it lags (either direction)', () => {
    expect(featSpeedCap(0)).toBe(FEAT_SPEED_BASE)
    expect(featSpeedCap(FEAT_LAG_FREE)).toBe(FEAT_SPEED_BASE)
    expect(featSpeedCap(-0.2)).toBe(FEAT_SPEED_BASE)
    expect(featSpeedCap(0.85)).toBeCloseTo(FEAT_SPEED_BASE + FEAT_SPEED_GAIN * (0.85 - FEAT_LAG_FREE))
    expect(featSpeedCap(1)).toBeGreaterThan(featSpeedCap(0.6))
    expect(featSpeedCap(3)).toBeGreaterThan(featSpeedCap(1))
    expect(featSpeedCap(-1)).toBe(featSpeedCap(1))
  })
  it('never passes the target, and always moves toward it, in both directions', () => {
    for (const [cur, target] of [[0, 6], [6, 0], [2.5, 2.6], [2.6, 2.5], [0, 0.001]] as const) {
      const next = featFollow(cur, target, FRAME)
      expect(next).toBeGreaterThanOrEqual(Math.min(cur, target)); expect(next).toBeLessThanOrEqual(Math.max(cur, target))
      expect(Math.abs(target - next)).toBeLessThan(Math.abs(target - cur))
    }
  })
  it('one frame never moves more than the speed cap allows (no skipping)', () => {
    for (const lag of [0.05, 0.3, 0.35, 0.6, 1, 3, 6]) {
      expect(featFollow(0, lag, FRAME)).toBeLessThanOrEqual((featSpeedCap(lag) * FRAME) / 1000 + 1e-12)
    }
  })
  it('a small lag closes 1 - exp(-dt/tau) of the gap per frame, the same at any frame rate', () => {
    const one = featFollow(0, 0.1, 16)
    expect(one).toBeCloseTo(0.1 * (1 - Math.exp(-16 / FEAT_FOLLOW_TAU_MS)), 10)
    expect(featFollow(featFollow(0, 0.1, 8), 0.1, 8)).toBeCloseTo(one, 10)
  })
  it('clamps dt so a long pause (tab switch) does not jump, and dt=0 does not move', () => {
    expect(featFollow(0, 6, 5000)).toBe(featFollow(0, 6, FEAT_DT_MAX_MS))
    expect(featFollow(2, 6, 0)).toBe(2)
  })
  it('a brisk scroll (1 step/s) lags by at most about half a step and 06 finishes before the pin ends', () => {
    const r = scrollThrough(1)
    expect(r.maxLag).toBeLessThanOrEqual(0.5)
    expect(featState(r.atPinEnd, g).copied).toBe(true)
  })
  it('a slow scroll (0.6 step/s) stays right behind the scroll', () => {
    const r = scrollThrough(0.6)
    expect(r.maxLag).toBeLessThan(0.2)
    expect(featState(r.atPinEnd, g).copied).toBe(true)
  })
  it('a hard flick (2 steps/s) still plays 06 to the end within 0.6s of the scroll ending', () => {
    expect(featState(scrollThrough(2, 0.6).final, g).copied).toBe(true)
  })
  it('a sudden jump to the end is replayed through every step in order, and is done in about a second or two', () => {
    let cur = 0, frames = 0, maxStep = 0
    const segs: number[] = []
    while (!featState(cur, g).copied && frames < 600) {
      const next = featFollow(cur, 6, FRAME)
      maxStep = Math.max(maxStep, next - cur)
      cur = next
      frames++
      const seg = featState(cur, g).seg
      if (segs[segs.length - 1] !== seg) segs.push(seg)
    }
    expect(segs).toEqual([0, 1, 2, 3, 4, 5])
    expect(maxStep).toBeLessThan(0.3)
    expect(frames * FRAME).toBeLessThan(2000)
  })
})
