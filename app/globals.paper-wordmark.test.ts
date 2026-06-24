import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const css = readFileSync(resolve(__dirname, 'globals.css'), 'utf8')
const paperBlock = (() => {
  const start = css.indexOf('html[data-theme-id="paper-atelier"]')
  const open = css.indexOf('{', start)
  // naive brace match is enough — the block has no nested braces in this file
  const close = css.indexOf('}', open)
  return css.slice(open, close)
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
