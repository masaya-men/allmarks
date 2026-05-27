import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SenderShareModal } from './SenderShareModal'
import { SHARE_SCHEMA_VERSION_V2, type ShareDataV2 } from '@/lib/share/types-v2'

const sampleShare: ShareDataV2 = {
  v: SHARE_SCHEMA_VERSION_V2,
  cards: [{ u: 'https://a.com', t: 'T', ty: 'website', cw: 200, a: 1 }],
  createdAt: 1735000000000,
}

const defaultProps = {
  open: true,
  onClose: () => {},
  getShareData: () => sampleShare,
  getCanvasElement: () => null,
  totalBoardCount: 1,
}

describe('SenderShareModal', () => {
  it('renders nothing when open=false', () => {
    render(<SenderShareModal {...defaultProps} open={false} />)
    expect(screen.queryByText('SHARE BOARD')).toBeNull()
  })

  it('renders header when open=true', () => {
    render(<SenderShareModal {...defaultProps} />)
    expect(screen.getByText('SHARE BOARD')).toBeInTheDocument()
  })

  it('calls onClose when CLOSE button clicked', () => {
    const onClose = vi.fn()
    render(<SenderShareModal {...defaultProps} onClose={onClose} />)
    screen.getByText('CLOSE').click()
    expect(onClose).toHaveBeenCalled()
  })

  it('shows raw card count when total equals shared count', () => {
    render(<SenderShareModal {...defaultProps} totalBoardCount={1} />)
    expect(screen.getByText('1 CARDS')).toBeInTheDocument()
  })

  it('shows "SHARING X OF Y" when board has more cards than the share', () => {
    render(<SenderShareModal {...defaultProps} totalBoardCount={300} />)
    expect(screen.getByText(/SHARING 1 OF 300 CARDS · NEWEST FIRST/)).toBeInTheDocument()
  })
})
