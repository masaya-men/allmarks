import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { PlaybackControlBar } from '@/components/board/PlaybackControlBar'

describe('PlaybackControlBar', () => {
  it('reflects paused state on the play/pause button', () => {
    const { container, rerender } = render(
      <PlaybackControlBar volume={50} paused={false} onVolumeChange={() => {}} onTogglePause={() => {}} />,
    )
    const btn = container.querySelector('[data-testid="pc-playpause"]') as HTMLElement
    expect(btn.getAttribute('aria-label')).toBe('Pause')
    rerender(<PlaybackControlBar volume={50} paused={true} onVolumeChange={() => {}} onTogglePause={() => {}} />)
    expect(btn.getAttribute('aria-label')).toBe('Play')
  })

  it('fires onTogglePause when the button is clicked', () => {
    const onTogglePause = vi.fn()
    const { container } = render(
      <PlaybackControlBar volume={50} paused={false} onVolumeChange={() => {}} onTogglePause={onTogglePause} />,
    )
    fireEvent.click(container.querySelector('[data-testid="pc-playpause"]') as HTMLElement)
    expect(onTogglePause).toHaveBeenCalledTimes(1)
  })

  it('fires onVolumeChange with the new value when the slider moves', () => {
    const onVolumeChange = vi.fn()
    const { container } = render(
      <PlaybackControlBar volume={50} paused={false} onVolumeChange={onVolumeChange} onTogglePause={() => {}} />,
    )
    const slider = container.querySelector('[data-testid="pc-volume"]') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '20' } })
    expect(onVolumeChange).toHaveBeenCalledWith(20)
  })

  it('stops pointerdown propagation so the card drag never engages', () => {
    const { container } = render(
      <PlaybackControlBar volume={50} paused={false} onVolumeChange={() => {}} onTogglePause={() => {}} />,
    )
    const root = container.querySelector('[data-testid="pc-bar"]') as HTMLElement
    const ev = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
    const stop = vi.spyOn(ev, 'stopPropagation')
    root.dispatchEvent(ev)
    expect(stop).toHaveBeenCalled()
  })
})
