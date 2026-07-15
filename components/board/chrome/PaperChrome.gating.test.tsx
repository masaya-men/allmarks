import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ThemeId } from '@/lib/board/types'
import { getThemeMeta } from '@/lib/board/theme-registry'
import { PaperFramePlate } from './PaperFramePlate'
import { PaperWaxSeal } from './PaperWaxSeal'

/** The exact gate BoardRoot uses: chrome shows only when the theme opts into
 *  decorations. Mirrors meta.decorations === true (paper-atelier only). */
function showsPaperChrome(themeId: ThemeId): boolean {
  return getThemeMeta(themeId).decorations === true
}

describe('paper chrome gating', () => {
  it('only paper-atelier opts into the decorative chrome', () => {
    expect(showsPaperChrome('paper-atelier')).toBe(true)
    expect(showsPaperChrome('dotted-notebook')).toBe(false)
    expect(showsPaperChrome('flat')).toBe(false)
  })

  it('renders nothing for non-paper themes when the gate is false (simulated)', () => {
    const themeId: ThemeId = 'dotted-notebook'
    render(
      <>{showsPaperChrome(themeId) ? <><PaperFramePlate hidden={false} /><PaperWaxSeal hidden={false} /></> : null}</>,
    )
    expect(screen.queryByTestId('paper-frame-plate')).toBeNull()
    expect(screen.queryByTestId('paper-wax-seal')).toBeNull()
  })

  it('renders both chrome pieces for paper-atelier', () => {
    const themeId: ThemeId = 'paper-atelier'
    render(
      <>{showsPaperChrome(themeId) ? <><PaperFramePlate hidden={false} /><PaperWaxSeal hidden={false} /></> : null}</>,
    )
    expect(screen.getByTestId('paper-frame-plate')).toBeTruthy()
    expect(screen.getByTestId('paper-wax-seal')).toBeTruthy()
  })
})
