import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { ThemeModal, type ThemeModalProps } from './ThemeModal'
import type { ThemeId } from '@/lib/board/types'

vi.mock('@/lib/i18n/I18nProvider', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

// The picker's internals (registry, swatches, lock states) are covered by
// ThemePicker.test. Stub it here so this test isolates ThemeModal's own
// outside-click dismiss behaviour.
vi.mock('./ThemePicker', () => ({
  ThemePicker: (): ReactElement => <div data-testid="mock-picker" />,
}))

/** Dispatch a bubbling pointerdown — jsdom-safe (no PointerEvent constructor
 *  dependency); the ThemeModal listener lives on `document`, so a bubbling
 *  event from any element reaches it with the dispatcher as `target`. */
function firePointerDown(el: Element): void {
  el.dispatchEvent(new Event('pointerdown', { bubbles: true }))
}

function renderModal(overrides?: Partial<ThemeModalProps>): { onClose: ReturnType<typeof vi.fn> } {
  const onClose = vi.fn()
  render(
    <ThemeModal
      isOpen
      onClose={onClose}
      themeId={'dotted-notebook' as ThemeId}
      onThemeChange={() => {}}
      customization={null}
      isDefaultCustomization
      onCustomize={() => {}}
      {...overrides}
    />,
  )
  return { onClose }
}

describe('ThemeModal outside-click dismiss', () => {
  it('closes when a pointerdown lands outside the panel (= on the live board behind)', () => {
    const { onClose } = renderModal()
    firePointerDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays open when the pointerdown is inside the panel (panel body / close button)', () => {
    const { onClose } = renderModal()
    firePointerDown(screen.getByTestId('theme-modal'))
    firePointerDown(screen.getByTestId('theme-modal-close'))
    // a deep descendant (the stubbed picker — now a single flat list)
    firePointerDown(screen.getByTestId('mock-picker'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not dismiss while closed (listener is only attached when open)', () => {
    const { onClose } = renderModal({ isOpen: false })
    firePointerDown(document.body)
    expect(onClose).not.toHaveBeenCalled()
  })
})
