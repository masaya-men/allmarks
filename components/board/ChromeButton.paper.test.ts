import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const css = readFileSync(resolve(__dirname, 'ChromeButton.module.css'), 'utf8')

describe('paper chrome button styling', () => {
  it('paper scope overrides the button font to the serif token', () => {
    expect(css).toMatch(/data-theme-id='paper-atelier'[^]*\.btn[^]*var\(--font-serif-display/)
  })
  it('paper scope disables the RGB glitch animation', () => {
    expect(css).toMatch(/data-theme-id='paper-atelier'[^]*animation:\s*none/)
  })
})
