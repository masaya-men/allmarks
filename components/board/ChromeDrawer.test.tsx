import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'
import { ChromeDrawer } from './ChromeDrawer'

function firePointerDown(el: Element): void {
  el.dispatchEvent(new Event('pointerdown', { bubbles: true }))
}

function renderDrawer(isOpen: boolean, onClose = vi.fn()): { onClose: ReturnType<typeof vi.fn> } {
  render(
    <ChromeDrawer isOpen={isOpen} onClose={onClose} title="TEST PANEL" testId="test-drawer">
      <div data-testid="drawer-child">hello</div>
    </ChromeDrawer>,
  )
  return { onClose }
}

describe('ChromeDrawer', () => {
  it('renders nothing when closed', () => {
    renderDrawer(false)
    expect(screen.queryByTestId('test-drawer')).toBeNull()
  })

  it('renders title and children when open', () => {
    renderDrawer(true)
    expect(screen.getByTestId('test-drawer')).toBeTruthy()
    expect(screen.getByText('TEST PANEL')).toBeTruthy()
    expect(screen.getByTestId('drawer-child')).toBeTruthy()
  })

  it('closes on Escape', () => {
    const { onClose } = renderDrawer(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on pointerdown outside the panel', () => {
    const { onClose } = renderDrawer(true)
    firePointerDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT close on pointerdown inside the panel', () => {
    const { onClose } = renderDrawer(true)
    firePointerDown(screen.getByTestId('drawer-child'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes when the close button is clicked', () => {
    const { onClose } = renderDrawer(true)
    fireEvent.click(screen.getByTestId('test-drawer-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
