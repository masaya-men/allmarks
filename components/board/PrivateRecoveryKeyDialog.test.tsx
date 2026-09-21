import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { PrivateRecoveryKeyDialog } from './PrivateRecoveryKeyDialog'

const RECOVERY_KEY = 'ABCDE-FGHJK-MN234-56789-ABCDE-FGHJK'

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

  it('DONE fires onDone', () => {
    const onDone = vi.fn()
    render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={onDone} />)
    fireEvent.click(screen.getByTestId('private-recovery-key-done'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('backdrop click fires onDone', () => {
    const onDone = vi.fn()
    render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={onDone} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('Escape key fires onDone', () => {
    const onDone = vi.fn()
    render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={onDone} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
