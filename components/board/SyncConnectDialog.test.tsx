import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SyncConnectDialog, type ConnectDialogStep } from './SyncConnectDialog'

const baseProps = {
  keyInput: '',
  onKeyInputChange: vi.fn(),
  onSubmitKey: vi.fn(),
  keySubmitting: false,
  keyError: null as string | null,
  keyCapExceeded: false,
  onConnect: vi.fn(),
  onClose: vi.fn(),
}

function renderStep(step: ConnectDialogStep, overrides: Partial<typeof baseProps> = {}) {
  const props = { ...baseProps, ...overrides }
  const onClose = vi.fn()
  render(<SyncConnectDialog {...props} step={step} onClose={onClose} />)
  return { onClose }
}

describe('SyncConnectDialog', () => {
  it('carries data-no-capture and a dialog role', () => {
    render(<SyncConnectDialog {...baseProps} step={{ kind: 'key-entry' }} />)
    const dialog = screen.getByTestId('sync-connect-dialog')
    expect(dialog).toHaveAttribute('role', 'dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog.hasAttribute('data-no-capture')).toBe(true)
  })

  describe("step 'key-entry'", () => {
    it('renders the key input, submit button and cancel', () => {
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'key-entry' }} />)
      expect(screen.getByTestId('sync-key-input')).toBeInTheDocument()
      expect(screen.getByTestId('sync-key-submit')).toBeInTheDocument()
      expect(screen.getByTestId('sync-connect-dialog-cancel')).toBeInTheDocument()
      expect(screen.queryByTestId('sync-connect-button')).not.toBeInTheDocument()
    })

    it('submit is disabled while keySubmitting is true, even with input', () => {
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'key-entry' }} keyInput="abc" keySubmitting />)
      expect(screen.getByTestId('sync-key-submit')).toBeDisabled()
    })

    it('submit is disabled when the input is empty', () => {
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'key-entry' }} keyInput="" />)
      expect(screen.getByTestId('sync-key-submit')).toBeDisabled()
    })

    it('submit is enabled once there is input and nothing is submitting', () => {
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'key-entry' }} keyInput="abc" keySubmitting={false} />)
      expect(screen.getByTestId('sync-key-submit')).not.toBeDisabled()
    })

    it('clicking submit calls onSubmitKey', () => {
      const onSubmitKey = vi.fn()
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'key-entry' }} keyInput="abc" onSubmitKey={onSubmitKey} />)
      fireEvent.click(screen.getByTestId('sync-key-submit'))
      expect(onSubmitKey).toHaveBeenCalledTimes(1)
    })

    it('typing in the key input calls onKeyInputChange', () => {
      const onKeyInputChange = vi.fn()
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'key-entry' }} onKeyInputChange={onKeyInputChange} />)
      fireEvent.change(screen.getByTestId('sync-key-input'), { target: { value: 'xyz' } })
      expect(onKeyInputChange).toHaveBeenCalledWith('xyz')
    })

    it('shows no error block when keyError is null', () => {
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'key-entry' }} keyError={null} />)
      expect(screen.queryByTestId('sync-key-error')).not.toBeInTheDocument()
    })

    it('shows the error text when keyError is set, with no contact link if not cap-exceeded', () => {
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'key-entry' }} keyError="bad key" keyCapExceeded={false} />)
      expect(screen.getByTestId('sync-key-error')).toHaveTextContent('bad key')
      expect(screen.queryByTestId('sync-cap-exceeded-contact')).not.toBeInTheDocument()
    })

    it('shows the cap-exceeded contact link pointing at /contact when keyCapExceeded is true', () => {
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'key-entry' }} keyError="cap hit" keyCapExceeded />)
      const link = screen.getByTestId('sync-cap-exceeded-contact')
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/contact')
      expect(link).toHaveAttribute('target', '_blank')
    })
  })

  describe("step 'connect'", () => {
    it('renders the connect button and cancel, no key input', () => {
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'connect' }} />)
      expect(screen.getByTestId('sync-connect-button')).toBeInTheDocument()
      expect(screen.getByTestId('sync-connect-dialog-cancel')).toBeInTheDocument()
      expect(screen.queryByTestId('sync-key-input')).not.toBeInTheDocument()
    })

    it('clicking connect calls onConnect', () => {
      const onConnect = vi.fn()
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'connect' }} onConnect={onConnect} />)
      fireEvent.click(screen.getByTestId('sync-connect-button'))
      expect(onConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe("step 'connecting'", () => {
    it('renders a prominent waiting indicator and no actions row', () => {
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'connecting' }} />)
      expect(screen.getByTestId('sync-connecting')).toBeInTheDocument()
      expect(screen.queryByTestId('sync-connect-dialog-cancel')).not.toBeInTheDocument()
      expect(screen.queryByTestId('sync-connect-button')).not.toBeInTheDocument()
    })
  })

  describe("step 'connect-failed'", () => {
    it('renders the error and a retry button sharing the connect-button testid', () => {
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'connect-failed' }} />)
      expect(screen.getByTestId('sync-connect-error')).toBeInTheDocument()
      expect(screen.getByTestId('sync-connect-button')).toBeInTheDocument()
      expect(screen.getByTestId('sync-connect-dialog-cancel')).toBeInTheDocument()
    })

    it('clicking retry calls onConnect', () => {
      const onConnect = vi.fn()
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'connect-failed' }} onConnect={onConnect} />)
      fireEvent.click(screen.getByTestId('sync-connect-button'))
      expect(onConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe("step 'done'", () => {
    it('renders the done screen and a close button', () => {
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'done' }} />)
      expect(screen.getByTestId('sync-setup-done')).toBeInTheDocument()
      expect(screen.getByTestId('sync-setup-done-close')).toBeInTheDocument()
    })

    it('clicking close calls onClose', () => {
      const onClose = vi.fn()
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'done' }} onClose={onClose} />)
      fireEvent.click(screen.getByTestId('sync-setup-done-close'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('dismissibility', () => {
    const dismissibleSteps: ConnectDialogStep[] = [
      { kind: 'key-entry' },
      { kind: 'connect' },
      { kind: 'connect-failed' },
      { kind: 'done' },
    ]

    for (const step of dismissibleSteps) {
      it(`backdrop click calls onClose for step '${step.kind}'`, () => {
        const { onClose } = renderStep(step)
        fireEvent.click(screen.getByTestId('sync-connect-dialog'))
        expect(onClose).toHaveBeenCalledTimes(1)
      })

      it(`Escape key calls onClose for step '${step.kind}'`, () => {
        const { onClose } = renderStep(step)
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(1)
      })

      it(`the CANCEL button calls onClose for step '${step.kind}'`, () => {
        if (step.kind === 'done') return // 'done' has no CANCEL, only its own close button (covered above)
        const { onClose } = renderStep(step)
        fireEvent.click(screen.getByTestId('sync-connect-dialog-cancel'))
        expect(onClose).toHaveBeenCalledTimes(1)
      })
    }

    it("backdrop click does NOT call onClose for step 'connecting'", () => {
      const { onClose } = renderStep({ kind: 'connecting' })
      fireEvent.click(screen.getByTestId('sync-connect-dialog'))
      expect(onClose).not.toHaveBeenCalled()
    })

    it("Escape key does NOT call onClose for step 'connecting'", () => {
      const { onClose } = renderStep({ kind: 'connecting' })
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).not.toHaveBeenCalled()
    })

    it('clicking inside the panel does not close the dialog (stopPropagation)', () => {
      const { onClose } = renderStep({ kind: 'key-entry' })
      fireEvent.click(screen.getByTestId('sync-key-input'))
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('heading', () => {
    it("uses the setup heading for every step except 'done'", () => {
      const steps: ConnectDialogStep[] = [
        { kind: 'key-entry' },
        { kind: 'connect' },
        { kind: 'connecting' },
        { kind: 'connect-failed' },
      ]
      for (const step of steps) {
        const { unmount } = render(<SyncConnectDialog {...baseProps} step={step} />)
        expect(screen.getByTestId('sync-connect-dialog').textContent).toContain('Sync setup')
        unmount()
      }
    })

    it("uses the done heading for step 'done'", () => {
      render(<SyncConnectDialog {...baseProps} step={{ kind: 'done' }} />)
      expect(screen.getByTestId('sync-connect-dialog').textContent).toContain('Sync is on')
    })
  })
})
