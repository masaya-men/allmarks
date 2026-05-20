import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TunePresetColumn } from './TunePresetColumn'
import { PRESETS } from '@/lib/board/tune-presets'

describe('TunePresetColumn', () => {
  it('renders all 5 preset rows with their labels', () => {
    render(<TunePresetColumn widthPx={267.84} gapPx={97.21} onApply={() => {}} />)
    for (const preset of PRESETS) {
      expect(screen.getByText(preset.label)).toBeTruthy()
    }
  })

  it('renders the ALLMARKS MK-1 plate', () => {
    render(<TunePresetColumn widthPx={267.84} gapPx={97.21} onApply={() => {}} />)
    expect(screen.getByText(/ALLMARKS/i)).toBeTruthy()
    expect(screen.getByText(/MK-1/i)).toBeTruthy()
  })

  it('marks the row whose values match (widthPx, gapPx) as active', () => {
    render(<TunePresetColumn widthPx={267.84} gapPx={97.21} onApply={() => {}} />)
    const defaultBtn = screen.getByRole('radio', { name: /DEFAULT/i })
    expect(defaultBtn.getAttribute('aria-checked')).toBe('true')
  })

  it('marks no row active when values match no preset', () => {
    render(<TunePresetColumn widthPx={300} gapPx={50} onApply={() => {}} />)
    for (const preset of PRESETS) {
      const row = screen.getByRole('radio', { name: new RegExp(preset.label, 'i') })
      expect(row.getAttribute('aria-checked')).toBe('false')
    }
  })

  it('calls onApply with the preset id when an inactive row is clicked', () => {
    const onApply = vi.fn()
    render(<TunePresetColumn widthPx={267.84} gapPx={97.21} onApply={onApply} />)
    fireEvent.click(screen.getByRole('radio', { name: /DENSE/i }))
    expect(onApply).toHaveBeenCalledWith('dense')
  })

  it('does NOT call onApply when the active row is clicked again', () => {
    const onApply = vi.fn()
    render(<TunePresetColumn widthPx={267.84} gapPx={97.21} onApply={onApply} />)
    fireEvent.click(screen.getByRole('radio', { name: /DEFAULT/i }))
    expect(onApply).not.toHaveBeenCalled()
  })

  it('uses role="radiogroup" + role="radio" for accessibility', () => {
    render(<TunePresetColumn widthPx={267.84} gapPx={97.21} onApply={() => {}} />)
    expect(screen.getByRole('radiogroup')).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })
})
