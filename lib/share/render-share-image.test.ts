import { it, expect } from 'vitest'
import { jpegUnderTarget } from './render-share-image'
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
