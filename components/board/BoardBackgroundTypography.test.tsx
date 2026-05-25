import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { TagRecord } from '@/lib/storage/indexeddb'
import {
  BoardBackgroundTypography,
  deriveBoardBgTypoText,
  isBoardBgTypoVariant,
} from './BoardBackgroundTypography'

describe('deriveBoardBgTypoText', () => {
  it('returns "AllMarks" for the "all" filter', () => {
    expect(deriveBoardBgTypoText('all', [])).toBe('AllMarks')
  })

  it('returns "Inbox" / "Archive" / "Dead Links" for their fixed filters', () => {
    expect(deriveBoardBgTypoText('inbox', [])).toBe('Inbox')
    expect(deriveBoardBgTypoText('archive', [])).toBe('Archive')
    expect(deriveBoardBgTypoText('dead', [])).toBe('Dead Links')
  })

  it('resolves a tag filter to the tag name', () => {
    const tags: TagRecord[] = [
      { id: 'm1', name: 'Calm', color: '#abc', order: 0, createdAt: 0 } as TagRecord,
    ]
    expect(deriveBoardBgTypoText('mood:m1', tags)).toBe('Calm')
  })

  it('returns empty string when a tag id no longer exists', () => {
    expect(deriveBoardBgTypoText('mood:gone', [])).toBe('')
  })
})

describe('isBoardBgTypoVariant', () => {
  it('accepts the 6 known variant names', () => {
    for (const v of ['static', 'dvd-bounce', 'glitch', 'multi', 'marquee', 'card-wind']) {
      expect(isBoardBgTypoVariant(v)).toBe(true)
    }
  })

  it('rejects anything else', () => {
    expect(isBoardBgTypoVariant('hover')).toBe(false)
    expect(isBoardBgTypoVariant('')).toBe(false)
  })
})

describe('BoardBackgroundTypography — static wordmark', () => {
  it('renders a single text span when text is non-empty', () => {
    const { container } = render(
      <BoardBackgroundTypography activeFilter="all" tags={[]} />,
    )
    const host = container.querySelector('[data-testid="board-bg-typography"]')
    expect(host).not.toBeNull()
    const spans = host!.querySelectorAll('span')
    expect(spans.length).toBe(1)
    expect(spans[0]!.textContent).toBe('AllMarks')
  })

  it('does NOT render anything when text resolves to empty', () => {
    const { container } = render(
      <BoardBackgroundTypography activeFilter="mood:nonexistent" tags={[]} />,
    )
    expect(container.querySelector('[data-testid="board-bg-typography"]')).toBeNull()
  })
})
