import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TunePresetColumn } from './TunePresetColumn'
import { PRESETS } from '@/lib/board/tune-presets'

type Overrides = Partial<Parameters<typeof TunePresetColumn>[0]>

function renderCol(props: Overrides = {}): void {
  render(
    <TunePresetColumn
      widthPx={267.84}
      gapPx={97.21}
      onApply={() => {}}
      roundedCorners={true}
      onToggleCorners={() => {}}
      {...props}
    />,
  )
}

describe('TunePresetColumn', () => {
  it('renders all 5 preset rows with their labels', () => {
    renderCol()
    for (const preset of PRESETS) {
      expect(screen.getByText(preset.label)).toBeTruthy()
    }
  })

  it('renders the ALLMARKS MK-1 plate', () => {
    renderCol()
    expect(screen.getByText(/ALLMARKS/i)).toBeTruthy()
    expect(screen.getByText(/MK-1/i)).toBeTruthy()
  })

  it('marks the row whose values match (widthPx, gapPx) as active', () => {
    renderCol()
    const defaultBtn = screen.getByRole('radio', { name: /DEFAULT/i })
    expect(defaultBtn.getAttribute('aria-checked')).toBe('true')
  })

  it('marks no row active when values match no preset', () => {
    renderCol({ widthPx: 300, gapPx: 50 })
    for (const preset of PRESETS) {
      const row = screen.getByRole('radio', { name: new RegExp(preset.label, 'i') })
      expect(row.getAttribute('aria-checked')).toBe('false')
    }
  })

  it('calls onApply with the preset id when an inactive row is clicked', () => {
    const onApply = vi.fn()
    renderCol({ onApply })
    fireEvent.click(screen.getByRole('radio', { name: /DENSE/i }))
    expect(onApply).toHaveBeenCalledWith('dense')
  })

  it('does NOT call onApply when the active row is clicked again', () => {
    const onApply = vi.fn()
    renderCol({ onApply })
    fireEvent.click(screen.getByRole('radio', { name: /DEFAULT/i }))
    expect(onApply).not.toHaveBeenCalled()
  })

  it('uses role="radiogroup" + role="radio" for accessibility', () => {
    renderCol()
    expect(screen.getByRole('radiogroup')).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })
})

describe('TunePresetColumn — CORNERS toggle', () => {
  it('renders a switch reading ROUND when rounded and calls onToggleCorners on click', () => {
    const onToggleCorners = vi.fn()
    renderCol({ roundedCorners: true, onToggleCorners })
    const sw = screen.getByRole('switch', { name: /corners/i })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('ROUND')).toBeTruthy()
    fireEvent.click(sw)
    expect(onToggleCorners).toHaveBeenCalledTimes(1)
  })

  it('reads SQUARE and aria-checked=false when corners are off', () => {
    renderCol({ roundedCorners: false })
    const sw = screen.getByRole('switch', { name: /corners/i })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('SQUARE')).toBeTruthy()
  })
})
