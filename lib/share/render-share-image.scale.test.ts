import { describe, expect, it, beforeEach, vi } from 'vitest'

const { toJpeg } = vi.hoisted(() => ({ toJpeg: vi.fn() }))
vi.mock('dom-to-image-more', () => ({ default: { toJpeg } }))

import { renderShareImage } from './render-share-image'

const TINY_JPEG = 'data:image/jpeg;base64,AAAA'

describe('renderShareImage — scale passthrough', () => {
  beforeEach(() => {
    toJpeg.mockReset()
    toJpeg.mockResolvedValue(TINY_JPEG)
  })

  it('forwards scale to dom-to-image when provided', async () => {
    const node = document.createElement('div')
    await renderShareImage(node, {
      width: 390, height: 844, targetBytes: 8 * 1024 * 1024,
      startQuality: 0.94, minQuality: 0.94, scale: 3.0769,
    })
    expect(toJpeg).toHaveBeenCalledOnce()
    const opts = toJpeg.mock.calls[0]?.[1] as Record<string, unknown>
    expect(opts.scale).toBe(3.0769)
    expect(opts.width).toBe(390)
    expect(opts.height).toBe(844)
  })

  it('omits scale entirely when not provided (desktop path unchanged)', async () => {
    const node = document.createElement('div')
    await renderShareImage(node, {
      width: 1489, height: 679, targetBytes: 8 * 1024 * 1024,
      startQuality: 0.94, minQuality: 0.94,
    })
    const opts = toJpeg.mock.calls[0]?.[1] as Record<string, unknown>
    expect('scale' in opts).toBe(false)
  })
})
