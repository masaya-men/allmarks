import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const globals = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8')
const themes = readFileSync(resolve(__dirname, '../components/board/themes.module.css'), 'utf8')

describe('paper-atelier background wiring', () => {
  it('defines --paper-fiber-url ONLY inside the paper-atelier block, pointing at the committed tile', () => {
    const block = globals.match(/html\[data-theme-id="paper-atelier"\]\s*\{[\s\S]*?\n\}/)
    expect(block, 'paper-atelier block must exist').toBeTruthy()
    expect(block![0]).toContain('--paper-fiber-url:')
    expect(block![0]).toContain('/themes/paper-atelier/fiber.svg')
    // not leaked into the default cascade
    const occurrences = globals.match(/--paper-fiber-url:/g) ?? []
    expect(occurrences.length).toBe(1)
  })

  it('.paperAtelier consumes the fiber url via var() so the DEFAULT theme stays unaffected', () => {
    const rule = themes.match(/\.paperAtelier\s*\{[\s\S]*?\n\}/)
    expect(rule, '.paperAtelier rule must exist').toBeTruthy()
    expect(rule![0]).toContain('var(--paper-fiber-url')
    expect(rule![0]).toContain('background-repeat: repeat')
  })

  it('.paperAtelier adds an inset edge vignette (charcoal at the rim only)', () => {
    const rule = themes.match(/\.paperAtelier\s*\{[\s\S]*?\n\}/)!
    expect(rule[0]).toContain('rgba(43, 39, 34, 0.10)')
    expect(rule[0]).toMatch(/radial-gradient\(\s*ellipse/)
  })
})
