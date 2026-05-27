import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ShareMirror, type MirrorItem, type MirrorPosition } from './ShareMirror'

function makeItems(n: number): MirrorItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `bookmark-${i}`,
    url: `https://example.com/c${i}`,
    title: `card ${i}`,
    thumbnailUrl: `https://example.com/thumb${i}.webp`,
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

describe('ShareMirror', () => {
  it('renders one [data-mirror-card-id] element per item', () => {
    const { container } = render(
      <ShareMirror
        items={makeItems(5)}
        positions={makePositions(5)}
        bgViewportWidth={1200}
        bgCanvasWidth={1218}
        activeTagNames={[]}
        totalBoardCount={5}
        sharedCardCount={5}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    const cards = container.querySelectorAll('[data-mirror-card-id]')
    expect(cards.length).toBe(5)
  })

  it('does NOT render any iframe (MOTION OFF guarantee)', () => {
    const { container } = render(
      <ShareMirror
        items={makeItems(3)}
        positions={makePositions(3)}
        bgViewportWidth={1200}
        bgCanvasWidth={1218}
        activeTagNames={[]}
        totalBoardCount={3}
        sharedCardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(container.querySelectorAll('iframe').length).toBe(0)
    expect(container.querySelectorAll('video').length).toBe(0)
    expect(container.querySelectorAll('audio').length).toBe(0)
  })

  it('renders bottom brand strip with "N CARDS" when no trim', () => {
    const { getByText } = render(
      <ShareMirror
        items={makeItems(3)}
        positions={makePositions(3)}
        bgViewportWidth={1200}
        bgCanvasWidth={1218}
        activeTagNames={[]}
        totalBoardCount={3}
        sharedCardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(getByText(/3 CARDS/)).toBeTruthy()
  })

  it('renders "N OF M CARDS · NEWEST FIRST" when trimmed', () => {
    const { getByText } = render(
      <ShareMirror
        items={makeItems(3)}
        positions={makePositions(3)}
        bgViewportWidth={1200}
        bgCanvasWidth={1218}
        activeTagNames={[]}
        totalBoardCount={10}
        sharedCardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(getByText(/3 OF 10 CARDS · NEWEST FIRST/)).toBeTruthy()
  })

  it('renders top tag strip when activeTagNames non-empty', () => {
    const { getByText } = render(
      <ShareMirror
        items={makeItems(2)}
        positions={makePositions(2)}
        bgViewportWidth={1200}
        bgCanvasWidth={1218}
        activeTagNames={['Music', 'Design']}
        totalBoardCount={2}
        sharedCardCount={2}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(getByText(/MUSIC · DESIGN/)).toBeTruthy()
  })

  it('omits top tag strip when activeTagNames empty', () => {
    const { queryByTestId } = render(
      <ShareMirror
        items={makeItems(2)}
        positions={makePositions(2)}
        bgViewportWidth={1200}
        bgCanvasWidth={1218}
        activeTagNames={[]}
        totalBoardCount={2}
        sharedCardCount={2}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(queryByTestId('mirror-tag-strip')).toBeNull()
  })

  it('falls back to text body when an img fails to load (= CORS-blocked Twitter thumb case)', () => {
    const { container } = render(
      <ShareMirror
        items={[{
          id: 'tw-1',
          url: 'https://x.com/foo/status/1',
          title: 'tweet body that should show as wrapped text after img error',
          thumbnailUrl: 'https://pbs.twimg.com/blocked-by-cors.jpg',
        }]}
        positions={[{ id: 'tw-1', x: 0, y: 0, w: 240, h: 180 }]}
        bgViewportWidth={1200}
        bgCanvasWidth={1218}
        activeTagNames={[]}
        totalBoardCount={1}
        sharedCardCount={1}
        scrollY={0}
        contentHeight={500}
        viewportHeight={400}
      />,
    )
    // Pre-error: img path is taken
    const img = container.querySelector('img[src*="pbs.twimg.com"]') as HTMLImageElement | null
    expect(img).toBeTruthy()
    expect(container.querySelector(`[class*="cardTextBody"]`)).toBeNull()

    // Simulate img.onerror (= CORS rejection)
    if (img) fireEvent.error(img)

    // Post-error: text body path is taken
    expect(container.querySelector('img[src*="pbs.twimg.com"]')).toBeNull()
    expect(container.querySelector(`[class*="cardTextBody"]`)).toBeTruthy()
  })

  it('applies scroll transform when scrollY changes', () => {
    // Use 60 items laid out in a tall grid. The cardsLayer has a large world height,
    // so translateY changes between scrollY=0 and scrollY=500.
    const items = makeItems(60)
    // Arrange them in a 3-column grid, 20 rows → worldHeight = 20 * 200 = 4000px
    const positions: MirrorPosition[] = Array.from({ length: 60 }, (_, i) => ({
      id: `bookmark-${i}`,
      x: (i % 3) * 260,
      y: Math.floor(i / 3) * 200,
      w: 240,
      h: 180,
    }))

    const { container, rerender } = render(
      <ShareMirror
        items={items}
        positions={positions}
        bgViewportWidth={1200}
        bgCanvasWidth={1218}
        activeTagNames={[]}
        totalBoardCount={60}
        sharedCardCount={60}
        scrollY={0}
        contentHeight={4000}
        viewportHeight={800}
      />,
    )
    const cardsLayer1 = container.querySelector('[data-testid="mirror-cards-layer"]') as HTMLElement | null
    const t1 = cardsLayer1?.style.transform ?? ''

    rerender(
      <ShareMirror
        items={items}
        positions={positions}
        bgViewportWidth={1200}
        bgCanvasWidth={1218}
        activeTagNames={[]}
        totalBoardCount={60}
        sharedCardCount={60}
        scrollY={500}
        contentHeight={4000}
        viewportHeight={800}
      />,
    )
    const cardsLayer2 = container.querySelector('[data-testid="mirror-cards-layer"]') as HTMLElement | null
    const t2 = cardsLayer2?.style.transform ?? ''
    expect(t1).not.toBe(t2)
  })
})
