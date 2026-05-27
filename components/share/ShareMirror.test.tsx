import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ShareMirror } from './ShareMirror'
import { SHARE_SCHEMA_VERSION_V2, type ShareDataV2 } from '@/lib/share/types-v2'

function makeShareData(n: number): ShareDataV2 {
  return {
    v: SHARE_SCHEMA_VERSION_V2,
    cards: Array.from({ length: n }, (_, i) => ({
      u: `https://example.com/c${i}`,
      t: `card ${i}`,
      ty: 'website' as const,
      cw: 240,
      a: 1.6,
      th: `https://example.com/thumb${i}.webp`,
    })),
    createdAt: Date.now(),
  }
}

describe('ShareMirror', () => {
  it('renders one [data-mirror-card-id] element per card', () => {
    const data = makeShareData(5)
    const { container } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={5}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    const cards = container.querySelectorAll('[data-mirror-card-id]')
    expect(cards.length).toBe(5)
  })

  it('does NOT render any iframe (MOTION OFF guarantee)', () => {
    const data = makeShareData(3)
    const { container } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={3}
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
    const data = makeShareData(3)
    const { getByText } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(getByText(/3 CARDS/)).toBeTruthy()
  })

  it('renders "N OF M CARDS · NEWEST FIRST" when trimmed', () => {
    const data = makeShareData(3)
    const { getByText } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={10}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(getByText(/3 OF 10 CARDS · NEWEST FIRST/)).toBeTruthy()
  })

  it('renders top tag strip when activeTagNames non-empty', () => {
    const data = makeShareData(2)
    const { getByText } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={['Music', 'Design']}
        totalBoardCount={2}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(getByText(/MUSIC · DESIGN/)).toBeTruthy()
  })

  it('omits top tag strip when activeTagNames empty', () => {
    const data = makeShareData(2)
    const { queryByTestId } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={2}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(queryByTestId('mirror-tag-strip')).toBeNull()
  })

  it('applies scroll transform when scrollY changes', () => {
    // Use 60 portrait cards (a=0.5, clamped minimum) so each card is 160px tall.
    // With 14 columns, ~5 cards per col → worldHeight ≈ 830px > MIRROR_FRAME_HEIGHT(628).
    // mirrorScrollMax > 0, so translateY changes between scrollY=0 and scrollY=500.
    const data: ShareDataV2 = {
      v: SHARE_SCHEMA_VERSION_V2,
      cards: Array.from({ length: 60 }, (_, i) => ({
        u: `https://example.com/c${i}`, t: `card ${i}`, ty: 'website' as const, cw: 240, a: 0.5,
      })),
      createdAt: Date.now(),
    }
    const { container, rerender } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={60}
        scrollY={0}
        contentHeight={4000}
        viewportHeight={800}
      />,
    )
    const cardsLayer1 = container.querySelector('[data-testid="mirror-cards-layer"]') as HTMLElement | null
    const t1 = cardsLayer1?.style.transform ?? ''

    rerender(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={60}
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
