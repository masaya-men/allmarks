import { describe, it, expect } from 'vitest'
import { buildPaperFiberSvg } from './generate-paper-texture.mjs'

describe('generate-paper-texture / buildPaperFiberSvg', () => {
  it('is deterministic — same seed produces a byte-identical string', () => {
    expect(buildPaperFiberSvg(701)).toBe(buildPaperFiberSvg(701))
  })

  it('produces different output for a different seed', () => {
    expect(buildPaperFiberSvg(701)).not.toBe(buildPaperFiberSvg(702))
  })

  it('emits a tiling SVG with the expected width/height/viewBox', () => {
    const svg = buildPaperFiberSvg(701)
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('width="160" height="160"')
    expect(svg).toContain('viewBox="0 0 160 160"')
  })

  it('emits exactly the requested speckle count (one <circle> per fiber fleck)', () => {
    const svg = buildPaperFiberSvg(701, { speckles: 220 })
    const circles = svg.match(/<circle\b/g) ?? []
    expect(circles.length).toBe(220)
  })

  it('uses ONLY low-alpha ink/cream flecks (no opaque fill on flecks)', () => {
    const svg = buildPaperFiberSvg(701)
    // every circle opacity is < 0.2 so the tile reads as faint grain, never specks of solid color
    const opacities = [...svg.matchAll(/<circle[^>]*opacity="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(opacities.length).toBeGreaterThan(0)
    expect(Math.max(...opacities)).toBeLessThan(0.2)
  })
})
