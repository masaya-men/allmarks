import { describe, expect, it, vi } from 'vitest'
import {
  clampStageTransform,
  createCollageGestureArbiter,
  IDENTITY_STAGE_TRANSFORM,
  panStageTransform,
  pinchStageTransform,
  STAGE_ZOOM_MAX,
  zoomStageToScale,
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

describe('zoomStageToScale', () => {
  const VW = 390
  const VH = 844

  it('keeps the content point under the pivot fixed on screen while changing scale', () => {
    const cur = { scale: 2, tx: -100, ty: -200 }
    const pivot = { x: 195, y: 400 }
    // content under pivot now: ((195-(-100))/2, (400-(-200))/2) = (147.5, 300)
    const next = zoomStageToScale(cur, 3, pivot, VW, VH)
    expect(next.scale).toBe(3)
    // that content point must map back under the pivot at the new scale (not clamped here)
    expect(147.5 * next.scale + next.tx).toBeCloseTo(195)
    expect(300 * next.scale + next.ty).toBeCloseTo(400)
  })

  it('zooming in about the screen center from identity keeps the center fixed', () => {
    const next = zoomStageToScale(IDENTITY_STAGE_TRANSFORM, 2, { x: VW / 2, y: VH / 2 }, VW, VH)
    expect(next.scale).toBe(2)
    // center content (195, 422) stays centered: 195*2 + tx = 195 => tx = -195
    expect(next.tx).toBeCloseTo(-195)
    expect(next.ty).toBeCloseTo(-422)
  })

  it('clamps scale into [1, MAX] and pins to the origin at scale 1', () => {
    expect(zoomStageToScale({ scale: 2, tx: -50, ty: -50 }, 0.2, { x: 100, y: 100 }, VW, VH)).toEqual(IDENTITY_STAGE_TRANSFORM)
    expect(zoomStageToScale(IDENTITY_STAGE_TRANSFORM, 99, { x: 0, y: 0 }, VW, VH).scale).toBe(STAGE_ZOOM_MAX)
  })
})
