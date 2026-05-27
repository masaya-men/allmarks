// lib/share/snapshot.test.ts
// jsdom 環境では canvas / Image / dom-to-image-more が完全動作しないため、
// null 返却のみ確認する。 実環境の動作は playwright integration test で別途検証。
import { describe, it, expect } from 'vitest'
import { captureViewportWebP } from './snapshot'

describe('captureViewportWebP', () => {
  it('returns null when no element provided', async () => {
    const result = await captureViewportWebP(null, { width: 600, quality: 0.7 })
    expect(result).toBeNull()
  })

  it('returns null for zero-size element', async () => {
    const fake = {
      getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }),
    } as unknown as HTMLElement
    const result = await captureViewportWebP(fake)
    expect(result).toBeNull()
  })
})
