import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor, act } from '@testing-library/react'
import { SenderShareModal } from './SenderShareModal'
import { SHARE_SCHEMA_VERSION_V2, type ShareDataV2 } from '@/lib/share/types-v2'
import type { MirrorItem, MirrorPosition } from './ShareMirror'

vi.mock('@/lib/share/api-client', () => ({
  createShare: vi.fn(),
}))
vi.mock('@/lib/share/capture-mirror', () => ({
  captureMirrorToWebP: vi.fn(),
}))
// renderShareImage is mocked to null by default so the fallback path (captureMirrorToWebP)
// always runs in unit tests — dom-to-image-more requires a real browser environment.
vi.mock('@/lib/share/render-share-image', () => ({
  renderShareImage: vi.fn().mockResolvedValue(null),
}))

import { createShare } from '@/lib/share/api-client'
import { captureMirrorToWebP } from '@/lib/share/capture-mirror'

function makeShare(n: number): ShareDataV2 {
  return {
    v: SHARE_SCHEMA_VERSION_V2,
    cards: Array.from({ length: n }, (_, i) => ({
      u: `https://example.com/c${i}`, t: `c${i}`, ty: 'website' as const, cw: 240, a: 1.6,
    })),
    createdAt: Date.now(),
  }
}

function makeItems(n: number): MirrorItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `bookmark-${i}`,
    url: `https://example.com/c${i}`,
    title: `card ${i}`,
    thumbnailUrl: null,
  }))
}

function makePositions(n: number): MirrorPosition[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `bookmark-${i}`,
    x: (i % 3) * 260,
    y: Math.floor(i / 3) * 200,
    w: 240,
    h: 180,
  }))
}

const defaultMirrorProps = {
  items: makeItems(3),
  positions: makePositions(3),
  bgViewportWidth: 1200,
  bgCanvasWidth: 1218,
  themeId: 'dotted-notebook' as const,
  custom: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SenderShareModal', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <SenderShareModal
        open={false}
        onClose={vi.fn()}
        getShareData={() => makeShare(3)}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
        onPanY={vi.fn()}
        {...defaultMirrorProps}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders mirror + SHARE confirm button when open', () => {
    const { getByRole, queryAllByTestId } = render(
      <SenderShareModal
        open={true}
        onClose={vi.fn()}
        getShareData={() => makeShare(5)}
        totalBoardCount={5}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
        onPanY={vi.fn()}
        items={makeItems(5)}
        positions={makePositions(5)}
        bgViewportWidth={1200}
        bgCanvasWidth={1218}
        themeId="dotted-notebook"
        custom={null}
      />,
    )
    // Two mirror-frame elements: the visible preview + the hidden capture node.
    expect(queryAllByTestId('mirror-frame').length).toBeGreaterThanOrEqual(1)
    expect(getByRole('button', { name: /SHARE NOW/i })).toBeTruthy()
  })

  it('on SHARE NOW click: captures + createShare', async () => {
    vi.mocked(captureMirrorToWebP).mockResolvedValue('data:image/webp;base64,XXXX')
    vi.mocked(createShare).mockResolvedValue({
      ok: true,
      data: { id: 'abc123', expiresAt: Date.now() + 1000 * 86400 },
    })

    const { getByRole, findByText } = render(
      <SenderShareModal
        open={true}
        onClose={vi.fn()}
        getShareData={() => makeShare(3)}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
        onPanY={vi.fn()}
        {...defaultMirrorProps}
      />,
    )
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /SHARE NOW/i }))
    })
    await waitFor(() => {
      expect(captureMirrorToWebP).toHaveBeenCalled()
      expect(createShare).toHaveBeenCalled()
    })
    await findByText(/COPY/)  // URL row appears
  })

  it('shows error state when capture returns null', async () => {
    vi.mocked(captureMirrorToWebP).mockResolvedValue(null)
    const { getByRole, findByText } = render(
      <SenderShareModal
        open={true}
        onClose={vi.fn()}
        getShareData={() => makeShare(3)}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
        onPanY={vi.fn()}
        {...defaultMirrorProps}
      />,
    )
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /SHARE NOW/i }))
    })
    expect(await findByText(/⚠/)).toBeTruthy()
  })

  it('shows error state when createShare fails', async () => {
    vi.mocked(captureMirrorToWebP).mockResolvedValue('data:image/webp;base64,XXXX')
    vi.mocked(createShare).mockResolvedValue({
      ok: false,
      error: 'rate_limit',
      message: 'rate limit exceeded',
    })

    const { getByRole, findByText } = render(
      <SenderShareModal
        open={true}
        onClose={vi.fn()}
        getShareData={() => makeShare(3)}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
        onPanY={vi.fn()}
        {...defaultMirrorProps}
      />,
    )
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /SHARE NOW/i }))
    })
    expect(await findByText(/rate limit exceeded/)).toBeTruthy()
  })

  it('ESC closes modal', () => {
    const onClose = vi.fn()
    render(
      <SenderShareModal
        open={true}
        onClose={onClose}
        getShareData={() => makeShare(3)}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
        onPanY={vi.fn()}
        {...defaultMirrorProps}
      />,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('backdrop click closes modal', () => {
    const onClose = vi.fn()
    const { container } = render(
      <SenderShareModal
        open={true}
        onClose={onClose}
        getShareData={() => makeShare(3)}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
        onPanY={vi.fn()}
        {...defaultMirrorProps}
      />,
    )
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('forwards wheel events to onPanY', () => {
    const onPanY = vi.fn()
    const { container } = render(
      <SenderShareModal
        open={true}
        onClose={vi.fn()}
        getShareData={() => makeShare(3)}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
        onPanY={onPanY}
        {...defaultMirrorProps}
      />,
    )
    const backdrop = container.firstChild as HTMLElement
    fireEvent.wheel(backdrop, { deltaY: 100 })
    expect(onPanY).toHaveBeenCalledWith(100)
  })
})
