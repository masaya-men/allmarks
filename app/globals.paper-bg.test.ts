import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(__dirname, 'globals.css'), 'utf8')
const themes = readFileSync(
  resolve(__dirname, '../components/board/themes.module.css'),
  'utf8',
)

describe('paper background asset wiring', () => {
  it('paper block declares --asset-parchment-bg only inside the paper scope', () => {
    const paperBlock = css.slice(css.indexOf('data-theme-id="paper-atelier"'))
    expect(paperBlock).toContain('--asset-parchment-bg')
  })

  it('.paperAtelier composites the parchment asset with a fiber fallback', () => {
    // The asset layer must use a var fallback so default theme = none and a
    // missing token keeps the existing fiber tile.
    expect(themes).toMatch(/var\(--asset-parchment-bg,\s*var\(--paper-fiber-url, none\)\)/)
  })
})
