import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shouldShowQuickTagWindow, applyExistingQuickTag, applyNewQuickTag } from './quick-tag-apply'
import { addTagToBookmark, addTag, getAllTags } from '@/lib/storage/tags'
import { postBookmarkUpdated } from '@/lib/board/channel'

vi.mock('@/lib/storage/tags', () => ({
  addTagToBookmark: vi.fn(async () => {}),
  addTag: vi.fn(async (_db: unknown, input: { name: string; color: string; order: number }) => ({
    id: `new-${input.name}`, name: input.name, color: input.color, order: input.order, createdAt: Date.now(),
  })),
  getAllTags: vi.fn(async () => []),
}))
vi.mock('@/lib/board/channel', () => ({ postBookmarkUpdated: vi.fn() }))

// applyExistingQuickTag now re-checks the target tag directly against the DB
// (db.get('tags', tagId)) before writing — the structural backstop added by
// the final whole-branch review's C1 fix. Tests need a db stub that supports
// `.get`; `undefined` means "not the Private vault tag".
function fakeDb(tagOnGet?: { id: string; isPrivateVault?: boolean }): never {
  return { get: vi.fn(async () => tagOnGet) } as never
}

describe('shouldShowQuickTagWindow', () => {
  it('shows only when enabled and PiP not active', () => {
    expect(shouldShowQuickTagWindow(true, false)).toBe(true)
    expect(shouldShowQuickTagWindow(true, true)).toBe(false)
    expect(shouldShowQuickTagWindow(false, false)).toBe(false)
    expect(shouldShowQuickTagWindow(false, true)).toBe(false)
  })
})

describe('applyExistingQuickTag', () => {
  beforeEach(() => vi.clearAllMocks())
  it('writes the tag and broadcasts an update', async () => {
    const db = fakeDb(undefined)
    const applied = await applyExistingQuickTag(db, 'b1', 't1')
    expect(applied).toBe(true)
    expect(addTagToBookmark).toHaveBeenCalledWith(db, 'b1', 't1')
    expect(postBookmarkUpdated).toHaveBeenCalledWith({ bookmarkId: 'b1' })
  })
  it('refuses and does not write when the tag is the Private vault tag', async () => {
    const db = fakeDb({ id: 't1', isPrivateVault: true })
    const applied = await applyExistingQuickTag(db, 'b1', 't1')
    expect(applied).toBe(false)
    expect(addTagToBookmark).not.toHaveBeenCalled()
    expect(postBookmarkUpdated).not.toHaveBeenCalled()
  })
})

describe('applyNewQuickTag', () => {
  beforeEach(() => vi.clearAllMocks())
  it('reuses an existing tag by case-insensitive name', async () => {
    const allTags = [{ id: 't1', name: 'design', color: '#fff', order: 0, createdAt: Date.now() }]
    vi.mocked(getAllTags).mockResolvedValue(allTags)
    const db = {} as never
    const tag = await applyNewQuickTag(db, 'b1', 'Design', allTags)
    expect(tag).not.toBeNull()
    expect(tag!.id).toBe('t1')
    expect(addTag).not.toHaveBeenCalled()
    expect(addTagToBookmark).toHaveBeenCalledWith(db, 'b1', 't1')
    expect(postBookmarkUpdated).toHaveBeenCalledWith({ bookmarkId: 'b1' })
  })
  it('creates a new green tag when none matches', async () => {
    const allTags = [{ id: 't1', name: 'design', color: '#fff', order: 0, createdAt: Date.now() }]
    vi.mocked(getAllTags).mockResolvedValue(allTags)
    const db = {} as never
    const tag = await applyNewQuickTag(db, 'b1', 'fresh', allTags)
    expect(tag).not.toBeNull()
    expect(addTag).toHaveBeenCalledWith(db, { name: 'fresh', color: '#28F100', order: 1 })
    expect(tag!.id).toBe('new-fresh')
    expect(addTagToBookmark).toHaveBeenCalledWith(db, 'b1', 'new-fresh')
  })
  it('ignores blank input (no writes)', async () => {
    const tag = await applyNewQuickTag({} as never, 'b1', '   ', [])
    expect(tag).toBeNull()
    expect(addTag).not.toHaveBeenCalled()
    expect(addTagToBookmark).not.toHaveBeenCalled()
    expect(postBookmarkUpdated).not.toHaveBeenCalled()
  })
  it('refuses and does not write when the matched name belongs to the Private vault tag', async () => {
    const allTags = [{ id: 'priv-1', name: 'Private', color: '#000000', order: 0, createdAt: Date.now(), isPrivateVault: true }]
    vi.mocked(getAllTags).mockResolvedValue(allTags)
    const tag = await applyNewQuickTag({} as never, 'b1', 'private', allTags)
    expect(tag).toBeNull()
    expect(addTag).not.toHaveBeenCalled()
    expect(addTagToBookmark).not.toHaveBeenCalled()
    expect(postBookmarkUpdated).not.toHaveBeenCalled()
  })
})
