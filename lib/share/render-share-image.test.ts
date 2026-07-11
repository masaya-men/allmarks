import { describe, it, expect, vi } from 'vitest'

const { toJpeg } = vi.hoisted(() => ({ toJpeg: vi.fn() }))
vi.mock('dom-to-image-more', () => ({ default: { toJpeg } }))

import { jpegUnderTarget, renderShareImage } from './render-share-image'

it('returns the first quality that fits the byte budget', async () => {
  const big = 'data:image/jpeg;base64,' + 'A'.repeat(4000)   // ~3KB
  const small = 'data:image/jpeg;base64,' + 'A'.repeat(400)  // ~300B
  const out = await jpegUnderTarget((q) => Promise.resolve(q >= 0.8 ? big : small), 1024, 0.9, 0.4)
  expect(out).toBe(small)
})
it('returns the smallest when nothing fits', async () => {
  const big = 'data:image/jpeg;base64,' + 'A'.repeat(4000)
  const out = await jpegUnderTarget(() => Promise.resolve(big), 10, 0.9, 0.7)
  expect(out).toBe(big)
})

describe('renderShareImage onError (N-56 diagnostics)', () => {
  it('reports the thrown error message and still resolves null', async () => {
    toJpeg.mockReset()
    toJpeg.mockRejectedValueOnce(new Error('boom'))
    const messages: string[] = []
    const node = document.createElement('div')
    const out = await renderShareImage(node, {
      width: 100,
      height: 100,
      targetBytes: 1024,
      startQuality: 0.9,
      minQuality: 0.9,
      onError: (m): void => { messages.push(m) },
    })
    expect(out).toBeNull()
    expect(messages.length).toBeGreaterThan(0)
    expect(messages[0]).toContain('boom')
  })
})
