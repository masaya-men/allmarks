import type { BoardItem } from '@/lib/storage/use-board-data'
import type { BoardFilter } from './types'

export function applyFilter(items: ReadonlyArray<BoardItem>, filter: BoardFilter): BoardItem[] {
  switch (filter.kind) {
    case 'all':
      return items.filter((it) => !it.isDeleted)
    case 'inbox':
      return items.filter((it) => !it.isDeleted && it.tags.length === 0)
    case 'archive':
      return items.filter((it) => it.isDeleted)
    case 'dead':
      return items.filter((it) => !it.isDeleted && it.linkStatus === 'gone')
    case 'tags': {
      if (filter.tagIds.length === 0) return items.filter((it) => !it.isDeleted)
      if (filter.mode === 'and') {
        return items.filter((it) =>
          !it.isDeleted && filter.tagIds.every((tid) => it.tags.includes(tid)),
        )
      }
      return items.filter((it) =>
        !it.isDeleted && filter.tagIds.some((tid) => it.tags.includes(tid)),
      )
    }
  }
}
