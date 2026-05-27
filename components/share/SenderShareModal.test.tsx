import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SenderShareModal } from './SenderShareModal'
import { SHARE_SCHEMA_VERSION_V2, type ShareDataV2 } from '@/lib/share/types-v2'

const sampleShare: ShareDataV2 = {
  v: SHARE_SCHEMA_VERSION_V2,
  cards: [{ u: 'https://a.com', t: 'T', ty: 'website', cw: 200, a: 1 }],
  createdAt: 1735000000000,
}

describe('SenderShareModal', () => {
  it('renders nothing when open=false', () => {
    render(
      <SenderShareModal
        open={false}
        onClose={() => {}}
        getShareData={() => sampleShare}
        getCanvasElement={() => null}
      />,
    )
    expect(screen.queryByText('SHARE BOARD')).toBeNull()
  })

  it('renders header when open=true', () => {
    render(
      <SenderShareModal
        open={true}
        onClose={() => {}}
        getShareData={() => sampleShare}
        getCanvasElement={() => null}
      />,
    )
    expect(screen.getByText('SHARE BOARD')).toBeInTheDocument()
  })

  it('calls onClose when CLOSE button clicked', () => {
    const onClose = vi.fn()
    render(
      <SenderShareModal
        open={true}
        onClose={onClose}
        getShareData={() => sampleShare}
        getCanvasElement={() => null}
      />,
    )
    screen.getByText('CLOSE').click()
    expect(onClose).toHaveBeenCalled()
  })
})
