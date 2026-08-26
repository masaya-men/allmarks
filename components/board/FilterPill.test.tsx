import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { BOARD_FILTER_ALL, BOARD_FILTER_INBOX } from '@/lib/board/board-filter-helpers'
import { FilterPill } from './FilterPill'

afterEach(() => cleanup())

const baseProps = {
  tags: [],
  counts: { all: 5, inbox: 2, archive: 0, dead: 0 },
  privateTagId: null,
}

describe('FilterPill — NO TAGS row (N-69)', () => {
  it('renders a NO TAGS row showing the inbox count, and selects it on click', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <FilterPill
        {...baseProps}
        value={BOARD_FILTER_ALL}
        onChange={onChange}
        privateStatus="none"
        privateActive={false}
        onPrivateClick={(): void => {}}
      />,
    )
    const row = getByTestId('filter-pill-no-tags')
    expect(row.textContent).toContain('NO TAGS')
    expect(row.textContent).toContain('002')
    fireEvent.click(row)
    expect(onChange).toHaveBeenCalledWith(BOARD_FILTER_INBOX)
  })

  it('marks the NO TAGS row active when it is the current filter', () => {
    const { getByTestId } = render(
      <FilterPill
        {...baseProps}
        value={BOARD_FILTER_INBOX}
        onChange={(): void => {}}
        privateStatus="none"
        privateActive={false}
        onPrivateClick={(): void => {}}
      />,
    )
    // active state is a CSS module class swap — assert via className containing "active"
    expect(getByTestId('filter-pill-no-tags').className).toMatch(/active/)
  })
})

describe('FilterPill — Private row visual parity with regular tag rows (session 206)', () => {
  it('shows the locked icon when not unlocked, and the unlocked icon once unlocked', () => {
    const { getByTestId, rerender } = render(
      <FilterPill
        {...baseProps}
        value={BOARD_FILTER_ALL}
        onChange={(): void => {}}
        privateStatus="locked"
        privateActive={false}
        onPrivateClick={(): void => {}}
      />,
    )
    expect(getByTestId('filter-pill-private').textContent).toContain('🔒')

    rerender(
      <FilterPill
        {...baseProps}
        value={BOARD_FILTER_ALL}
        onChange={(): void => {}}
        privateStatus="unlocked"
        privateActive={false}
        onPrivateClick={(): void => {}}
      />,
    )
    expect(getByTestId('filter-pill-private').textContent).toContain('🔓')
  })

  it('fills the leading dot only when the Private filter is active, matching regular tag rows', () => {
    const { getByTestId, rerender } = render(
      <FilterPill
        {...baseProps}
        value={BOARD_FILTER_ALL}
        onChange={(): void => {}}
        privateStatus="unlocked"
        privateActive={false}
        onPrivateClick={(): void => {}}
      />,
    )
    const dot = (): HTMLElement | null => getByTestId('filter-pill-private').querySelector('[data-active]')
    expect(dot()?.getAttribute('data-active')).toBe('false')

    rerender(
      <FilterPill
        {...baseProps}
        value={BOARD_FILTER_ALL}
        onChange={(): void => {}}
        privateStatus="unlocked"
        privateActive
        onPrivateClick={(): void => {}}
      />,
    )
    expect(dot()?.getAttribute('data-active')).toBe('true')
  })
})
