import { describe, it, expect } from 'vitest'
import { currentColumnCount, fillValueAtColumns, snapToFillAtCurrentColumns } from './fill-snap'

describe('currentColumnCount', () => {
  it('counts how many uniform cards+gaps fit in the container', () => {
    // width 100, gap 20, container 500 → floor((500+20)/(100+20)) = floor(4.33) = 4
    expect(currentColumnCount(100, 20, 500)).toBe(4)
  })
  it('is at least 1 for a card wider than the container', () => {
    expect(currentColumnCount(600, 20, 500)).toBe(1)
  })
  it('guards zero/negative container or width', () => {
    expect(currentColumnCount(100, 20, 0)).toBe(1)
    expect(currentColumnCount(0, 20, 500)).toBe(1)
  })
})

describe('fillValueAtColumns', () => {
  it('width that fills exactly at N columns (equal L/R margins)', () => {
    // 5 columns, gap 20, container 1180 → (1180 - 4*20)/5 = 220
    expect(fillValueAtColumns(5, 20, 1180, 'width', 120, 720)).toBe(220)
  })
  it('gap that fills exactly at N columns', () => {
    // 5 columns, width 220, container 1180 → (1180 - 5*220)/4 = 20
    expect(fillValueAtColumns(5, 220, 1180, 'gap', 0, 300)).toBe(20)
  })
  it('returns null when the fill value is outside [min,max]', () => {
    expect(fillValueAtColumns(1, 0, 5000, 'width', 120, 720)).toBeNull() // 5000 > max
  })
  it('returns null for gap axis with a single column (gap undefined)', () => {
    expect(fillValueAtColumns(1, 220, 1180, 'gap', 0, 300)).toBeNull()
  })
})

describe('snapToFillAtCurrentColumns', () => {
  const base = { other: 20, containerWidth: 1180, axis: 'width' as const, min: 120, max: 720 }
  it('snaps a near-fill width to the exact fill value at the CURRENT column count', () => {
    // current width 224, gap 20 → N = floor((1180+20)/(224+20)) = floor(4.91) = 4
    // fill at 4 cols = (1180 - 3*20)/4 = 280 — but 224 is far from 280, so NO snap here.
    // Use a width close to its own N's fill: width 216 → N = floor(1200/236)=5, fill@5 = 220, |216-220|=4 → snaps to 220.
    expect(snapToFillAtCurrentColumns({ ...base, value: 216, thresholdPx: 10 })).toBe(220)
  })
  it('does NOT jump to a different column count (5 stays 5, never 4)', () => {
    // width 219 → N=5, fill@5=220 (snaps up to 220), never to fill@4=280.
    const snapped = snapToFillAtCurrentColumns({ ...base, value: 219, thresholdPx: 10 })
    expect(snapped).toBe(220)
    expect(snapped).not.toBe(280)
  })
  it('leaves a value far from its column fill untouched', () => {
    // width 250 → N = floor(1200/270)=4, fill@4=280, |250-280|=30 > threshold → unchanged.
    expect(snapToFillAtCurrentColumns({ ...base, value: 250, thresholdPx: 10 })).toBe(250)
  })
})
