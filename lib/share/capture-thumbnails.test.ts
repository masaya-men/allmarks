import { describe, expect, it, vi } from 'vitest'
import { buildCaptureThumbnailMap, captureThumbnailMaxPx } from './capture-thumbnails'

describe('captureThumbnailMaxPx', () => {
  it('keeps full resolution (1200 cap) for a small selection', () => {
    // Few cards each render large in the collage — never downscale them.
    expect(captureThumbnailMaxPx(1)).toBe(1200)
    expect(captureThumbnailMaxPx(4)).toBe(1200)
  })

  it('shrinks as the card count grows, holding the total-pixel budget roughly constant', () => {
    // budget 12MP: sqrt(12e6 / count). 100 -> ~346, 25 -> ~693.
    expect(captureThumbnailMaxPx(100)).toBe(346)
    expect(captureThumbnailMaxPx(25)).toBe(693)
    // Monotonic: more cards => smaller thumbnails.
    expect(captureThumbnailMaxPx(200)).toBeLessThan(captureThumbnailMaxPx(100))
  })

  it('never goes below a legible floor', () => {
    expect(captureThumbnailMaxPx(100000)).toBe(200)
  })

  it('is safe for degenerate counts', () => {
    expect(captureThumbnailMaxPx(0)).toBe(1200)
    expect(captureThumbnailMaxPx(-3)).toBe(1200)
  })
})

describe('buildCaptureThumbnailMap', () => {
  it('maps each unique src to its downscaled data URL', async () => {
    const downscale = vi.fn(async (src: string) => `data:image/jpeg;base64,small(${src})`)
    const map = await buildCaptureThumbnailMap(['a', 'b', 'a', 'c'], downscale)
    expect(map.get('a')).toBe('data:image/jpeg;base64,small(a)')
    expect(map.get('b')).toBe('data:image/jpeg;base64,small(b)')
    expect(map.get('c')).toBe('data:image/jpeg;base64,small(c)')
    // deduped: 'a' downscaled once, not twice
    expect(downscale).toHaveBeenCalledTimes(3)
  })

  it('skips blank srcs and drops the ones that fail to downscale (capture falls back to full proxy)', async () => {
    const downscale = vi.fn(async (src: string) => (src === 'bad' ? null : `small(${src})`))
    const map = await buildCaptureThumbnailMap(['ok', '', 'bad'], downscale)
    expect(map.get('ok')).toBe('small(ok)')
    expect(map.has('bad')).toBe(false)
    expect(map.has('')).toBe(false)
  })

  it('never rejects when a downscale throws — that src is simply omitted', async () => {
    const downscale = vi.fn(async (src: string) => {
      if (src === 'boom') throw new Error('fetch failed')
      return `small(${src})`
    })
    const map = await buildCaptureThumbnailMap(['boom', 'fine'], downscale)
    expect(map.has('boom')).toBe(false)
    expect(map.get('fine')).toBe('small(fine)')
  })
})
