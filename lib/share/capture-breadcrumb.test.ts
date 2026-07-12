import { afterEach, describe, expect, it } from 'vitest'
import {
  clearCaptureBreadcrumb,
  formatCaptureBreadcrumb,
  readStaleCaptureBreadcrumb,
  writeCaptureBreadcrumb,
  type CaptureBreadcrumb,
} from './capture-breadcrumb'

const SAMPLE: CaptureBreadcrumb = {
  ts: 1_700_000_000_000,
  cardCount: 100,
  frameW: 390,
  frameH: 844,
  scale: 3.08,
  canvasW: 1201,
  canvasH: 2600,
  sourceMP: 342.5,
}

afterEach(() => clearCaptureBreadcrumb())

describe('capture breadcrumb (N-56 crash-durable diagnostics)', () => {
  it('round-trips a written breadcrumb', () => {
    writeCaptureBreadcrumb(SAMPLE)
    expect(readStaleCaptureBreadcrumb()).toEqual(SAMPLE)
  })

  it('returns null once cleared (the normal, no-crash path)', () => {
    writeCaptureBreadcrumb(SAMPLE)
    clearCaptureBreadcrumb()
    expect(readStaleCaptureBreadcrumb()).toBeNull()
  })

  it('returns null when nothing was ever written', () => {
    expect(readStaleCaptureBreadcrumb()).toBeNull()
  })

  it('returns null (never throws) on a corrupt / partial stored value', () => {
    localStorage.setItem('allmarks:capture-breadcrumb', '{ not json')
    expect(readStaleCaptureBreadcrumb()).toBeNull()
    localStorage.setItem('allmarks:capture-breadcrumb', JSON.stringify({ cardCount: 5 }))
    expect(readStaleCaptureBreadcrumb()).toBeNull()
  })

  it('formats a compact human line naming both memory drivers', () => {
    // Both the canvas size AND the total source-image megapixels are shown, so a
    // single real-device read tells us which one blew the memory budget.
    expect(formatCaptureBreadcrumb(SAMPLE)).toBe('100 cards · canvas 1201×2600 (x3.08) · images 343MP')
  })

  it('write is a no-op (does not throw) when storage is unavailable', () => {
    const original = globalThis.localStorage
    // Simulate Safari private mode / disabled storage: setItem throws.
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        setItem: (): never => { throw new Error('QuotaExceededError') },
        getItem: (): null => null,
        removeItem: (): void => {},
      },
    })
    expect(() => writeCaptureBreadcrumb(SAMPLE)).not.toThrow()
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original })
  })
})
