import { describe, it, expect } from 'vitest'
import { resizeWidthFromPointer, cornerGrowSigns } from './resize-math'

describe('cornerGrowSigns', () => {
  it('maps each corner to its grow-positive x/y directions', () => {
    expect(cornerGrowSigns('br')).toEqual({ signX: 1, signY: 1 })
    expect(cornerGrowSigns('tl')).toEqual({ signX: -1, signY: -1 })
    expect(cornerGrowSigns('tr')).toEqual({ signX: 1, signY: -1 })
    expect(cornerGrowSigns('bl')).toEqual({ signX: -1, signY: 1 })
  })
})

const base = {
  corner: 'br' as const,
  startWidth: 250,
  aspect: 1.25,
  sensitivity: 2,
  min: 80,
  max: 1489,
}

describe('resizeWidthFromPointer — dominant model (board, unchanged)', () => {
  it('scales width by the dominant axis on a horizontal drag', () => {
    // drag left 40 → dx = -40 dominates → 250 + (-40 * 2) = 170
    expect(resizeWidthFromPointer({ ...base, totalDx: -40, totalDy: 0, model: 'dominant' })).toBe(170)
  })

  it('reproduces the discontinuous jump when the amplified vertical axis flips sign', () => {
    // Documents the board's CURRENT behavior (the exact defect the collage opts
    // out of): a tiny change in a slightly off-diagonal drag flips the dominant
    // axis to the opposite-sign amplified vertical term, so the width leaps.
    const before = resizeWidthFromPointer({ ...base, totalDx: -50, totalDy: 35, model: 'dominant' })
    const after = resizeWidthFromPointer({ ...base, totalDx: -45, totalDy: 45, model: 'dominant' })
    expect(before).toBe(150)
    expect(after).toBeGreaterThan(350)
    expect(after - before).toBeGreaterThan(150) // >150px jump for a ~10px pointer change
  })

  it('clamps to [min, max]', () => {
    expect(resizeWidthFromPointer({ ...base, totalDx: -1000, totalDy: 0, model: 'dominant' })).toBe(80)
    expect(resizeWidthFromPointer({ ...base, totalDx: 5000, totalDy: 0, model: 'dominant' })).toBe(1489)
  })

  it('defaults to the dominant model when none is given (board default)', () => {
    expect(resizeWidthFromPointer({ ...base, totalDx: -40, totalDy: 0 })).toBe(
      resizeWidthFromPointer({ ...base, totalDx: -40, totalDy: 0, model: 'dominant' }),
    )
  })
})

describe('resizeWidthFromPointer — projection model (collage, smooth)', () => {
  it('matches the dominant model on a pure-diagonal drag (sensitivity parity)', () => {
    // Natural corner gesture: the cursor follows the card diagonal (dx:dy = aspect:1).
    for (const [dx, dy] of [[-25, -20], [-50, -40], [-75, -60]] as const) {
      const proj = resizeWidthFromPointer({ ...base, totalDx: dx, totalDy: dy, model: 'projection' })
      const dom = resizeWidthFromPointer({ ...base, totalDx: dx, totalDy: dy, model: 'dominant' })
      expect(proj).toBeCloseTo(dom, 0)
    }
  })

  it('is continuous — no jump across the axis-disagreement zone', () => {
    // Same sweep that makes the dominant model leap >150px; projection must not.
    let prev = resizeWidthFromPointer({ ...base, totalDx: -40, totalDy: -40, model: 'projection' })
    let maxStep = 0
    for (let tdy = -40; tdy <= 40; tdy += 2) {
      const w = resizeWidthFromPointer({ ...base, totalDx: -40, totalDy: tdy, model: 'projection' })
      maxStep = Math.max(maxStep, Math.abs(w - prev))
      prev = w
    }
    // A 2px pointer step must never move the width more than a few px.
    expect(maxStep).toBeLessThan(10)
  })

  it('does not over-amplify a vertical drag on a wide card', () => {
    // aspect 3 wide card: a 40px vertical drag must NOT collapse it to MIN.
    const w = resizeWidthFromPointer({
      corner: 'br', startWidth: 300, aspect: 3, totalDx: 0, totalDy: -40,
      sensitivity: 2, min: 80, max: 1489, model: 'projection',
    })
    expect(w).toBeGreaterThan(200) // the dominant model would collapse this to ~80
  })

  it('clamps to [min, max]', () => {
    expect(resizeWidthFromPointer({ ...base, totalDx: -5000, totalDy: 0, model: 'projection' })).toBe(80)
    expect(resizeWidthFromPointer({ ...base, totalDx: 9000, totalDy: 0, model: 'projection' })).toBe(1489)
  })
})
