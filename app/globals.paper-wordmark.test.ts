import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const css = readFileSync(resolve(__dirname, 'globals.css'), 'utf8')
const paperBlock = (() => {
  const start = css.indexOf('html[data-theme-id="paper-atelier"]')
  const open = css.indexOf('{', start)
  // Depth-counting matcher: walk forward tracking open/close brace nesting so
  // nested {} (media queries, sub-rules, future additions) are handled correctly.
  let depth = 0
  let i = open
  while (i < css.length) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) break
    }
    i++
  }
  return css.slice(open, i) // slice up to (not including) the closing '}'
})()

describe('paper-atelier letterpress wordmark tokens', () => {
  it('defines all five wordmark letterpress tokens inside the paper block', () => {
    expect(paperBlock).toContain('--wordmark-ink-color:')
    expect(paperBlock).toContain('--wordmark-grain-url:')
    expect(paperBlock).toContain('--wordmark-grain-opacity:')
    expect(paperBlock).toContain('--wordmark-emboss-light:')
    expect(paperBlock).toContain('--wordmark-emboss-shadow:')
  })
  it('reuses Task 2 paper-fiber tile (no separate download)', () => {
    expect(paperBlock).toContain('--wordmark-grain-url: var(--paper-fiber-url)')
  })
})
