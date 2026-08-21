import type { BoardItem } from '@/lib/storage/use-board-data'
import type { BoardFilter } from './types'

function privateGatePasses(it: BoardItem, privateTagId: string | null, filter: BoardFilter): boolean {
  if (privateTagId === null) return true
  if (!it.tags.includes(privateTagId)) return true
  return filter.kind === 'tags' && filter.tagIds.includes(privateTagId)
}

export function applyFilter(
  items: ReadonlyArray<BoardItem>,
  filter: BoardFilter,
  privateTagId: string | null = null,
): BoardItem[] {
  const gate = (it: BoardItem): boolean => privateGatePasses(it, privateTagId, filter)
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
