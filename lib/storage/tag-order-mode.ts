import type { IDBPDatabase } from 'idb'
import { DEFAULT_TAG_ORDER_MODE, type TagOrderMode } from '@/lib/board/tag-order'

/** Persisted under its own settings key (independent of BoardConfig, which is
 *  owned by BoardRoot — keeping them separate avoids one overwriting the
 *  other). */
const TAG_ORDER_KEY = 'tag-order-mode'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type Record_ = { key: string; mode: TagOrderMode }

const VALID: ReadonlySet<TagOrderMode> = new Set<TagOrderMode>(['auto-asc', 'auto-desc', 'manual'])

export async function loadTagOrderMode(db: DbLike): Promise<TagOrderMode> {
  const rec = (await db.get('settings', TAG_ORDER_KEY)) as Record_ | undefined
  return rec && VALID.has(rec.mode) ? rec.mode : DEFAULT_TAG_ORDER_MODE
}

export async function saveTagOrderMode(db: DbLike, mode: TagOrderMode): Promise<void> {
  await db.put('settings', { key: TAG_ORDER_KEY, mode } satisfies Record_)
}
