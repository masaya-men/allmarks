import { describe, expect, it } from 'vitest'
import { isUniformSample, isUniformImage } from './uniform-image'

function rgba(pixels: ReadonlyArray<readonly [number, number, number]>): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length * 4)
  pixels.forEach(([r, g, b], i) => {
    out[i * 4] = r
    out[i * 4 + 1] = g
    out[i * 4 + 2] = b
    out[i * 4 + 3] = 255
  })
  return out
}

describe('isUniformSample', () => {
  it('flags an all-white sample as uniform (the iOS blank-render signature)', () => {
    expect(isUniformSample(rgba([[255, 255, 255], [255, 255, 255], [255, 255, 255]]))).toBe(true)
  })

  it('tolerates JPEG noise within the tolerance', () => {
    expect(isUniformSample(rgba([[250, 250, 250], [253, 251, 248], [255, 255, 255]]))).toBe(true)
  })

  it('a real collage (board colour + one card pixel) is NOT uniform', () => {
    expect(isUniformSample(rgba([[10, 10, 11], [10, 10, 11], [200, 40, 40]]))).toBe(false)
  })

  it('an empty / tiny sample counts as uniform (nothing to share)', () => {
    expect(isUniformSample(new Uint8ClampedArray(0))).toBe(true)
    expect(isUniformSample(rgba([[0, 0, 0]]))).toBe(true)
  })
})

describe('isUniformImage', () => {
  it('returns false (=not uniform, do not kill the capture) when canvas 2d is unavailable (jsdom)', () => {
    const img = new Image()
    expect(isUniformImage(img)).toBe(false)
  })
})
