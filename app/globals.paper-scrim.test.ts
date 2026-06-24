import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('paper-atelier lightbox scrim', () => {
  const css = readFileSync(resolve(__dirname, 'globals.css'), 'utf8')
  const paperBlockStart = css.indexOf('html[data-theme-id="paper-atelier"]')
  const paperBlockRaw = css.slice(paperBlockStart)
  // Find the closing brace of the paper block (first top-level } after the opening {)
  const openBrace = paperBlockRaw.indexOf('{')
  let depth = 0
  let closeIdx = openBrace
  for (let i = openBrace; i < paperBlockRaw.length; i++) {
    if (paperBlockRaw[i] === '{') depth++
    else if (paperBlockRaw[i] === '}') {
      depth--
      if (depth === 0) { closeIdx = i; break }
    }
  }
  const paperBlock = paperBlockRaw.slice(0, closeIdx + 1)

  it('overrides --lightbox-backdrop to a pale parchment scrim (not the dark default)', () => {
    expect(paperBlock).toContain('--lightbox-backdrop:')
    // pale parchment: must NOT reuse the dark rgba(0, 0, 0, ...) default
    const match = paperBlock.match(/--lightbox-backdrop:\s*([^;]+);/)
    expect(match).toBeTruthy()
    expect(match![1]).not.toContain('0, 0, 0')
  })
})
