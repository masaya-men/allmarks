import { describe, it, expect, vi } from 'vitest'
import { ingestPastedUrl, type IngestDeps } from '@/lib/board/paste-ingest'

function deps(over: Partial<IngestDeps> = {}): IngestDeps {
  return {
    db: {} as never,
    getAll: vi.fn(async () => [] as never[]),
    add: vi.fn(async () => ({ id: 'b1', tags: [] }) as never),
    fetchOgp: vi.fn(async () => ({ title: 'T', description: 'D', image: 'I', siteName: 'S', favicon: 'F' })),
    ...over,
  }
}

describe('ingestPastedUrl', () => {
  it('website: fetches OGP and saves with the metadata', async () => {
    const d = deps()
    const r = await ingestPastedUrl('https://example.com', d)
    expect(d.fetchOgp).toHaveBeenCalledWith('https://example.com')
    expect(d.add).toHaveBeenCalledWith(d.db, expect.objectContaining({
      url: 'https://example.com', title: 'T', thumbnail: 'I', favicon: 'F', siteName: 'S', type: 'website', tags: [],
    }))
    expect(r).toEqual({ outcome: 'saved', bookmarkId: 'b1' })
  })

  it('embeddable (youtube): skips OGP fetch, saves with empty meta', async () => {
    const d = deps()
    await ingestPastedUrl('https://youtu.be/abc12345678', d)
    expect(d.fetchOgp).not.toHaveBeenCalled()
    expect(d.add).toHaveBeenCalledWith(d.db, expect.objectContaining({ type: 'youtube', title: '', thumbnail: '' }))
  })

  it('website OGP failure: still saves with fallback (domain title, empty image)', async () => {
    const d = deps({ fetchOgp: vi.fn(async () => null) })
    await ingestPastedUrl('https://blog.example.com/post', d)
    expect(d.add).toHaveBeenCalledWith(d.db, expect.objectContaining({
      type: 'website', title: 'blog.example.com', thumbnail: '', favicon: '',
    }))
  })

  it('duplicate (same non-deleted url): does not add', async () => {
    const d = deps({ getAll: vi.fn(async () => [{ url: 'https://example.com', isDeleted: false }] as never[]) })
    const r = await ingestPastedUrl('https://example.com', d)
    expect(d.add).not.toHaveBeenCalled()
    expect(r).toEqual({ outcome: 'duplicate', bookmarkId: null })
  })

  it('soft-deleted same url is NOT a duplicate (re-save allowed)', async () => {
    const d = deps({ getAll: vi.fn(async () => [{ url: 'https://example.com', isDeleted: true }] as never[]) })
    await ingestPastedUrl('https://example.com', d)
    expect(d.add).toHaveBeenCalled()
  })
})
