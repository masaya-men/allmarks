import type { IDBPDatabase } from 'idb'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

/** Each fact lives under its own settings key (mirrors quick-tag-setting.ts). */
const DATA_HOME_ACK_KEY = 'data-home-ack'
const LAST_BACKUP_KEY = 'last-backup-at'
const NUDGE_DISMISSED_KEY = 'backup-nudge-dismissed-at'

type AtRecord = { key: string; at: string }

const DAY_MS = 24 * 60 * 60 * 1000

/** New saves since last backup needed before the periodic reminder appears. */
export const BACKUP_REMINDER_NEW_THRESHOLD = 15
/** Minimum quiet gap (since last backup / since last dismissal) before nudging. */
export const BACKUP_REMINDER_DAY_GAP_MS = 30 * DAY_MS

async function loadAt(db: DbLike, key: string): Promise<string | null> {
  const rec = (await db.get('settings', key)) as AtRecord | undefined
  return typeof rec?.at === 'string' ? rec.at : null
}
async function saveAt(db: DbLike, key: string, at: string): Promise<void> {
  await db.put('settings', { key, at } satisfies AtRecord)
}

export function loadDataHomeAck(db: DbLike): Promise<string | null> {
  return loadAt(db, DATA_HOME_ACK_KEY)
}
export function markDataHomeAck(db: DbLike, atIso: string): Promise<void> {
  return saveAt(db, DATA_HOME_ACK_KEY, atIso)
}
export function loadLastBackupAt(db: DbLike): Promise<string | null> {
  return loadAt(db, LAST_BACKUP_KEY)
}
export function recordBackup(db: DbLike, atIso: string): Promise<void> {
  return saveAt(db, LAST_BACKUP_KEY, atIso)
}
export function loadNudgeDismissedAt(db: DbLike): Promise<string | null> {
  return loadAt(db, NUDGE_DISMISSED_KEY)
}
export function markNudgeDismissed(db: DbLike, atIso: string): Promise<void> {
  return saveAt(db, NUDGE_DISMISSED_KEY, atIso)
}

/** Count ISO timestamps strictly newer than `sinceIso` (null baseline = all).
 *  Same-format ISO strings compare chronologically as strings. */
export function countSavedAfter(savedAts: readonly string[], sinceIso: string | null): number {
  if (sinceIso === null) return savedAts.length
  let n = 0
  for (const s of savedAts) if (s > sinceIso) n += 1
  return n
}

/** Whole days elapsed from `thenIso` to `nowMs` (floored, min 0). */
export function daysSince(nowMs: number, thenIso: string): number {
  const diff = nowMs - Date.parse(thenIso)
  return diff <= 0 ? 0 : Math.floor(diff / DAY_MS)
}

export interface ReminderParams {
  readonly nowMs: number
  readonly newCount: number
  readonly lastBackupAt: string | null
  readonly dataHomeAck: string | null
  readonly nudgeDismissedAt: string | null
  readonly newThreshold?: number
  readonly dayGapMs?: number
}

/** Humane periodic reminder gate. True only when the user has acknowledged the
 *  data-home card, enough new saves have piled up unbacked, AND enough quiet
 *  time has passed since both the last backup (or the ack, if never backed up)
 *  and the last dismissal. Diligent backers-up never see it. */
export function shouldShowBackupReminder(p: ReminderParams): boolean {
  const threshold = p.newThreshold ?? BACKUP_REMINDER_NEW_THRESHOLD
  const gap = p.dayGapMs ?? BACKUP_REMINDER_DAY_GAP_MS
  if (p.dataHomeAck === null) return false
  if (p.newCount < threshold) return false
  const baseline = p.lastBackupAt ?? p.dataHomeAck
  if (p.nowMs - Date.parse(baseline) < gap) return false
  if (p.nudgeDismissedAt !== null && p.nowMs - Date.parse(p.nudgeDismissedAt) < gap) return false
  return true
}
