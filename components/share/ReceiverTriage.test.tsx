import { describe, it, expect, vi, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import { ReceiverTriage } from './ReceiverTriage'
import { SHARE_SCHEMA_VERSION_V2 } from '@/lib/share/types-v2'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

beforeEach(async () => {
  // Reset fake-indexeddb global state between tests
  const fakeIndexedDB = globalThis.indexedDB
  const databases = await fakeIndexedDB.databases()
  for (const dbInfo of databases) {
    if (dbInfo.name) fakeIndexedDB.deleteDatabase(dbInfo.name)
  }
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      share: {
        v: SHARE_SCHEMA_VERSION_V2,
        cards: [
          { u: 'https://a.com', t: 'Card A', ty: 'website', cw: 200, a: 1.5 },
          { u: 'https://b.com', t: 'Card B', ty: 'website', cw: 200, a: 1.5 },
        ],
        createdAt: 1735000000000,
      },
      thumb: '',
    }),
  } as Response) as unknown as typeof fetch
})

describe('ReceiverTriage', () => {
  it('shows queue progress (= 1 OF N) after fetch', async () => {
    render(<ReceiverTriage shareId="k3p9xv" />)
    await waitFor(() => expect(screen.getByText(/1 OF 2/i)).toBeInTheDocument())
  })

  it('shows YES + NO buttons', async () => {
    render(<ReceiverTriage shareId="k3p9xv" />)
    await waitFor(() => expect(screen.getByText(/YES/i)).toBeInTheDocument())
    expect(screen.getByText(/NO/i)).toBeInTheDocument()
  })
})
