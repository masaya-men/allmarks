import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { TagRecord } from '@/lib/storage/indexeddb'
import {
  BoardBackgroundTypography,
  deriveBoardBgTypoText,
  isBoardBgTypoVariant,
} from './BoardBackgroundTypography'
import {
  BOARD_FILTER_ALL, BOARD_FILTER_INBOX, BOARD_FILTER_ARCHIVE, BOARD_FILTER_DEAD,
  makeTagsFilter,
} from '@/lib/board/board-filter-helpers'

describe('deriveBoardBgTypoText', () => {
  it('returns "AllMarks" for the "all" filter', () => {
    expect(deriveBoardBgTypoText(BOARD_FILTER_ALL, [])).toBe('AllMarks')
  })

  it('returns "Inbox" / "Archive" / "Dead Links" for their fixed filters', () => {
    expect(deriveBoardBgTypoText(BOARD_FILTER_INBOX, [])).toBe('Inbox')
    expect(deriveBoardBgTypoText(BOARD_FILTER_ARCHIVE, [])).toBe('Archive')
    expect(deriveBoardBgTypoText(BOARD_FILTER_DEAD, [])).toBe('Dead Links')
  })

  it('resolves a single-tag filter to the tag name', () => {
    const tags: TagRecord[] = [
      { id: 'm1', name: 'Calm', color: '#abc', order: 0, createdAt: 0 } as TagRecord,
    ]
    expect(deriveBoardBgTypoText(makeTagsFilter(['m1'], 'and'), tags)).toBe('Calm')
  })

  it("returns 'name +N-1' for a multi-tag filter", () => {
    const tags: TagRecord[] = [
      { id: 'm1', name: 'Music', color: '#0f0', order: 0, createdAt: 0 } as TagRecord,
      { id: 'm2', name: 'Art', color: '#f0f', order: 0, createdAt: 0 } as TagRecord,
    ]
    expect(deriveBoardBgTypoText(makeTagsFilter(['m1', 'm2'], 'and'), tags)).toBe('Music +1')
  })

  it('returns empty string when the first tag id no longer exists', () => {
    expect(deriveBoardBgTypoText(makeTagsFilter(['gone'], 'and'), [])).toBe('')
  })

  it('returns AllMarks when tags filter has empty tagIds', () => {
    expect(deriveBoardBgTypoText(makeTagsFilter([], 'and'), [])).toBe('AllMarks')
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
      <BoardBackgroundTypography activeFilter={BOARD_FILTER_ALL} tags={[]} />,
    )
    const host = container.querySelector('[data-testid="board-bg-typography"]')
    expect(host).not.toBeNull()
    const spans = host!.querySelectorAll('span')
    expect(spans.length).toBe(1)
    expect(spans[0]!.textContent).toBe('AllMarks')
  })

  it('does NOT render anything when text resolves to empty', () => {
    const { container } = render(
      <BoardBackgroundTypography activeFilter={makeTagsFilter(['nonexistent'], 'and')} tags={[]} />,
    )
    expect(container.querySelector('[data-testid="board-bg-typography"]')).toBeNull()
  })
})
