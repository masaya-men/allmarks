import { describe, it, expect } from 'vitest'
import { featState, featTarget, featureLayouts, FEATURE_CARDS, CARD_FILM, type FeatureGeometry } from './feature-timeline'

const g: FeatureGeometry = {
  L: featureLayouts(700),
  bw: 700, bh: 460, bx: 16, by: 58, shotK: 0.2,
  pills: { all: { x: 8, w: 30 }, music: { x: 60, w: 44 }, design: { x: 126, w: 50 } },
  to: {
    motion: { x: 690, y: 28 }, share: { x: 610, y: 28 }, music: { x: 330, y: 28 }, design: { x: 400, y: 28 },
    start: { x: 366, y: 300 }, copy: { x: 420, y: 500 }, rest: { x: 660, y: 510 },
  },
}
/** 段 seg の中の進み f(0..1)に当たる P。 */
const at = (seg: number, f: number): number => seg + 0.08 + 0.72 * f
const idx = (tag: string): number[] => FEATURE_CARDS.map((c, i) => (c.tag === tag ? i : -1)).filter((i) => i >= 0)

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
  it('03: the cursor presses MOTION at f=.645 and a ring expands', () => {
    const s = featState(at(2, 0.645), g)
    expect(s.cursor.pressed).toBe(true); expect(s.ring).not.toBeNull()
  })
  it('03: after the click everything is stopped', () => {
    const s = featState(at(2, 0.9), g)
    expect(s.playing).toBe(false); expect(s.motionOn).toBe(false)
  })
  it('04: music first, then design only', () => {
    const m = featState(at(3, 0.45), g)
    expect(m.activeTag).toBe('music')
    for (const i of idx('music')) expect(m.cards[i].visible).toBe(true)
    for (const i of [...idx('design'), ...idx('life')]) expect(m.cards[i].visible).toBe(false)
    const d = featState(at(3, 0.95), g)
    expect(d.activeTag).toBe('design')
    for (const i of idx('design')) expect(d.cards[i].visible).toBe(true)
    for (const i of [...idx('music'), ...idx('life')]) expect(d.cards[i].visible).toBe(false)
  })
  it('05: the start screen covers the board, then wipes away after the click', () => {
    const a = featState(at(4, 0.2), g)
    expect(a.startVisible).toBe(true); expect(a.startOpacity).toBeGreaterThan(0.99)
    expect(featState(at(4, 0.4), g).startPress).toBe(true)
    const b = featState(at(4, 0.95), g)
    expect(b.startVisible).toBe(false); expect(b.frameT).toBe(1); expect(b.chipOpacity).toBeGreaterThan(0.99)
  })
  it('06: SHARE press → the board becomes an image → copied', () => {
    expect(featState(at(5, 0.2), g).sharePress).toBe(true)
    const s = featState(at(5, 0.9), g)
    expect(s.copied).toBe(true); expect(s.boardScale).toBeCloseTo(0.8); expect(s.chipsT).toBe(1)
  })
  it('the rail follows P/6', () => { expect(featState(3, g).rail).toBe(0.5) })
})

describe('featTarget', () => {
  it('maps pin progress to P with the same offset as the mock and clamps', () => {
    expect(featTarget(0)).toBe(0); expect(featTarget(1)).toBe(6); expect(featTarget(0.5)).toBeCloseTo(3.1)
  })
})
