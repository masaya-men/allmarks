import type { IDBPDatabase } from 'idb'

/** Persisted under its own settings key (independent of BoardConfig / tag-order-
 *  mode, which own their own keys — keeping them separate avoids one
 *  overwriting another). Source of truth for the whole quick-tag-on-save
 *  feature: PiP reads it directly, the extension reads it via the save
 *  response piggyback (/save-iframe). Default ON. */
const QUICK_TAG_KEY = 'quick-tag-on-save'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type Record_ = { key: string; enabled: boolean }

export async function loadQuickTagEnabled(db: DbLike): Promise<boolean> {
  const rec = (await db.get('settings', QUICK_TAG_KEY)) as Record_ | undefined
  return typeof rec?.enabled === 'boolean' ? rec.enabled : true
}

export async function saveQuickTagEnabled(db: DbLike, enabled: boolean): Promise<void> {
  await db.put('settings', { key: QUICK_TAG_KEY, enabled } satisfies Record_)
}
