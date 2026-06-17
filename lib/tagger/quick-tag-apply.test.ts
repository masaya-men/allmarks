import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shouldShowQuickTagWindow, applyExistingQuickTag, applyNewQuickTag } from './quick-tag-apply'
import { addTagToBookmark, addTag } from '@/lib/storage/tags'
import { postBookmarkUpdated } from '@/lib/board/channel'

vi.mock('@/lib/storage/tags', () => ({
  addTagToBookmark: vi.fn(async () => {}),
  addTag: vi.fn(async (_db: unknown, input: { name: string; color: string; order: number }) => ({
    id: `new-${input.name}`, name: input.name, color: input.color, order: input.order, createdAt: Date.now(),
  })),
}))
vi.mock('@/lib/board/channel', () => ({ postBookmarkUpdated: vi.fn() }))

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
    await applyExistingQuickTag({} as never, 'b1', 't1')
    expect(addTagToBookmark).toHaveBeenCalledWith({}, 'b1', 't1')
    expect(postBookmarkUpdated).toHaveBeenCalledWith({ bookmarkId: 'b1' })
  })
})

describe('applyNewQuickTag', () => {
  beforeEach(() => vi.clearAllMocks())
  it('reuses an existing tag by case-insensitive name', async () => {
    const tag = await applyNewQuickTag({} as never, 'b1', 'Design', [
      { id: 't1', name: 'design', color: '#fff', order: 0, createdAt: Date.now() },
    ])
    expect(tag).not.toBeNull()
    expect(tag!.id).toBe('t1')
    expect(addTag).not.toHaveBeenCalled()
    expect(addTagToBookmark).toHaveBeenCalledWith({}, 'b1', 't1')
    expect(postBookmarkUpdated).toHaveBeenCalledWith({ bookmarkId: 'b1' })
  })
  it('creates a new green tag when none matches', async () => {
    const tag = await applyNewQuickTag({} as never, 'b1', 'fresh', [
      { id: 't1', name: 'design', color: '#fff', order: 0, createdAt: Date.now() },
    ])
    expect(tag).not.toBeNull()
    expect(addTag).toHaveBeenCalledWith({}, { name: 'fresh', color: '#28F100', order: 1 })
    expect(tag!.id).toBe('new-fresh')
    expect(addTagToBookmark).toHaveBeenCalledWith({}, 'b1', 'new-fresh')
  })
  it('ignores blank input (no writes)', async () => {
    const tag = await applyNewQuickTag({} as never, 'b1', '   ', [])
    expect(tag).toBeNull()
    expect(addTag).not.toHaveBeenCalled()
    expect(addTagToBookmark).not.toHaveBeenCalled()
    expect(postBookmarkUpdated).not.toHaveBeenCalled()
  })
})
