import type { IDBPDatabase } from 'idb'

/** Persisted under its own settings key (mirrors quick-tag-setting.ts). Records
 *  that the one-time "you're in fullscreen" explanation has been shown on the
 *  /save tab, so subsequent forced-tab saves stay quiet. Default: not seen. */
const FULLSCREEN_NOTICE_KEY = 'fullscreen-save-notice-seen'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type Record_ = { key: string; seen: boolean }

export async function loadFullscreenNoticeSeen(db: DbLike): Promise<boolean> {
  const rec = (await db.get('settings', FULLSCREEN_NOTICE_KEY)) as Record_ | undefined
  return rec?.seen === true
}

export async function markFullscreenNoticeSeen(db: DbLike): Promise<void> {
  await db.put('settings', { key: FULLSCREEN_NOTICE_KEY, seen: true } satisfies Record_)
}
