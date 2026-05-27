import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ReceiverLanding } from './ReceiverLanding'
import { SHARE_SCHEMA_VERSION_V2 } from '@/lib/share/types-v2'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}))

beforeEach(() => {
  class MockResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      share: {
        v: SHARE_SCHEMA_VERSION_V2,
        cards: [{ u: 'https://a.com', t: 'Card A', ty: 'website', cw: 200, a: 1.5 }],
        createdAt: 1735000000000,
      },
      thumb: '',
    }),
  } as Response) as unknown as typeof fetch
})

describe('ReceiverLanding', () => {
  it('shows loading state initially', () => {
    render(<ReceiverLanding shareId="k3p9xv" />)
    expect(screen.getByText(/LOADING/i)).toBeInTheDocument()
  })

  it('renders shared cards after fetch succeeds', async () => {
    render(<ReceiverLanding shareId="k3p9xv" />)
    await waitFor(() => expect(screen.getByText('Card A')).toBeInTheDocument())
  })

  it('shows expired message on 404', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 404,
      json: async () => ({ error: 'not_found', message: 'expired' }),
    } as Response)
    render(<ReceiverLanding shareId="k3p9xv" />)
    await waitFor(() => expect(screen.getAllByText(/expired/i).length).toBeGreaterThan(0))
  })

  it('renders bulk import + triage CTAs after fetch', async () => {
    render(<ReceiverLanding shareId="k3p9xv" />)
    await waitFor(() => expect(screen.getByText(/IMPORT ALL/i)).toBeInTheDocument())
    expect(screen.getByText(/PICK ONE BY ONE/i)).toBeInTheDocument()
  })
})
