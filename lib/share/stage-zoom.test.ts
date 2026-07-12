import { describe, expect, it, vi } from 'vitest'
import {
  clampStageTransform,
  createCollageGestureArbiter,
  IDENTITY_STAGE_TRANSFORM,
  panStageTransform,
  pinchStageTransform,
  STAGE_ZOOM_MAX,
} from './stage-zoom'

const VW = 390
const VH = 844

describe('clampStageTransform', () => {
  it('clamps scale into [1, MAX] and pins translate to the origin at scale 1', () => {
    expect(clampStageTransform({ scale: 0.4, tx: 50, ty: -9999 }, VW, VH)).toEqual({ scale: 1, tx: 0, ty: 0 })
    const t = clampStageTransform({ scale: 100, tx: 5, ty: 5 }, VW, VH)
    expect(t.scale).toBe(STAGE_ZOOM_MAX)
    expect(t.tx).toBe(0)
    expect(t.ty).toBe(0)
  })

  it('keeps a legal transform untouched', () => {
    expect(clampStageTransform({ scale: 2, tx: -100, ty: -200 }, VW, VH)).toEqual({ scale: 2, tx: -100, ty: -200 })
  })

  it('clamps translate so the zoomed stage always covers the screen', () => {
    // scale 2 => tx in [-390, 0], ty in [-844, 0]
    expect(clampStageTransform({ scale: 2, tx: -500, ty: 10 }, VW, VH)).toEqual({ scale: 2, tx: -390, ty: 0 })
  })
})

describe('pinchStageTransform', () => {
  it('spreading two fingers zooms in around their midpoint', () => {
    const next = pinchStageTransform({
      base: IDENTITY_STAGE_TRANSFORM,
      startA: { x: 150, y: 400 },
      startB: { x: 250, y: 400 }, // dist 100, mid (200,400)
      currA: { x: 100, y: 400 },
      currB: { x: 300, y: 400 }, // dist 200 => 2x
      viewportW: VW,
      viewportH: VH,
    })
    expect(next.scale).toBeCloseTo(2)
    // content point under start-mid (200,400) stays under the current mid: tx = 200 - 200*2
    expect(next.tx).toBeCloseTo(-200)
    expect(next.ty).toBeCloseTo(-400)
  })

  it('moving both fingers together pans (scale unchanged)', () => {
    const next = pinchStageTransform({
      base: { scale: 2, tx: -100, ty: -100 },
      startA: { x: 100, y: 300 },
      startB: { x: 200, y: 300 },
      currA: { x: 130, y: 340 },
      currB: { x: 230, y: 340 }, // dist unchanged, mid +30,+40
      viewportW: VW,
      viewportH: VH,
    })
    expect(next.scale).toBeCloseTo(2)
    expect(next.tx).toBeCloseTo(-70)
    expect(next.ty).toBeCloseTo(-60)
  })

  it('never zooms below 1 and stays clamped to the screen', () => {
    const zoomedOut = pinchStageTransform({
      base: IDENTITY_STAGE_TRANSFORM,
      startA: { x: 100, y: 400 },
      startB: { x: 300, y: 400 },
      currA: { x: 190, y: 400 },
      currB: { x: 210, y: 400 }, // pinch in => ~0.1x
      viewportW: VW,
      viewportH: VH,
    })
    expect(zoomedOut).toEqual(IDENTITY_STAGE_TRANSFORM)
  })

  it('a degenerate start distance (same point) keeps the base scale', () => {
    const next = pinchStageTransform({
      base: { scale: 3, tx: -50, ty: -50 },
      startA: { x: 100, y: 100 },
      startB: { x: 100, y: 100 },
      currA: { x: 100, y: 100 },
      currB: { x: 300, y: 300 },
      viewportW: VW,
      viewportH: VH,
    })
    expect(next.scale).toBe(3)
  })
})

describe('panStageTransform', () => {
  it('translates by (dx,dy) within the clamp', () => {
    expect(panStageTransform({ scale: 2, tx: -100, ty: -100 }, 30, 40, VW, VH)).toEqual({ scale: 2, tx: -70, ty: -60 })
  })

  it('cannot pan a non-zoomed stage (scale 1 pins to origin)', () => {
    expect(panStageTransform(IDENTITY_STAGE_TRANSFORM, 50, 50, VW, VH)).toEqual({ scale: 1, tx: 0, ty: 0 })
  })
})

describe('createCollageGestureArbiter', () => {
  it('cancelActive runs the registered cancel exactly once', () => {
    const arbiter = createCollageGestureArbiter()
    const cancel = vi.fn()
    arbiter.register(cancel)
    arbiter.cancelActive()
    arbiter.cancelActive()
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('clear forgets the gesture without running it', () => {
    const arbiter = createCollageGestureArbiter()
    const cancel = vi.fn()
    arbiter.register(cancel)
    arbiter.clear()
    arbiter.cancelActive()
    expect(cancel).not.toHaveBeenCalled()
  })
})
