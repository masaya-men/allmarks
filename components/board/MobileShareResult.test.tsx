import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MobileShareResult } from './MobileShareResult'

const IMG = 'data:image/jpeg;base64,AAAA'
const URL_ = 'https://allmarks.app/s/abc123'
const baseProps = {
  imageUrl: IMG,
  shareUrl: URL_,
  createState: 'idle' as const,
  onCopyLink: async (): Promise<boolean> => true,
  onRetry: (): void => {},
  onDone: (): void => {},
}

/** jsdom has neither navigator.share nor navigator.canShare. */
function stubNavigator(share: unknown, canShare?: unknown): void {
  if (share === undefined) Reflect.deleteProperty(navigator, 'share')
  else Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
  if (canShare === undefined) Reflect.deleteProperty(navigator, 'canShare')
  else Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true })
}

afterEach(() => stubNavigator(undefined, undefined))

describe('MobileShareResult', () => {
  it('shares the image file and the link when the platform accepts files', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    stubNavigator(share, () => true)
    render(<MobileShareResult {...baseProps} />)
    fireEvent.click(screen.getByTestId('mobile-share-native'))
    await waitFor(() => expect(share).toHaveBeenCalledOnce())
    const arg = share.mock.calls[0]?.[0] as { files?: File[]; url?: string }
    expect(arg.files?.[0]?.type).toBe('image/jpeg')
    expect(arg.url).toBe(URL_)
  })

  it('falls back to a link-only share when files are refused', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    stubNavigator(share, () => false)
    render(<MobileShareResult {...baseProps} />)
    fireEvent.click(screen.getByTestId('mobile-share-native'))
    await waitFor(() => expect(share).toHaveBeenCalledOnce())
    expect(share.mock.calls[0]?.[0]).toEqual({ url: URL_ })
  })

  it('hides SHARE entirely when the platform has no Web Share', () => {
    stubNavigator(undefined, undefined)
    render(<MobileShareResult {...baseProps} />)
    expect(screen.queryByTestId('mobile-share-native')).toBeNull()
    expect(screen.getByTestId('mobile-share-copy')).toBeTruthy()
  })

  it('swallows an aborted share (user closed the OS sheet)', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'))
    stubNavigator(share, () => true)
    render(<MobileShareResult {...baseProps} />)
    fireEvent.click(screen.getByTestId('mobile-share-native'))
    await waitFor(() => expect(share).toHaveBeenCalledOnce())
    expect(screen.queryByTestId('mobile-share-error')).toBeNull()
  })

  it('drops the preview when the capture failed, but keeps sharing alive', () => {
    stubNavigator(vi.fn(), () => true)
    render(<MobileShareResult {...baseProps} imageUrl={null} />)
    expect(screen.queryByTestId('mobile-share-preview')).toBeNull()
    expect(screen.getByTestId('mobile-share-native')).toBeTruthy()
    expect(screen.getByTestId('mobile-share-copy')).toBeTruthy()
  })

  it('offers RETRY and no preview when the link could not be created', () => {
    stubNavigator(vi.fn(), () => true)
    const onRetry = vi.fn()
    render(<MobileShareResult {...baseProps} createState="error" shareUrl={null} onRetry={onRetry} />)
    expect(screen.queryByTestId('mobile-share-preview')).toBeNull()
    expect(screen.queryByTestId('mobile-share-native')).toBeNull()
    fireEvent.click(screen.getByTestId('mobile-share-retry'))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('confirms a copy', async () => {
    stubNavigator(undefined, undefined)
    render(<MobileShareResult {...baseProps} />)
    fireEvent.click(screen.getByTestId('mobile-share-copy'))
    await waitFor(() => expect(screen.getByTestId('mobile-share-copy').textContent).toBe('LINK COPIED'))
  })

  it('shows the NO IMAGE warning + diag line when the link exists but the image is null', () => {
    render(
      <MobileShareResult
        imageUrl={null}
        shareUrl="https://allmarks.app/s/abc123"
        createState="idle"
        captureAttempts={[
          { scale: 3.08, timeoutMs: 20000, elapsedMs: 20003, stage: 'timeout', message: null },
          { scale: 1, timeoutMs: 12000, elapsedMs: 12001, stage: 'timeout', message: null },
        ]}
        onCopyLink={async () => true}
        onRetry={() => {}}
        onDone={() => {}}
      />,
    )
    expect(screen.getByTestId('mobile-share-image-failed')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-share-diag').textContent).toContain('#1 x3.08 timeout')
    expect(screen.queryByTestId('mobile-share-preview')).toBeNull()
    expect(screen.getByTestId('mobile-share-retry-image')).toBeInTheDocument()
  })

  it('shows the diag line on success too when a fallback attempt was needed', () => {
    render(
      <MobileShareResult
        imageUrl="data:image/jpeg;base64,xxxx"
        shareUrl="https://allmarks.app/s/abc123"
        createState="idle"
        captureAttempts={[
          { scale: 3.08, timeoutMs: 20000, elapsedMs: 9000, stage: 'render', message: 'RangeError: too big' },
          { scale: 1, timeoutMs: 12000, elapsedMs: 2100, stage: null, message: null },
        ]}
        onCopyLink={async () => true}
        onRetry={() => {}}
        onDone={() => {}}
      />,
    )
    expect(screen.getByTestId('mobile-share-preview')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-share-diag').textContent).toContain('RangeError')
  })

  it('shows the create-error detail message when the link itself failed', () => {
    render(
      <MobileShareResult
        imageUrl={null}
        shareUrl={null}
        createState="error"
        errorMessage="fetch failed"
        onCopyLink={async () => true}
        onRetry={() => {}}
        onDone={() => {}}
      />,
    )
    expect(screen.getByTestId('mobile-share-error')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-share-error-detail').textContent).toBe('fetch failed')
  })
})
