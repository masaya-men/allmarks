import { describe, it, expect } from 'vitest'
import type { IDBPDatabase } from 'idb'
import {
  loadDataHomeAck, markDataHomeAck,
  loadLastBackupAt, recordBackup,
  loadNudgeDismissedAt, markNudgeDismissed,
  countSavedAfter, daysSince, shouldShowBackupReminder,
  BACKUP_REMINDER_NEW_THRESHOLD, BACKUP_REMINDER_DAY_GAP_MS,
} from './backup-reminder'

/** Minimal in-line-key settings store standing in for idb. */
function fakeDb(initial: Record<string, unknown> = {}): IDBPDatabase<unknown> {
  const store = new Map<string, unknown>(Object.entries(initial))
  return {
    get: async (_s: string, key: string) => store.get(key),
    put: async (_s: string, val: { key: string }) => { store.set(val.key, val) },
  } as unknown as IDBPDatabase<unknown>
}

const DAY = 24 * 60 * 60 * 1000

describe('settings round-trips', () => {
  it('data-home-ack: null then stored value', async () => {
    const db = fakeDb()
    expect(await loadDataHomeAck(db)).toBeNull()
    await markDataHomeAck(db, '2026-07-04T00:00:00.000Z')
    expect(await loadDataHomeAck(db)).toBe('2026-07-04T00:00:00.000Z')
  })
  it('last-backup-at: recordBackup then load', async () => {
    const db = fakeDb()
    expect(await loadLastBackupAt(db)).toBeNull()
    await recordBackup(db, '2026-07-01T09:00:00.000Z')
    expect(await loadLastBackupAt(db)).toBe('2026-07-01T09:00:00.000Z')
  })
  it('nudge-dismissed-at: null then stored', async () => {
    const db = fakeDb()
    expect(await loadNudgeDismissedAt(db)).toBeNull()
    await markNudgeDismissed(db, '2026-07-02T00:00:00.000Z')
    expect(await loadNudgeDismissedAt(db)).toBe('2026-07-02T00:00:00.000Z')
  })
})

describe('countSavedAfter', () => {
  const saved = ['2026-06-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', '2026-07-03T00:00:00.000Z']
  it('null baseline counts all', () => {
    expect(countSavedAfter(saved, null)).toBe(3)
  })
  it('counts only strictly-newer ISO timestamps', () => {
    expect(countSavedAfter(saved, '2026-07-01T00:00:00.000Z')).toBe(1)
  })
  it('empty list is 0', () => {
    expect(countSavedAfter([], null)).toBe(0)
  })
})

describe('daysSince', () => {
  it('floors elapsed days', () => {
    const now = Date.parse('2026-07-04T00:00:00.000Z')
    expect(daysSince(now, '2026-07-01T00:00:00.000Z')).toBe(3)
    expect(daysSince(now, '2026-07-03T23:00:00.000Z')).toBe(0)
  })
})

describe('shouldShowBackupReminder', () => {
  const now = Date.parse('2026-08-15T00:00:00.000Z')
  const ackLongAgo = '2026-07-01T00:00:00.000Z' // > 30d before now
  const base = {
    nowMs: now,
    newCount: BACKUP_REMINDER_NEW_THRESHOLD,
    lastBackupAt: null as string | null,
    dataHomeAck: ackLongAgo as string | null,
    nudgeDismissedAt: null as string | null,
  }

  it('false when fewer than the threshold of new items', () => {
    expect(shouldShowBackupReminder({ ...base, newCount: BACKUP_REMINDER_NEW_THRESHOLD - 1 })).toBe(false)
  })
  it('false when the user has never acknowledged the data-home card', () => {
    expect(shouldShowBackupReminder({ ...base, dataHomeAck: null })).toBe(false)
  })
  it('true: never backed up, ack > gap ago, enough new, no dismiss', () => {
    expect(shouldShowBackupReminder(base)).toBe(true)
  })
  it('false when the last backup is recent (< gap)', () => {
    const recent = new Date(now - 2 * DAY).toISOString()
    expect(shouldShowBackupReminder({ ...base, lastBackupAt: recent })).toBe(false)
  })
  it('true when the last backup is older than the gap', () => {
    const old = new Date(now - (BACKUP_REMINDER_DAY_GAP_MS + DAY)).toISOString()
    expect(shouldShowBackupReminder({ ...base, lastBackupAt: old })).toBe(true)
  })
  it('false when a nudge was dismissed within the gap', () => {
    const justDismissed = new Date(now - 2 * DAY).toISOString()
    expect(shouldShowBackupReminder({ ...base, nudgeDismissedAt: justDismissed })).toBe(false)
  })
})
