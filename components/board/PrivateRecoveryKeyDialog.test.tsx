import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { PrivateRecoveryKeyDialog } from './PrivateRecoveryKeyDialog'

const RECOVERY_KEY = 'ABCDE-FGHJK-MN234-56789-ABCDE-FGHJK'

/** Renders the dialog, clicks COPY, and flushes the clipboard promise so
 *  `hasCopiedOnce` becomes true. Must run under fake timers (mirrors the
 *  approach already used by the "shows the copied confirmation" test). */
async function renderAndCopy(onDone = vi.fn()): Promise<ReturnType<typeof vi.fn>> {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.assign(navigator, { clipboard: { writeText } })
  render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={onDone} />)
  await act(async () => {
    fireEvent.click(screen.getByTestId('private-recovery-key-copy'))
    await vi.advanceTimersByTimeAsync(0) // clipboard promise resolves
  })
  return onDone
}

describe('PrivateRecoveryKeyDialog', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('displays the recovery key', () => {
    render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={vi.fn()} />)
    expect(screen.getByTestId('private-recovery-key-value')).toHaveTextContent(RECOVERY_KEY)
  })

  it('copies the recovery key to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={vi.fn()} />)
    fireEvent.click(screen.getByTestId('private-recovery-key-copy'))
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(RECOVERY_KEY))
  })

  it('shows the copied confirmation after a successful copy, then reverts to the copy label', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={vi.fn()} />)
    const button = screen.getByTestId('private-recovery-key-copy')
    expect(button).toHaveTextContent('COPY')

    await act(async () => {
      fireEvent.click(button)
      await vi.advanceTimersByTimeAsync(0) // clipboard promise resolves
    })
    expect(button).toHaveTextContent('Copied')

    // A second copy has to be possible → the label goes back on its own.
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })
    expect(button).toHaveTextContent('COPY')
  })

  it('does NOT claim success when the clipboard write rejects', async () => {
    vi.useFakeTimers()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.assign(navigator, { clipboard: { writeText } })
    render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={vi.fn()} />)
    const button = screen.getByTestId('private-recovery-key-copy')

    await act(async () => {
      fireEvent.click(button)
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(writeText).toHaveBeenCalledWith(RECOVERY_KEY)
    expect(button).toHaveTextContent('COPY')
    expect(button).not.toHaveTextContent('Copied')
    consoleError.mockRestore()
  })

  describe('before the key has been copied (dismissal must be blocked)', () => {
    it('the "Got it" button is disabled', () => {
      render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={vi.fn()} />)
      expect(screen.getByTestId('private-recovery-key-done')).toBeDisabled()
    })

    it('clicking "Got it" does NOT fire onDone', () => {
      const onDone = vi.fn()
      render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={onDone} />)
      fireEvent.click(screen.getByTestId('private-recovery-key-done'))
      expect(onDone).not.toHaveBeenCalled()
    })

    it('clicking the backdrop does NOT fire onDone', () => {
      const onDone = vi.fn()
      render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={onDone} />)
      fireEvent.click(screen.getByRole('dialog'))
      expect(onDone).not.toHaveBeenCalled()
    })

    it('pressing Escape does NOT fire onDone', () => {
      const onDone = vi.fn()
      render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={onDone} />)
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onDone).not.toHaveBeenCalled()
    })

    it('a failed clipboard write still unlocks dismissal (no permanent dead end)', async () => {
      // navigator.clipboard is unavailable entirely in non-secure contexts
      // (e.g. testing the board over http://<lan-ip>:3000 on a phone) —
      // trapping the user behind a button that can never succeed would be
      // worse than the accidental-dismiss problem this gate exists to
      // prevent, since the key text is still manually selectable/copyable
      // (final review finding).
      vi.useFakeTimers()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onDone = vi.fn()
      const writeText = vi.fn().mockRejectedValue(new Error('denied'))
      Object.assign(navigator, { clipboard: { writeText } })
      render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={onDone} />)

      await act(async () => {
        fireEvent.click(screen.getByTestId('private-recovery-key-copy'))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByTestId('private-recovery-key-done')).toBeEnabled()
      fireEvent.click(screen.getByTestId('private-recovery-key-done'))
      expect(onDone).toHaveBeenCalledTimes(1)
      consoleError.mockRestore()
    })
  })

  describe('after the key has been copied once (dismissal unlocked)', () => {
    it('the "Got it" button becomes enabled', async () => {
      vi.useFakeTimers()
      await renderAndCopy()
      expect(screen.getByTestId('private-recovery-key-done')).toBeEnabled()
    })

    it('clicking "Got it" fires onDone', async () => {
      vi.useFakeTimers()
      const onDone = await renderAndCopy()
      fireEvent.click(screen.getByTestId('private-recovery-key-done'))
      expect(onDone).toHaveBeenCalledTimes(1)
    })

    it('clicking the backdrop fires onDone', async () => {
      vi.useFakeTimers()
      const onDone = await renderAndCopy()
      fireEvent.click(screen.getByRole('dialog'))
      expect(onDone).toHaveBeenCalledTimes(1)
    })

    it('pressing Escape fires onDone', async () => {
      vi.useFakeTimers()
      const onDone = await renderAndCopy()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onDone).toHaveBeenCalledTimes(1)
    })

    it('stays unlocked even after the "Copied" label reverts (hasCopiedOnce does not revert)', async () => {
      vi.useFakeTimers()
      const onDone = await renderAndCopy()
      // Let the 2s "Copied" → "COPY" label revert happen.
      await act(async () => { await vi.advanceTimersByTimeAsync(2100) })
      expect(screen.getByTestId('private-recovery-key-copy')).toHaveTextContent('COPY')

      expect(screen.getByTestId('private-recovery-key-done')).toBeEnabled()
      fireEvent.click(screen.getByTestId('private-recovery-key-done'))
      expect(onDone).toHaveBeenCalledTimes(1)
    })
  })
})
