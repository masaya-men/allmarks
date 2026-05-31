import type { ShareCardV2 } from './types-v2'
import type { BoardItem } from '@/lib/storage/use-board-data'

/** Map a shared card to a board item for read-only moodboard rendering.
 *  Sender tags are NOT assigned here (tags: []) — they are selection
 *  candidates handled by the receiver UI, applied only on import. */
export function shareCardToBoardItem(card: ShareCardV2, index: number): BoardItem {
  return {
    bookmarkId: card.u,
    cardId: card.u,
    title: card.t,
    description: card.d,
    thumbnail: card.th,
    url: card.u,
    aspectRatio: card.a,
    gridIndex: index,
    orderIndex: index,
    cardWidth: card.cw,
    customCardWidth: true,
    isRead: false,
    isDeleted: false,
    tags: [],
    displayMode: null,
  }
}
