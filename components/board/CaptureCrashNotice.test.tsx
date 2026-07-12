import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CaptureCrashNotice } from './CaptureCrashNotice'
import type { CaptureBreadcrumb } from '@/lib/share/capture-breadcrumb'

const CRUMB: CaptureBreadcrumb = {
  ts: 1_700_000_000_000,
  cardCount: 100,
  frameW: 390,
  frameH: 844,
  scale: 3.08,
  canvasW: 1201,
  canvasH: 2600,
  sourceMP: 342.5,
}

describe('CaptureCrashNotice', () => {
  it('shows the crash-durable diagnostic line the user reports', () => {
    render(<CaptureCrashNotice breadcrumb={CRUMB} onDismiss={() => {}} />)
    expect(screen.getByTestId('capture-crash-notice')).toBeInTheDocument()
    expect(screen.getByTestId('capture-crash-diag').textContent).toBe(
      '100 cards · canvas 1201×2600 (x3.08) · images 343MP',
    )
  })

  it('dismisses on OK', () => {
    const onDismiss = vi.fn()
    render(<CaptureCrashNotice breadcrumb={CRUMB} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByTestId('capture-crash-dismiss'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
