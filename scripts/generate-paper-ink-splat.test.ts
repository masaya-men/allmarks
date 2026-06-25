import { describe, it, expect } from 'vitest'
import { buildInkSplatSvg } from './generate-paper-ink-splat.mjs'

describe('generate-paper-ink-splat / buildInkSplatSvg', () => {
  it('is deterministic — same seed produces a byte-identical string', () => {
    expect(buildInkSplatSvg(4127)).toBe(buildInkSplatSvg(4127))
  })

  it('produces different output for a different seed', () => {
    expect(buildInkSplatSvg(4127)).not.toBe(buildInkSplatSvg(90511))
  })

  it('emits a 300×300 SVG with the expected viewBox', () => {
    const svg = buildInkSplatSvg(4127)
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('width="300" height="300"')
    expect(svg).toContain('viewBox="0 0 300 300"')
  })

  it('layers the mark in opacity groups (halo / core / droplets / dust)', () => {
    const svg = buildInkSplatSvg(4127)
    // four <g opacity> wrappers flatten each layer so overlaps never blotch
    const groups = svg.match(/<g opacity="/g) ?? []
    expect(groups.length).toBe(4)
  })

  it('draws warm aged-ink marks, never pure black', () => {
    const svg = buildInkSplatSvg(4127)
    expect(svg).not.toMatch(/#000000|fill="black"/i)
    // the dark pooled core tone is present
    expect(svg).toContain('#2b1f15')
  })
})
