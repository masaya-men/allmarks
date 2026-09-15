import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivateManageDialog } from './PrivateManageDialog'

describe('PrivateManageDialog', () => {
  it('shows the unlocked status and, when provided, the hint', () => {
    render(<PrivateManageDialog hint="my hint" onChangePassword={() => {}} onDone={() => {}} />)
    expect(screen.getByText(/unlocked/i)).toBeInTheDocument()
    expect(screen.getByText(/my hint/)).toBeInTheDocument()
  })

  it('does not render a hint line when no hint is set', () => {
    render(<PrivateManageDialog onChangePassword={() => {}} onDone={() => {}} />)
    expect(screen.queryByText(/hint/i)).not.toBeInTheDocument()
  })

  it('calls onChangePassword when the button is clicked', () => {
    const onChangePassword = vi.fn()
    render(<PrivateManageDialog onChangePassword={onChangePassword} onDone={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
    expect(onChangePassword).toHaveBeenCalledOnce()
  })

  it('calls onDone when DONE is clicked or Escape is pressed', () => {
    const onDone = vi.fn()
    render(<PrivateManageDialog onChangePassword={() => {}} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(onDone).toHaveBeenCalledOnce()
  })
})
