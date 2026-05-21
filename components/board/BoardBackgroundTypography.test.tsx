import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import type { MoodRecord } from '@/lib/storage/indexeddb'
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

  it('resolves a mood filter to the mood name', () => {
    const moods: MoodRecord[] = [
      { id: 'm1', name: 'Calm', color: '#abc', createdAt: 0 } as MoodRecord,
    ]
    expect(deriveBoardBgTypoText('mood:m1', moods)).toBe('Calm')
  })

  it('returns empty string when a mood id no longer exists', () => {
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

describe('BoardBackgroundTypography — slice glitch + click burst', () => {
  it('renders the base text + 9 slice spans (10 spans total) when text is non-empty', () => {
    const { container } = render(
      <BoardBackgroundTypography activeFilter="all" moods={[]} />,
    )
    const host = container.querySelector('[data-testid="board-bg-typography"]')
    expect(host).not.toBeNull()
    const spans = host!.querySelectorAll('span')
    // 1 base text + 9 slice clones
    expect(spans.length).toBe(10)
    for (const span of spans) {
      expect(span.textContent).toBe('AllMarks')
    }
  })

  it('does NOT render anything when text resolves to empty', () => {
    const { container } = render(
      <BoardBackgroundTypography activeFilter="mood:nonexistent" moods={[]} />,
    )
    expect(container.querySelector('[data-testid="board-bg-typography"]')).toBeNull()
  })

  it('updates --bg-typo-glitch-mx / --my synchronously on pointermove (no rAF)', () => {
    const { container } = render(
      <BoardBackgroundTypography activeFilter="all" moods={[]} />,
    )
    const host = container.querySelector('[data-testid="board-bg-typography"]') as HTMLElement
    fireEvent.pointerMove(document, { clientX: 100, clientY: 200 })
    expect(host.style.getPropertyValue('--bg-typo-glitch-mx')).not.toBe('')
    expect(host.style.getPropertyValue('--bg-typo-glitch-my')).not.toBe('')
  })

  it('toggles data-burst=true on click and clears it after 800ms', () => {
    vi.useFakeTimers()
    // The triggerBurst path uses requestAnimationFrame to re-arm the
    // animation cleanly; make rAF synchronous so the burst class lands
    // immediately under fake timers.
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
    try {
      const { container } = render(
        <BoardBackgroundTypography activeFilter="all" moods={[]} />,
      )
      const host = container.querySelector(
        '[data-testid="board-bg-typography"]',
      ) as HTMLElement
      const textSpan = container.querySelector(
        '[data-testid="board-bg-typography-text"]',
      ) as HTMLElement

      expect(host.getAttribute('data-burst')).toBe('false')

      fireEvent.click(textSpan)
      expect(host.getAttribute('data-burst')).toBe('true')

      act(() => {
        vi.advanceTimersByTime(799)
      })
      expect(host.getAttribute('data-burst')).toBe('true')

      act(() => {
        vi.advanceTimersByTime(2)
      })
      expect(host.getAttribute('data-burst')).toBe('false')
    } finally {
      rafSpy.mockRestore()
      vi.useRealTimers()
    }
  })
})
