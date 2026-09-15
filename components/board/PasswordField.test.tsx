import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PasswordField } from './PasswordField'

describe('PasswordField', () => {
  it('renders as type=password by default and toggles to type=text on eye click', () => {
    render(
      <PasswordField
        id="pw" label="Password" value="secret123" onChange={() => {}}
        showLabel="Show password" hideLabel="Hide password"
      />,
    )
    const input = screen.getByLabelText('Password') as HTMLInputElement
    expect(input.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input.type).toBe('password')
  })

  it('calls onChange with the typed value', () => {
    const onChange = vi.fn()
    render(
      <PasswordField
        id="pw" label="Password" value="" onChange={onChange}
        showLabel="Show password" hideLabel="Hide password"
      />,
    )
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abc' } })
    expect(onChange).toHaveBeenCalledWith('abc')
  })

  it('calls onEnter when Enter is pressed, only if provided', () => {
    const onEnter = vi.fn()
    render(
      <PasswordField
        id="pw" label="Password" value="x" onChange={() => {}} onEnter={onEnter}
        showLabel="Show password" hideLabel="Hide password"
      />,
    )
    fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'Enter' })
    expect(onEnter).toHaveBeenCalledOnce()
  })
})
