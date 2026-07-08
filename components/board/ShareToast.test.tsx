import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ShareToast } from './ShareToast'

const noop = (): void => {}
const baseProps = {
  count: 0,
  hint: '',
  hasImage: false,
  onPickFile: noop,
  onClearImage: noop,
  createState: 'idle' as const,
  onCreate: noop,
  onPostToX: noop,
  onReselect: noop,
  onDone: noop,
}

describe('ShareToast — state A (before a screenshot)', () => {
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
    render(<ShareToast {...baseProps} count={3} hint="Press Win+Shift+S, then drag the collage area." />)
    expect(screen.getByText('Press Win+Shift+S, then drag the collage area.')).toBeInTheDocument()
  })

  it('shows the PASTE / DROP SHOT affordance and fires onPickFile', () => {
    const onPickFile = vi.fn()
    render(<ShareToast {...baseProps} count={2} onPickFile={onPickFile} />)
    const chip = screen.getByTestId('share-toast-paste')
    expect(chip).toHaveTextContent('PASTE / DROP SHOT')
    fireEvent.click(chip)
    expect(onPickFile).toHaveBeenCalledOnce()
  })

  it('shows COPY LINK, then LINK COPIED on success', async () => {
    const onCopyLink = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)
    render(<ShareToast {...baseProps} count={2} onCopyLink={onCopyLink} />)
    const btn = screen.getByTestId('share-toast-copy-link')
    expect(btn).toHaveTextContent('COPY LINK')
    fireEvent.click(btn)
    await waitFor(() => expect(onCopyLink).toHaveBeenCalled())
    await screen.findByText('LINK COPIED', { exact: false })
  })

  it('shows an error label when copy fails', async () => {
    const onCopyLink = vi.fn<() => Promise<boolean>>().mockResolvedValue(false)
    render(<ShareToast {...baseProps} count={2} onCopyLink={onCopyLink} />)
    fireEvent.click(screen.getByTestId('share-toast-copy-link'))
    await screen.findByText("COULDN'T COPY", { exact: false })
  })
})

describe('ShareToast — state B (screenshot attached)', () => {
  it('shows the thumbnail + CREATE LINK and fires onCreate', () => {
    const onCreate = vi.fn()
    render(<ShareToast {...baseProps} count={5} hasImage imagePreviewUrl="data:image/jpeg;base64,AAAA" onCreate={onCreate} />)
    expect(screen.getByTestId('share-toast-shot-thumb')).toBeInTheDocument()
    const create = screen.getByTestId('share-toast-create')
    expect(create).toHaveTextContent('CREATE LINK')
    fireEvent.click(create)
    expect(onCreate).toHaveBeenCalledOnce()
  })

  it('clear button fires onClearImage', () => {
    const onClearImage = vi.fn()
    render(<ShareToast {...baseProps} hasImage imagePreviewUrl="data:image/jpeg;base64,AAAA" onClearImage={onClearImage} />)
    fireEvent.click(screen.getByTestId('share-toast-shot-clear'))
    expect(onClearImage).toHaveBeenCalledOnce()
  })

  it('CREATE LINK is disabled and labeled CREATING… while creating', () => {
    render(<ShareToast {...baseProps} hasImage createState="creating" />)
    const create = screen.getByTestId('share-toast-create') as HTMLButtonElement
    expect(create).toHaveTextContent('CREATING…')
    expect(create.disabled).toBe(true)
  })

  it('CREATE LINK shows RETRY after an error', () => {
    render(<ShareToast {...baseProps} hasImage createState="error" />)
    expect(screen.getByTestId('share-toast-create')).toHaveTextContent('RETRY')
  })
})

describe('ShareToast — state C (hosted link ready)', () => {
  it('shows LINK READY + POST TO X + COPY LINK', () => {
    const onPostToX = vi.fn()
    render(<ShareToast {...baseProps} hasImage shareUrl="https://allmarks.app/s/k3p9xv" onPostToX={onPostToX} onCopyLink={vi.fn<() => Promise<boolean>>().mockResolvedValue(true)} />)
    expect(screen.getByTestId('share-toast-ready')).toHaveTextContent('LINK READY')
    expect(screen.getByTestId('share-toast-copy-link')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('share-toast-post-x'))
    expect(onPostToX).toHaveBeenCalledOnce()
    // no CREATE / paste affordance in the ready state
    expect(screen.queryByTestId('share-toast-create')).toBeNull()
    expect(screen.queryByTestId('share-toast-paste')).toBeNull()
  })
})
