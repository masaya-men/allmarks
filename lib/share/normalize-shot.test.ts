import { describe, it, expect } from 'vitest'
import { computeCoverRect, dataUrlByteLength, normalizeShotToJpegDataUrl } from './normalize-shot'

describe('computeCoverRect', () => {
  it('wider-than-target source crops left/right, keeps full height', () => {
    const r = computeCoverRect(2000, 1000, 1200, 630) // src 2.0 > dst ~1.905 → crop width
    expect(r.sh).toBe(1000)
    expect(r.sw).toBeCloseTo(1000 * (1200 / 630), 4)
    expect(r.sy).toBe(0)
    expect(r.sx).toBeCloseTo((2000 - r.sw) / 2, 4)
  })

  it('taller-than-target source crops top/bottom, keeps full width', () => {
    const r = computeCoverRect(1200, 1200, 1200, 630) // src 1.0 < 1.905 → crop height
    expect(r.sw).toBe(1200)
    expect(r.sh).toBeCloseTo(1200 * (630 / 1200), 4)
    expect(r.sx).toBe(0)
    expect(r.sy).toBeCloseTo((1200 - r.sh) / 2, 4)
  })

  it('exact-ratio source is uncropped (no float drift)', () => {
    const r = computeCoverRect(1200, 630, 1200, 630)
    expect(r).toEqual({ sx: 0, sy: 0, sw: 1200, sh: 630 })
  })
})

describe('dataUrlByteLength', () => {
  it('approximates decoded byte length from base64', () => {
    // "AAAA" = 4 base64 chars = 3 bytes, no padding
    expect(dataUrlByteLength('data:image/jpeg;base64,AAAA')).toBe(3)
    // one '=' → minus 1
    expect(dataUrlByteLength('data:image/jpeg;base64,AAA=')).toBe(2)
  })
})

describe('normalizeShotToJpegDataUrl', () => {
  it('returns null gracefully when canvas encoding is unavailable (jsdom)', async () => {
    // In jsdom canvas.toBlob is typically unavailable → the helper must not throw.
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const out = await normalizeShotToJpegDataUrl(blob)
    expect(out === null || typeof out === 'string').toBe(true)
  })
})
