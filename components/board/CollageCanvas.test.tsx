import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { CollageCanvas } from './CollageCanvas'
import { seedCollagePositions } from '@/lib/share/collage-layout'
import { defaultShareTitleConfig } from '@/lib/share/share-title'
import { createCollageGestureArbiter } from '@/lib/share/stage-zoom'
import type { BoardItem } from '@/lib/storage/use-board-data'

// jsdom lacks IntersectionObserver; the real card faces may reference it.
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): [] {
      return []
    }
  },
)

function makeItem(overrides: Partial<BoardItem> & { bookmarkId: string }): BoardItem {
  return {
    cardId: 'c1',
    title: 'A',
    url: 'https://example.com',
    thumbnail: 'https://example.com/t.jpg',
    aspectRatio: 2,
    gridIndex: 0,
    orderIndex: 0,
    cardWidth: 200,
    customCardWidth: false,
    isRead: false,
    isDeleted: false,
    tags: [],
    displayMode: null,
    ...overrides,
  }
}

describe('CollageCanvas', () => {
  it('renders one element node per item at its position, with the real card face', () => {
    const item = makeItem({ bookmarkId: 'a' })
    const positions = seedCollagePositions([{ id: 'a', width: 200, height: 100 }], 1000, 10)
    const { getByTestId } = render(
      <CollageCanvas
        items={[item]}
        positions={positions}
        order={['a']}
        onMove={() => {}}
        onResize={() => {}}
        onGrab={() => {}}
        rotations={{}}
        onRotate={() => {}}
        maxCardWidth={1000}
        displayMode="visual"
        paper={false}
      />,
    )
    const el = getByTestId('collage-el-a')
    expect(el.style.width).toBe('200px')
    expect(el.style.transform).toContain('translate(')
  })

  it('applies per-card rotation to the element transform and exposes a rotate handle', () => {
    const item = makeItem({ bookmarkId: 'a' })
    const positions = seedCollagePositions([{ id: 'a', width: 200, height: 100 }], 1000, 10)
    const { getByTestId } = render(
      <CollageCanvas
        items={[item]}
        positions={positions}
        order={['a']}
        onMove={() => {}}
        onResize={() => {}}
        onGrab={() => {}}
        rotations={{ a: 30 }}
        onRotate={() => {}}
        maxCardWidth={1000}
        displayMode="visual"
        paper={false}
      />,
    )
    expect(getByTestId('collage-el-a').style.transform).toContain('rotate(30deg)')
    expect(getByTestId('collage-rotate-a')).toBeTruthy()
  })

  it('renders the board paper-card decorations layer only on paper themes', () => {
    const item = makeItem({ bookmarkId: 'a', thumbnail: undefined })
    const positions = seedCollagePositions([{ id: 'a', width: 200, height: 100 }], 1000, 10)
    const baseProps = {
      items: [item],
      positions,
      order: ['a'],
      onMove: () => {},
      onResize: () => {},
      onGrab: () => {},
      rotations: {},
      onRotate: () => {},
      maxCardWidth: 1000,
      displayMode: 'visual' as const,
    }

    const flat = render(<CollageCanvas {...baseProps} paper={false} />)
    expect(flat.queryByTestId('paper-card-decorations')).toBeNull()
    flat.unmount()

    const paper = render(<CollageCanvas {...baseProps} paper={true} />)
    expect(paper.getByTestId('paper-card-decorations')).toBeTruthy()
  })

  it('renders the title layer only when a `title` prop is passed', () => {
    const item = makeItem({ bookmarkId: 'a' })
    const positions = seedCollagePositions([{ id: 'a', width: 200, height: 100 }], 1000, 10)
    const baseProps = {
      items: [item],
      positions,
      order: ['a'],
      onMove: () => {},
      onResize: () => {},
      onGrab: () => {},
      rotations: {},
      onRotate: () => {},
      maxCardWidth: 1000,
      displayMode: 'visual' as const,
      paper: false,
    }

    const withoutTitle = render(<CollageCanvas {...baseProps} />)
    expect(withoutTitle.queryByTestId('share-title-element')).toBeNull()
    withoutTitle.unmount()

    const withTitle = render(
      <CollageCanvas
        {...baseProps}
        title={{
          config: defaultShareTitleConfig(true, 1000, 600),
          defaultText: 'my tag',
          onChange: () => {},
        }}
      />,
    )
    expect(withTitle.getByTestId('share-title-element')).toBeTruthy()
  })

  it('keeps the rotate knob out of the share capture', () => {
    // Touch devices show the knob at rest (no hover), so it MUST be excluded
    // from the capture or it bakes into the shared image.
    const item = makeItem({ bookmarkId: 'a' })
    const positions = seedCollagePositions([{ id: 'a', width: 200, height: 100 }], 1000, 10)
    const { container } = render(
      <CollageCanvas
        items={[item]}
        positions={positions}
        order={['a']}
        onMove={() => {}}
        onResize={() => {}}
        onGrab={() => {}}
        rotations={{}}
        onRotate={() => {}}
        maxCardWidth={1000}
        displayMode="visual"
        paper={false}
      />,
    )
    const knob = container.querySelector('[data-testid^="collage-rotate-"]')
    expect(knob).not.toBeNull()
    expect(knob?.hasAttribute('data-no-capture')).toBe(true)
  })

  it('divides drag deltas by pointerScale so a zoomed stage moves cards in layout px (N-58 stage 2)', () => {
    const item = makeItem({ bookmarkId: 'a' })
    const positions = { a: { x: 10, y: 20, w: 200, h: 100 } }
    const onMove = vi.fn()
    const { getByTestId } = render(
      <CollageCanvas
        items={[item]}
        positions={positions}
        order={['a']}
        onMove={onMove}
        onResize={() => {}}
        onGrab={() => {}}
        rotations={{}}
        onRotate={() => {}}
        maxCardWidth={1000}
        displayMode="visual"
        paper={false}
        pointerScale={2}
      />,
    )
    const el = getByTestId('collage-el-a')
    fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 100, clientY: 60 })
    // screen (100,60) / scale 2 = layout (+50,+30) => (10+50, 20+30) = (60, 50)
    expect(onMove).toHaveBeenLastCalledWith('a', 60, 50)
    fireEvent.pointerUp(el, { pointerId: 1 })
  })

  it('calls onSelect when a card is grabbed', () => {
    const item = makeItem({ bookmarkId: 'a' })
    const positions = { a: { x: 0, y: 0, w: 200, h: 100 } }
    const onSelect = vi.fn()
    const { getByTestId } = render(
      <CollageCanvas
        items={[item]}
        positions={positions}
        order={['a']}
        onMove={() => {}}
        onResize={() => {}}
        onGrab={() => {}}
        rotations={{}}
        onRotate={() => {}}
        maxCardWidth={1000}
        displayMode="visual"
        paper={false}
        onSelect={onSelect}
      />,
    )
    fireEvent.pointerDown(getByTestId('collage-el-a'), { button: 0, pointerId: 1, clientX: 0, clientY: 0 })
    expect(onSelect).toHaveBeenCalledWith('a')
  })

  it('touchMode hides the rotate knob and the four-corner resize handles, and shows a selection frame on the selected card', () => {
    const item = makeItem({ bookmarkId: 'a' })
    const positions = { a: { x: 0, y: 0, w: 200, h: 100 } }
    const { queryByTestId, container } = render(
      <CollageCanvas
        items={[item]}
        positions={positions}
        order={['a']}
        onMove={() => {}}
        onResize={() => {}}
        onGrab={() => {}}
        rotations={{}}
        onRotate={() => {}}
        maxCardWidth={1000}
        displayMode="visual"
        paper={false}
        touchMode
        selectedId="a"
      />,
    )
    expect(queryByTestId('collage-rotate-a')).toBeNull()
    expect(container.querySelector('[data-testid^="resize-handle-"]')).toBeNull()
    expect(queryByTestId('collage-selection-a')).toBeTruthy()
  })

  it('cancelActive on the gesture arbiter stops an in-flight drag (pinch takeover)', () => {
    const item = makeItem({ bookmarkId: 'a' })
    const positions = { a: { x: 0, y: 0, w: 200, h: 100 } }
    const onMove = vi.fn()
    const arbiter = createCollageGestureArbiter()
    const { getByTestId } = render(
      <CollageCanvas
        items={[item]}
        positions={positions}
        order={['a']}
        onMove={onMove}
        onResize={() => {}}
        onGrab={() => {}}
        rotations={{}}
        onRotate={() => {}}
        maxCardWidth={1000}
        displayMode="visual"
        paper={false}
        gestureArbiter={arbiter}
      />,
    )
    const el = getByTestId('collage-el-a')
    fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 10, clientY: 0 })
    const callsBefore = onMove.mock.calls.length
    arbiter.cancelActive()
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 200, clientY: 0 })
    expect(onMove.mock.calls.length).toBe(callsBefore)
  })
})
