import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { DEMO_COLLAGE, DEMO_VIDEOS, DEMO_YOUTUBE } from './demo-collage'

const pub = (rel: string): string => join(process.cwd(), 'public', rel)

describe('demo collage manifest', () => {
  it('has at least 12 image assets, all CC0', () => {
    expect(DEMO_COLLAGE.length).toBeGreaterThanOrEqual(12)
    expect(DEMO_COLLAGE.every((a) => a.license === 'CC0')).toBe(true)
  })
  it('every image file exists with a positive aspect ratio', () => {
    for (const a of DEMO_COLLAGE) {
      expect(existsSync(pub(a.src))).toBe(true)
      expect(a.w / a.h).toBeGreaterThan(0)
    }
  })
  it('has at least 3 looping videos, each with an existing file + poster', () => {
    expect(DEMO_VIDEOS.length).toBeGreaterThanOrEqual(3)
    for (const v of DEMO_VIDEOS) {
      expect(existsSync(pub(v.src))).toBe(true)
      expect(existsSync(pub(v.poster))).toBe(true)
      expect(v.w / v.h).toBeGreaterThan(0)
    }
  })
  it('any YouTube entries are well-formed + rights-clean (may be empty this task)', () => {
    for (const y of DEMO_YOUTUBE) {
      expect(y.videoId).toMatch(/^[\w-]{11}$/)
      expect(['public-domain', 'official-brand']).toContain(y.rights)
    }
  })
})
