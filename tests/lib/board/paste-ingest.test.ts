import { describe, it, expect, vi } from 'vitest'
import { ingestPastedUrl, type IngestDeps } from '@/lib/board/paste-ingest'

function deps(over: Partial<IngestDeps> = {}): IngestDeps {
  return {
    db: {} as never,
    getAll: vi.fn(async () => [] as never[]),
    save: vi.fn(async () => ({ outcome: 'saved', bookmark: { id: 'b1', tags: [] } }) as never),
    fetchOgp: vi.fn(async () => ({ title: 'T', description: 'D', image: 'I', siteName: 'S', favicon: 'F' })),
    ...over,
  }
}

describe('ingestPastedUrl', () => {
  it('website: fetches OGP and saves with the metadata', async () => {
    const d = deps()
    const r = await ingestPastedUrl('https://example.com', d)
    expect(d.fetchOgp).toHaveBeenCalledWith('https://example.com')
    expect(d.save).toHaveBeenCalledWith(d.db, expect.objectContaining({
      url: 'https://example.com', title: 'T', thumbnail: 'I', favicon: 'F', siteName: 'S', type: 'website', tags: [],
    }), { dedupe: true })
    expect(r).toEqual({ outcome: 'saved', bookmarkId: 'b1' })
  })

  it('embeddable (youtube): skips OGP fetch, saves with empty meta', async () => {
    const d = deps()
    await ingestPastedUrl('https://youtu.be/abc12345678', d)
    expect(d.fetchOgp).not.toHaveBeenCalled()
    expect(d.save).toHaveBeenCalledWith(d.db, expect.objectContaining({ type: 'youtube', title: '', thumbnail: '' }), { dedupe: true })
  })

  it('website OGP failure: still saves with fallback (domain title, empty image)', async () => {
    const d = deps({ fetchOgp: vi.fn(async () => null) })
    await ingestPastedUrl('https://blog.example.com/post', d)
    expect(d.save).toHaveBeenCalledWith(d.db, expect.objectContaining({
      type: 'website', title: 'blog.example.com', thumbnail: '', favicon: '',
    }), { dedupe: true })
  })

  it('duplicate (same non-deleted url): does not save (pre-check skips the OGP fetch)', async () => {
    const d = deps({ getAll: vi.fn(async () => [{ url: 'https://example.com', isDeleted: false }] as never[]) })
    const r = await ingestPastedUrl('https://example.com', d)
    expect(d.save).not.toHaveBeenCalled()
    expect(d.fetchOgp).not.toHaveBeenCalled()
    expect(r).toEqual({ outcome: 'duplicate', bookmarkId: null })
  })

  it('save() reporting duplicate (lost a concurrent race) maps to a no-op duplicate', async () => {
    const d = deps({ save: vi.fn(async () => ({ outcome: 'duplicate', bookmark: { id: 'x', tags: [] } }) as never) })
    const r = await ingestPastedUrl('https://example.com', d)
    expect(r).toEqual({ outcome: 'duplicate', bookmarkId: null })
  })

  it('soft-deleted same url is NOT a duplicate (re-save allowed)', async () => {
    const d = deps({ getAll: vi.fn(async () => [{ url: 'https://example.com', isDeleted: true }] as never[]) })
    await ingestPastedUrl('https://example.com', d)
    expect(d.save).toHaveBeenCalled()
  })
})
