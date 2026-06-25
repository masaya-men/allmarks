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

  it('.paperAtelier is transparent — the real parchment backdrop lives on .canvasWrap (session 133)', () => {
    // The aged-parchment image moved to a FIXED cover backdrop on .canvasWrap
    // (BoardRoot.module.css); this content-sized layer is now transparent so it
    // does not cover that backdrop. .paperAtelier is paper-only, so the DEFAULT
    // theme is unaffected either way.
    const rule = themes.match(/\.paperAtelier\s*\{[\s\S]*?\n\}/)
    expect(rule, '.paperAtelier rule must exist').toBeTruthy()
    expect(rule![0]).toContain('background-color: transparent')
  })

  it('.paperAtelier keeps faint scrolling stain washes drifting over the fixed parchment', () => {
    const rule = themes.match(/\.paperAtelier\s*\{[\s\S]*?\n\}/)!
    expect(rule[0]).toMatch(/radial-gradient/)
  })
})
