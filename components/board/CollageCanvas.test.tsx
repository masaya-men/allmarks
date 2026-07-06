import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CollageCanvas } from './CollageCanvas'
import { seedCollagePositions } from '@/lib/share/collage-layout'
import { defaultShareTitleConfig } from '@/lib/share/share-title'
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
        maxCardWidth={1000}
        displayMode="visual"
        paper={false}
      />,
    )
    const el = getByTestId('collage-el-a')
    expect(el.style.width).toBe('200px')
    expect(el.style.transform).toContain('translate(')
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
})
