import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAYER_VOLUME,
  getDefaultVolume,
  setDefaultVolume,
} from '@/lib/embed/default-volume'

const STORAGE_KEY = 'allmarks.player.defaultVolume'

describe('default-volume', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  describe('getDefaultVolume', () => {
    it('returns 50 when nothing is stored', () => {
      expect(getDefaultVolume()).toBe(DEFAULT_PLAYER_VOLUME)
      expect(DEFAULT_PLAYER_VOLUME).toBe(50)
    })
    it('returns the stored value', () => {
      window.localStorage.setItem(STORAGE_KEY, '30')
      expect(getDefaultVolume()).toBe(30)
    })
    it('returns 50 when stored value is out of range', () => {
      window.localStorage.setItem(STORAGE_KEY, '150')
      expect(getDefaultVolume()).toBe(50)
      window.localStorage.setItem(STORAGE_KEY, '-1')
      expect(getDefaultVolume()).toBe(50)
    })
    it('returns 50 when stored value is non-numeric', () => {
      window.localStorage.setItem(STORAGE_KEY, 'loud')
      expect(getDefaultVolume()).toBe(50)
    })
  })

  describe('setDefaultVolume', () => {
    it('persists the value', () => {
      setDefaultVolume(40)
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('40')
    })
    it('clamps below 0 to 0', () => {
      setDefaultVolume(-5)
      expect(getDefaultVolume()).toBe(0)
    })
    it('clamps above 100 to 100', () => {
      setDefaultVolume(150)
      expect(getDefaultVolume()).toBe(100)
    })
    it('rounds non-integers', () => {
      setDefaultVolume(37.6)
      expect(getDefaultVolume()).toBe(38)
    })
    it('emits a volume-change event', () => {
      let received: number | null = null
      const handler = (e: Event): void => {
        if (e instanceof CustomEvent) received = e.detail as number
      }
      window.addEventListener('allmarks:volume-change', handler)
      setDefaultVolume(25)
      window.removeEventListener('allmarks:volume-change', handler)
      expect(received).toBe(25)
    })
  })
})
