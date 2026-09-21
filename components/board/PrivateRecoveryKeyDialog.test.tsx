import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivateRecoveryKeyDialog } from './PrivateRecoveryKeyDialog'

const RECOVERY_KEY = 'ABCDE-FGHJK-MN234-56789-ABCDE-FGHJK'

describe('PrivateRecoveryKeyDialog', () => {
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
