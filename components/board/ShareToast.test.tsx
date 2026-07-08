import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ShareToast } from './ShareToast'

const noop = (): void => {}
const baseProps = {
  count: 0,
  createState: 'idle' as const,
  onCreate: noop,
  onPostToX: noop,
  onReselect: noop,
  onDone: noop,
}

describe('ShareToast — state A (arranged, before create)', () => {
  it('shows the SHARING counter', () => {
    render(<ShareToast {...baseProps} count={3} />)
    expect(screen.getByText('SHARING · 3')).toBeTruthy()
  })

  it('CREATE fires onCreate (auto-capture, no manual screenshot)', () => {
    const onCreate = vi.fn()
    render(<ShareToast {...baseProps} count={3} onCreate={onCreate} />)
    const create = screen.getByTestId('share-toast-create')
    expect(create).toHaveTextContent('CREATE')
    fireEvent.click(create)
    expect(onCreate).toHaveBeenCalledOnce()
  })

  it('has no manual-screenshot affordances (HIDE TO SNIP / BROWSE removed)', () => {
    render(<ShareToast {...baseProps} count={3} />)
    expect(screen.queryByTestId('share-toast-hide')).toBeNull()
    expect(screen.queryByTestId('share-toast-paste')).toBeNull()
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

  it('CREATE is disabled and labeled CREATING… while creating', () => {
    render(<ShareToast {...baseProps} createState="creating" />)
    const create = screen.getByTestId('share-toast-create') as HTMLButtonElement
    expect(create).toHaveTextContent('CREATING…')
    expect(create.disabled).toBe(true)
  })

  it('CREATE shows RETRY after an error', () => {
    render(<ShareToast {...baseProps} createState="error" />)
    expect(screen.getByTestId('share-toast-create')).toHaveTextContent('RETRY')
  })
})

describe('ShareToast — state B (hosted link ready)', () => {
  it('shows LINK READY + COPY LINK + POST TO X, no CREATE', () => {
    const onPostToX = vi.fn()
    render(
      <ShareToast
        {...baseProps}
        shareUrl="https://allmarks.app/s/k3p9xv"
        onPostToX={onPostToX}
        onCopyLink={vi.fn<() => Promise<boolean>>().mockResolvedValue(true)}
      />,
    )
    expect(screen.getByTestId('share-toast-ready')).toHaveTextContent('LINK READY')
    expect(screen.getByTestId('share-toast-copy-link')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('share-toast-post-x'))
    expect(onPostToX).toHaveBeenCalledOnce()
    expect(screen.queryByTestId('share-toast-create')).toBeNull()
  })

  it('offers SAVE IMAGE when onSaveImage is provided', () => {
    const onSaveImage = vi.fn()
    render(<ShareToast {...baseProps} shareUrl="https://allmarks.app/s/abc" onSaveImage={onSaveImage} />)
    const save = screen.getByTestId('share-toast-save-image')
    fireEvent.click(save)
    expect(onSaveImage).toHaveBeenCalledOnce()
  })

  it('shows COPY LINK → LINK COPIED on success', async () => {
    const onCopyLink = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)
    render(<ShareToast {...baseProps} shareUrl="https://allmarks.app/s/abc" onCopyLink={onCopyLink} />)
    const btn = screen.getByTestId('share-toast-copy-link')
    expect(btn).toHaveTextContent('COPY LINK')
    fireEvent.click(btn)
    await waitFor(() => expect(onCopyLink).toHaveBeenCalled())
    await screen.findByText('LINK COPIED', { exact: false })
  })

  it('shows an error label when copy fails', async () => {
    const onCopyLink = vi.fn<() => Promise<boolean>>().mockResolvedValue(false)
    render(<ShareToast {...baseProps} shareUrl="https://allmarks.app/s/abc" onCopyLink={onCopyLink} />)
    fireEvent.click(screen.getByTestId('share-toast-copy-link'))
    await screen.findByText("COULDN'T COPY", { exact: false })
  })
})
