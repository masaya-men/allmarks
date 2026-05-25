import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { type ReactElement } from 'react'
import { useSlideshowCycle } from '@/lib/board/use-slideshow-cycle'

function Probe({ count }: { count: number }): ReactElement {
  return <span data-testid="i">{useSlideshowCycle(count)}</span>
}

describe('useSlideshowCycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Deterministic timing: random()=0 → zero initial offset, minimum step.
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('stays at 0 and never advances when there are fewer than 2 frames', () => {
    const { getByTestId } = render(<Probe count={1} />)
    expect(getByTestId('i').textContent).toBe('0')
    act(() => { vi.advanceTimersByTime(20000) })
    expect(getByTestId('i').textContent).toBe('0')
  })

  it('cycles 0→1→2→0 through the frames on its timer', () => {
    // random()=0 → initial index 0, initial offset 0ms, each step MIN_STEP_MS (2600).
    const { getByTestId } = render(<Probe count={3} />)
    expect(getByTestId('i').textContent).toBe('0')
    act(() => { vi.advanceTimersByTime(0) }) // fire initial offset (0ms)
    expect(getByTestId('i').textContent).toBe('1')
    act(() => { vi.advanceTimersByTime(2600) })
    expect(getByTestId('i').textContent).toBe('2')
    act(() => { vi.advanceTimersByTime(2600) })
    expect(getByTestId('i').textContent).toBe('0')
  })

  it('picks a random starting frame so cards mounted together do not all start at 0', () => {
    // random()=0.7 → Math.floor(0.7 * 5) = 3 as the initial index.
    vi.spyOn(Math, 'random').mockReturnValue(0.7)
    const { getByTestId } = render(<Probe count={5} />)
    expect(getByTestId('i').textContent).toBe('3')
  })
})
