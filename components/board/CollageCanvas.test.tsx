import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CollageCanvas } from './CollageCanvas'
import { seedCollagePositions } from '@/lib/share/collage-layout'

describe('CollageCanvas', () => {
  it('renders one element node per item at its position', () => {
    const items = [{ id: 'a', title: 'A', thumbnailUrl: null, url: 'u' }]
    const positions = seedCollagePositions([{ id: 'a', width: 200, height: 100 }], 1000, 10)
    const { getByTestId } = render(
      <CollageCanvas
        items={items}
        positions={positions}
        order={['a']}
        onMove={() => {}}
        onResize={() => {}}
        onGrab={() => {}}
        maxCardWidth={1000}
        themeId="dotted-notebook"
      />,
    )
    const el = getByTestId('collage-el-a')
    expect(el.style.width).toBe('200px')
    expect(el.style.transform).toContain('translate(')
  })
})
