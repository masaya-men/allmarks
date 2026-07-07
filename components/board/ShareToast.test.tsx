import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ShareToast } from './ShareToast'

const noop = (): void => {}
const baseProps = {
  count: 0,
  hint: '',
  onReselect: noop,
  onDone: noop,
}

describe('ShareToast', () => {
  it('shows the SHARING counter', () => {
    render(<ShareToast {...baseProps} count={3} />)
    expect(screen.getByText('SHARING… 3')).toBeTruthy()
  })

  it('fires callbacks on RESELECT and DONE', () => {
    const onReselect = vi.fn()
    const onDone = vi.fn()
    render(<ShareToast {...baseProps} count={3} onReselect={onReselect} onDone={onDone} />)
    fireEvent.click(screen.getByTestId('share-toast-reselect'))
    fireEvent.click(screen.getByTestId('share-toast-done'))
    expect(onReselect).toHaveBeenCalledOnce()
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('renders the injected OS hint instead of a hardcoded string', () => {
    render(<ShareToast count={3} hint="Press Win+Shift+S, then drag the collage area." onReselect={() => {}} onDone={() => {}} />)
    expect(screen.getByText('Press Win+Shift+S, then drag the collage area.')).toBeInTheDocument()
  })

  it('shows COPY LINK, then LINK COPIED on success', async () => {
    const onCopyLink = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)
    render(<ShareToast count={2} hint="" onCopyLink={onCopyLink} onReselect={() => {}} onDone={() => {}} />)
    const btn = screen.getByTestId('share-toast-copy-link')
    expect(btn).toHaveTextContent('COPY LINK')
    fireEvent.click(btn)
    await waitFor(() => expect(onCopyLink).toHaveBeenCalled())
    await screen.findByText('LINK COPIED', { exact: false })
  })

  it('shows an error label when copy fails', async () => {
    const onCopyLink = vi.fn<() => Promise<boolean>>().mockResolvedValue(false)
    render(<ShareToast count={2} hint="" onCopyLink={onCopyLink} onReselect={() => {}} onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('share-toast-copy-link'))
    await screen.findByText("COULDN'T COPY", { exact: false })
  })
})
