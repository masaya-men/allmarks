import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { CardSlideshow } from '@/components/board/CardSlideshow'

describe('CardSlideshow', () => {
  it('renders nothing when there are no frames', () => {
    const { container } = render(<CardSlideshow frames={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('stacks all frames and shows the first one opaque', () => {
    const { container } = render(
      <CardSlideshow frames={[{ src: 'a.jpg' }, { src: 'b.jpg' }]} />,
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(2)
    expect((imgs[0] as HTMLElement).style.opacity).toBe('1')
    expect((imgs[1] as HTMLElement).style.opacity).toBe('0')
  })

  it('swaps to the fallback url once when a frame fails to load', () => {
    const { container } = render(
      <CardSlideshow frames={[{ src: 'hq1.jpg', fallback: '1.jpg' }]} />,
    )
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe('hq1.jpg')
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe('1.jpg')
  })
})
