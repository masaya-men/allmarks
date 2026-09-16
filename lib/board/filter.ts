import type { BoardItem } from '@/lib/storage/use-board-data'
import type { BoardFilter } from './types'

function privateGatePasses(it: BoardItem, privateTagIds: ReadonlySet<string>, filter: BoardFilter): boolean {
  if (privateTagIds.size === 0) return true
  const itemPrivateTagIds = it.tags.filter((t) => privateTagIds.has(t))
  if (itemPrivateTagIds.length === 0) return true
  return filter.kind === 'tags' && itemPrivateTagIds.some((t) => filter.tagIds.includes(t))
}

export function applyFilter(
  items: ReadonlyArray<BoardItem>,
  filter: BoardFilter,
  privateTagIds: ReadonlySet<string> = new Set(),
): BoardItem[] {
  const gate = (it: BoardItem): boolean => privateGatePasses(it, privateTagIds, filter)
  switch (filter.kind) {
    case 'all':
      return items.filter((it) => !it.isDeleted && gate(it))
    case 'inbox':
      return items.filter((it) => !it.isDeleted && it.tags.length === 0 && gate(it))
    case 'archive':
      return items.filter((it) => it.isDeleted && gate(it))
    case 'dead':
      return items.filter((it) => !it.isDeleted && it.linkStatus === 'gone' && gate(it))
    case 'tags': {
      if (filter.tagIds.length === 0) return items.filter((it) => !it.isDeleted && gate(it))
      if (filter.mode === 'and') {
        return items.filter((it) =>
          !it.isDeleted && filter.tagIds.every((tid) => it.tags.includes(tid)) && gate(it),
        )
      }
      return items.filter((it) =>
        !it.isDeleted && filter.tagIds.some((tid) => it.tags.includes(tid)) && gate(it),
      )
    }
  }
}
