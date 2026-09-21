import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivateManageDialog } from './PrivateManageDialog'

describe('PrivateManageDialog', () => {
  it('shows the unlocked status and, when provided, the hint', () => {
    render(
      <PrivateManageDialog
        hint="my hint"
        onChangePassword={() => {}}
        onDone={() => {}}
        hasRecoveryKey={false}
        onSetUpRecoveryKey={() => {}}
      />,
    )
    expect(screen.getByText(/unlocked/i)).toBeInTheDocument()
    expect(screen.getByText(/my hint/)).toBeInTheDocument()
  })

  it('does not render a hint line when no hint is set', () => {
    render(
      <PrivateManageDialog
        onChangePassword={() => {}}
        onDone={() => {}}
        hasRecoveryKey={false}
        onSetUpRecoveryKey={() => {}}
      />,
    )
    expect(screen.queryByText(/hint/i)).not.toBeInTheDocument()
  })

  it('calls onChangePassword when the button is clicked', () => {
    const onChangePassword = vi.fn()
    render(
      <PrivateManageDialog
        onChangePassword={onChangePassword}
        onDone={() => {}}
        hasRecoveryKey={false}
        onSetUpRecoveryKey={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
    expect(onChangePassword).toHaveBeenCalledOnce()
  })

  it('calls onDone when DONE is clicked or Escape is pressed', () => {
    const onDone = vi.fn()
    render(
      <PrivateManageDialog
        onChangePassword={() => {}}
        onDone={onDone}
        hasRecoveryKey={false}
        onSetUpRecoveryKey={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(onDone).toHaveBeenCalledOnce()
  })
})

describe('PrivateManageDialog recovery-key button', () => {
  it('shows "set up" wording when hasRecoveryKey is false, and clicking fires onSetUpRecoveryKey', () => {
    const onSetUpRecoveryKey = vi.fn()
    render(
      <PrivateManageDialog
        onChangePassword={vi.fn()}
        onDone={vi.fn()}
        hasRecoveryKey={false}
        onSetUpRecoveryKey={onSetUpRecoveryKey}
      />,
    )
    expect(screen.getByTestId('private-manage-recovery-key')).toHaveTextContent(/set up/i)
    fireEvent.click(screen.getByTestId('private-manage-recovery-key'))
    expect(onSetUpRecoveryKey).toHaveBeenCalledTimes(1)
  })

  it('shows "regenerate" wording when hasRecoveryKey is true', () => {
    render(
      <PrivateManageDialog
        onChangePassword={vi.fn()}
        onDone={vi.fn()}
        hasRecoveryKey={true}
        onSetUpRecoveryKey={vi.fn()}
      />,
    )
    expect(screen.getByTestId('private-manage-recovery-key')).toHaveTextContent(/regenerate/i)
  })
})
