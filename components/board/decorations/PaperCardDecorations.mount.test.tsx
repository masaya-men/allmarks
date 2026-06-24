import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { getThemeMeta } from '@/lib/board/theme-registry'
import { PaperCardDecorations } from './PaperCardDecorations'

// A tiny harness mirroring the CardsLayer gate: mount decorations iff
// meta.decorations === true. This documents the exact predicate CardsLayer uses.
function Harness({ themeId, cardId }: { readonly themeId: 'dotted-notebook' | 'paper-atelier'; readonly cardId: string }): ReactElement {
  const meta = getThemeMeta(themeId)
  return (
    <div data-testid="wrapper">
      <div>card body</div>
      {meta.decorations === true && <PaperCardDecorations cardId={cardId} />}
    </div>
  )
}

describe('CardsLayer decoration gate', () => {
  it('mounts NO decoration DOM on the default (decorations falsy) theme', () => {
    const { container } = render(<Harness themeId="dotted-notebook" cardId="c1" />)
    expect(container.querySelectorAll('[data-deco]').length).toBe(0)
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('mounts the decoration overlay on the paper-atelier theme', () => {
    const { container } = render(<Harness themeId="paper-atelier" cardId="c1" />)
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })
})
