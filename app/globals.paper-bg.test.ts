import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(__dirname, 'globals.css'), 'utf8')
const boardRoot = readFileSync(
  resolve(__dirname, '../components/board/BoardRoot.module.css'),
  'utf8',
)

describe('paper background asset wiring', () => {
  it('paper block declares --asset-parchment-bg only inside the paper scope', () => {
    const paperBlock = css.slice(css.indexOf('data-theme-id="paper-atelier"'))
    expect(paperBlock).toContain('--asset-parchment-bg')
    // must NOT leak to :root / default scope
    const beforePaper = css.slice(0, css.indexOf('data-theme-id="paper-atelier"'))
    expect(beforePaper).not.toContain('--asset-parchment-bg')
  })

  it('paper-on-paper: parchment panel on .canvas (rounded+lifted) over .outerFrame parchment', () => {
    // session 133: the board .canvas is a rounded parchment PANEL (cover, fixed)
    // lifted off an outer parchment surface (.outerFrame). Both paper-scoped with
    // var fallbacks so default themes are a no-op.
    const block = boardRoot.slice(boardRoot.indexOf("data-theme-id='paper-atelier'"))
    expect(block).toContain('.canvas')
    expect(block).toMatch(/background-image:\s*var\(--asset-parchment-bg, none\)/)
    expect(block).toMatch(/background-image:\s*var\(--asset-parchment-outer, none\)/)
    expect(block).toContain('box-shadow')
  })
})
