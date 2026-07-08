import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { MobileLightbox } from './MobileLightbox'
import type { LightboxItem } from '@/lib/share/lightbox-item'

const view = { url: 'https://x.test/a', title: 'T', description: '', thumbnail: null } as unknown as LightboxItem

describe('MobileLightbox', () => {
  it('renders the big-center main and the caption screen', () => {
    render(
      <MobileLightbox
        view={view}
        mediaRef={createRef<HTMLDivElement>()}
        main={<img alt="m" />}
        caption={<p>info</p>}
        nav={null}
        onClose={() => {}}
      />,
    )
    expect(screen.getByTestId('mobile-lightbox')).toBeInTheDocument()
    expect(screen.getByAltText('m')).toBeInTheDocument()
    expect(screen.getByTestId('lightbox-caption')).toBeInTheDocument()
  })

  it('closes when the empty stage background is tapped (from the card screen)', () => {
    const onClose = vi.fn()
    render(
      <MobileLightbox
        view={view}
        mediaRef={createRef<HTMLDivElement>()}
        main={<img alt="m" />}
        caption={<p>info</p>}
        nav={null}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByTestId('mobile-lightbox'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
