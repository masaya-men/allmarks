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
})
