# Backup Legal Safeguard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an honest first-run data-home card, a SETTINGS "last backup" line, a humane periodic backup reminder, and a self-backup-responsibility clause in the Terms — so AllMarks' local-only design is both legally covered and kind to users.

**Architecture:** All decision logic lives in one tested pure/storage module (`lib/storage/backup-reminder.ts`). Three small presentational components (data-home card, backup-status line, backup reminder) are wired from `BoardRoot` after onboarding finishes. EXPORT is refactored into one shared helper so both the SETTINGS button and the reminder record the backup timestamp. Terms + UI copy are localized across all 15 languages.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Vanilla CSS + `.module.css`, IndexedDB via `idb`, vitest + @testing-library/react, i18n via `useI18n()` + `messages/*.json`.

## Global Constraints

- TypeScript `strict: true`; **no `any`** (use `unknown` + guards); **explicit return types**; **no `console.log`** in product code.
- **Vanilla CSS + `.module.css` only** (no Tailwind). z-index only via `BOARD_Z_INDEX` in `lib/board/constants.ts` (no magic numbers).
- **15 locales, all in sync:** `ar de en es fr it ja ko nl pt ru th tr vi zh`. Parity tests `messages/all-keys-parity.test.ts` + `messages/board-onboarding-parity.test.ts` MUST stay green.
- **UI chrome buttons are English literals** in the component (`GOT IT`, `EXPORT`, `LATER`) — matching existing `'EXPORT'`/`'IMPORT'` in BackupButton. **Body/caption text is localized** via i18n keys.
- **Copy is dry/factual, tutorial-voice** (like `board.onboarding.*`). No poetic phrasing. `AllMarks` as subject, です/ます, `利用者` in Terms (never `当方`).
- **Pure decision functions take injected time** (`nowMs: number`) — never call `Date.now()` inside them.
- **Default board must stay byte-identical**: a returning user who already acknowledged and has a recent backup sees NOTHING new rendered.
- **Legal copy is a draft** — the handoff must tell the user to get a lawyer/expert to review the Terms clause before relying on it.
- Verify gate per the final task: `rtk tsc` (0 errors) → `rtk vitest run` (green) → `rtk pnpm build` (check `out/`) → deploy per CLAUDE.md.

---

### Task 1: Backup-reminder storage + decision module (pure)

**Files:**
- Create: `lib/storage/backup-reminder.ts`
- Test: `lib/storage/backup-reminder.test.ts`

**Interfaces:**
- Consumes: `idb` `IDBPDatabase`. Settings store uses in-line key `'key'` (same pattern as `lib/storage/quick-tag-setting.ts`).
- Produces (later tasks rely on these exact signatures):
  - `loadDataHomeAck(db): Promise<string | null>`
  - `markDataHomeAck(db, atIso: string): Promise<void>`
  - `loadLastBackupAt(db): Promise<string | null>`
  - `recordBackup(db, atIso: string): Promise<void>`
  - `loadNudgeDismissedAt(db): Promise<string | null>`
  - `markNudgeDismissed(db, atIso: string): Promise<void>`
  - `countSavedAfter(savedAts: readonly string[], sinceIso: string | null): number`
  - `daysSince(nowMs: number, thenIso: string): number`
  - `shouldShowBackupReminder(p: ReminderParams): boolean`
  - Constants `BACKUP_REMINDER_NEW_THRESHOLD = 15`, `BACKUP_REMINDER_DAY_GAP_MS`.

- [ ] **Step 1: Write the failing test**

Create `lib/storage/backup-reminder.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk vitest run lib/storage/backup-reminder.test.ts`
Expected: FAIL — `Failed to resolve import "./backup-reminder"` / functions undefined.

- [ ] **Step 3: Write the module**

Create `lib/storage/backup-reminder.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `rtk vitest run lib/storage/backup-reminder.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/storage/backup-reminder.ts lib/storage/backup-reminder.test.ts
rtk git commit -m "feat: backup-reminder storage + humane reminder decision (s161 T1)"
```

---

### Task 2: i18n — Terms clause (A) + UI strings (B/C/D) across 15 locales

**Files:**
- Modify: `messages/en.json`, `messages/ja.json`, and the other 13 (`ar de es fr it ko nl pt ru th tr vi zh`).
- Test: `messages/all-keys-parity.test.ts` (existing — must pass unmodified).

**Interfaces:**
- Produces i18n keys consumed by Tasks 4–6:
  - `board.dataHome.title`, `board.dataHome.body`
  - `board.backupStatus.never`, `board.backupStatus.today`, `board.backupStatus.daysAgo` (has `{days}`)
  - `board.backupReminder.body` (has `{n}`), `board.backupReminder.bodyFirst` (has `{n}`)
- Extends existing `pages.terms.responsibilities.body`.

- [ ] **Step 1: Extend the Terms clause + add UI keys in en.json**

In `messages/en.json`, **append** to `pages.terms.responsibilities.body` (keep the existing sentence, add after it):

> ` Because your data is stored only in your browser on this device and no copy is kept on a server, keeping your own backups is your responsibility: use EXPORT in Settings to save a copy regularly, especially before you change devices, clear your browser data, or reset AllMarks. Data lost through browser data clearing, device loss or failure, software updates, or any other cause cannot be recovered.`

Add these keys under `board` (place near `board.backup.*`):

```json
"dataHome": {
  "title": "Your data is saved on this device only.",
  "body": "All your AllMarks data is stored in this browser, on this device. There is no account, and nothing is saved on a server. To keep a copy, use EXPORT in Settings — do this before you change devices or clear your browser data."
},
"backupStatus": {
  "never": "Last backup: never",
  "today": "Last backup: today",
  "daysAgo": "Last backup: {days} days ago"
},
"backupReminder": {
  "body": "You've added {n} bookmarks since your last backup. Save a copy with EXPORT.",
  "bodyFirst": "You've saved {n} bookmarks. Save a copy with EXPORT to keep them."
}
```

- [ ] **Step 2: Mirror into ja.json (verbatim, from the approved spec)**

`pages.terms.responsibilities.body` append (after the existing JA sentence):

> `データはこの端末のブラウザ内にのみ保存され、サーバーには保存されないため、控えを保つ責任は利用者が負います。設定内の EXPORT 機能で定期的に控えを保存してください（特に端末を変えるとき、ブラウザのデータを消すとき、AllMarks をリセットするとき）。ブラウザのデータ消去・端末の紛失や故障・ソフトウェア更新・その他の原因で失われたデータは復元できません。`

`board` keys:

```json
"dataHome": {
  "title": "データはこの端末の中だけに保存されます。",
  "body": "AllMarks のデータはすべて、この端末のブラウザ内に保存されます。アカウントは不要で、サーバーには保存されません。控えを取るには、SETTINGS の EXPORT を使ってください。端末を変えるときや、ブラウザのデータを消す前に、控えを取ってください。"
},
"backupStatus": {
  "never": "最終バックアップ：まだ",
  "today": "最終バックアップ：今日",
  "daysAgo": "最終バックアップ：{days} 日前"
},
"backupReminder": {
  "body": "前回のバックアップから {n} 件増えました。EXPORT で控えを保存しておきましょう。",
  "bodyFirst": "{n} 件たまりました。EXPORT で控えを保存しておきましょう。"
}
```

- [ ] **Step 3: Translate into the other 13 locales**

For each of `ar de es fr it ko nl pt ru th tr vi zh`, add the SAME key structure with faithful translations that match each file's existing tone (dry/factual, matching its `board.onboarding.*` voice). Keep `{days}` / `{n}` placeholders intact. Do not localize product nouns rendered as English chrome (`EXPORT`, `AllMarks`, `SETTINGS`). Append the Terms sentence to that locale's `pages.terms.responsibilities.body`.

> Tip: this is the right place to dispatch a translation subagent per locale. The parity test in Step 4 is the gate.

- [ ] **Step 4: Run parity + i18n tests to verify all keys present in all locales**

Run: `rtk vitest run messages/`
Expected: PASS — `all-keys-parity.test.ts` and `board-onboarding-parity.test.ts` green (no missing/extra keys across the 15 files).

- [ ] **Step 5: Commit**

```bash
rtk git add messages/
rtk git commit -m "i18n: terms self-backup clause + data-home/status/reminder strings, 15 langs (s161 T2)"
```

---

### Task 3: Shared EXPORT helper that records the backup timestamp

**Files:**
- Create: `lib/board/export-backup.ts`
- Modify: `components/board/BackupButton.tsx` (`onExport` uses the helper)
- Test: `lib/board/export-backup.test.ts`

**Interfaces:**
- Consumes: `exportAllStores` from `lib/storage/backup`, `recordBackup` from Task 1, `initDB` from `lib/storage/indexeddb`.
- Produces: `exportBackupFile(db, nowIso: string, download?: Downloader): Promise<number>` (returns bookmark count); `type Downloader = (blob: Blob, filename: string) => void`.

- [ ] **Step 1: Write the failing test**

Create `lib/board/export-backup.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { IDBPDatabase } from 'idb'
import { exportBackupFile } from './export-backup'
import { loadLastBackupAt } from '@/lib/storage/backup-reminder'

/** Fake db: bookmarks getAll + settings put/get (in-line key). */
function fakeDb(bookmarks: unknown[]): IDBPDatabase<unknown> {
  const settings = new Map<string, unknown>()
  const names = ['bookmarks', 'settings']
  return {
    objectStoreNames: names as unknown as DOMStringList,
    getAll: async (s: string) => (s === 'bookmarks' ? bookmarks : []),
    get: async (_s: string, key: string) => settings.get(key),
    put: async (_s: string, val: { key: string }) => { settings.set(val.key, val) },
  } as unknown as IDBPDatabase<unknown>
}

describe('exportBackupFile', () => {
  it('downloads a json file and records the backup timestamp', async () => {
    const db = fakeDb([{ id: 'b1' }, { id: 'b2' }])
    const download = vi.fn<[Blob, string], void>()
    const count = await exportBackupFile(db, '2026-07-04T10:00:00.000Z', download)

    expect(count).toBe(2)
    expect(download).toHaveBeenCalledTimes(1)
    expect(download.mock.calls[0][1]).toBe('allmarks-backup-2026-07-04.json')
    expect(await loadLastBackupAt(db)).toBe('2026-07-04T10:00:00.000Z')
  })
})
```

Note: `objectStoreNames` is read by `exportAllStores` via `Array.from(db.objectStoreNames)`; a plain array is iterable so `Array.from` works.

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk vitest run lib/board/export-backup.test.ts`
Expected: FAIL — cannot resolve `./export-backup`.

- [ ] **Step 3: Write the helper**

Create `lib/board/export-backup.ts`:

```ts
import type { IDBPDatabase } from 'idb'
import { exportAllStores } from '@/lib/storage/backup'
import { recordBackup } from '@/lib/storage/backup-reminder'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

export type Downloader = (blob: Blob, filename: string) => void

/** Default browser download via a temporary object URL (identical to the prior
 *  inline BackupButton logic: one createObjectURL + one revokeObjectURL). */
const domDownload: Downloader = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Dump every IDB store to a downloaded JSON file, then record the backup time
 *  so the SETTINGS status line and the periodic reminder stay accurate.
 *  Returns the number of bookmarks exported. Throws on failure (caller alerts). */
export async function exportBackupFile(
  db: DbLike, nowIso: string, download: Downloader = domDownload,
): Promise<number> {
  const dump = await exportAllStores(db)
  const json = JSON.stringify(dump, null, 2)
  download(new Blob([json], { type: 'application/json' }), `allmarks-backup-${nowIso.slice(0, 10)}.json`)
  await recordBackup(db, nowIso)
  return dump.bookmarks.length
}
```

- [ ] **Step 4: Rewire BackupButton.onExport to the helper**

In `components/board/BackupButton.tsx`, replace the body of `onExport` (the inline blob/anchor block) with a call to the helper. Add the import and keep the busy state + alert:

```tsx
// add near the other imports:
import { initDB } from '@/lib/storage/indexeddb'
import { exportBackupFile } from '@/lib/board/export-backup'
```

```tsx
const onExport = useCallback(async (): Promise<void> => {
  setBusy('export')
  try {
    const db = await initDB()
    await exportBackupFile(db, new Date().toISOString())
  } catch {
    // Never fail silently — a failed export must tell the user.
    window.alert(t('board.backup.exportFailed'))
  } finally {
    setBusy(null)
  }
}, [t])
```

(`initDB` may already be imported in this file — if so, don't duplicate the import.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `rtk vitest run lib/board/export-backup.test.ts components/board/BackupButton.test.tsx`
Expected: PASS — new helper test green AND the existing BackupButton EXPORT test ("URL.createObjectURL called once") still green (domDownload preserves that behavior).

- [ ] **Step 6: Commit**

```bash
rtk git add lib/board/export-backup.ts lib/board/export-backup.test.ts components/board/BackupButton.tsx
rtk git commit -m "feat: shared exportBackupFile helper records last-backup time (s161 T3)"
```

---

### Task 4: SETTINGS "last backup" status line (C)

**Files:**
- Create: `components/board/BackupStatus.tsx`, `components/board/BackupStatus.module.css`
- Test: `components/board/BackupStatus.test.tsx`
- Modify: `components/board/ExtensionEntry.tsx` (render `<BackupStatus />` inside `backupSection`)

**Interfaces:**
- Consumes: `loadLastBackupAt` + `daysSince` (Task 1), `initDB`, `useI18n`, i18n keys `board.backupStatus.*` (Task 2).
- Produces: `BackupStatusView({ lastBackupAt, nowMs })` (pure, exported for tests) and default `BackupStatus` (self-loading container).

- [ ] **Step 1: Write the failing test**

Create `components/board/BackupStatus.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BackupStatusView } from './BackupStatus'

const NOW = Date.parse('2026-07-04T00:00:00.000Z')

describe('BackupStatusView', () => {
  it('shows "never" when there is no backup', () => {
    render(<BackupStatusView lastBackupAt={null} nowMs={NOW} />)
    expect(screen.getByTestId('backup-status').textContent).toContain('never')
  })
  it('shows "today" when the backup was under a day ago', () => {
    render(<BackupStatusView lastBackupAt="2026-07-03T18:00:00.000Z" nowMs={NOW} />)
    expect(screen.getByTestId('backup-status').textContent).toContain('today')
  })
  it('shows the day count when older', () => {
    render(<BackupStatusView lastBackupAt="2026-07-01T00:00:00.000Z" nowMs={NOW} />)
    expect(screen.getByTestId('backup-status').textContent).toContain('3')
  })
})
```

(No `I18nProvider` → `useI18n` falls back to baked English `messages/en.json`, so the English words "never"/"today"/"3" appear.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk vitest run components/board/BackupStatus.test.tsx`
Expected: FAIL — cannot resolve `./BackupStatus`.

- [ ] **Step 3: Write the component**

Create `components/board/BackupStatus.module.css`:

```css
.status {
  font-size: 12px;
  letter-spacing: 0.02em;
  opacity: 0.62;
  margin-top: 6px;
}
```

Create `components/board/BackupStatus.tsx`:

```tsx
'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { initDB } from '@/lib/storage/indexeddb'
import { loadLastBackupAt, daysSince } from '@/lib/storage/backup-reminder'
import styles from './BackupStatus.module.css'

export interface BackupStatusViewProps {
  readonly lastBackupAt: string | null
  readonly nowMs: number
}

/** Pure presentational line — testable without IDB. */
export function BackupStatusView({ lastBackupAt, nowMs }: BackupStatusViewProps): ReactElement {
  const { t } = useI18n()
  let text: string
  if (lastBackupAt === null) {
    text = t('board.backupStatus.never')
  } else {
    const d = daysSince(nowMs, lastBackupAt)
    text = d === 0 ? t('board.backupStatus.today') : t('board.backupStatus.daysAgo').replace('{days}', String(d))
  }
  return <p className={styles.status} data-testid="backup-status">{text}</p>
}

/** Self-loading container mounted in the SETTINGS drawer. */
export function BackupStatus(): ReactElement | null {
  const [at, setAt] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const db = await initDB()
        const v = await loadLastBackupAt(db)
        if (alive) setAt(v)
      } catch {
        if (alive) setAt(null)
      }
    })()
    return () => { alive = false }
  }, [])
  if (at === undefined) return null // don't flash before the first read
  return <BackupStatusView lastBackupAt={at} nowMs={Date.now()} />
}
```

- [ ] **Step 4: Render it in the SETTINGS drawer**

In `components/board/ExtensionEntry.tsx`, import and render `<BackupStatus />` just below the existing `<BackupButton />` row inside `backupSection` (around line 339–344):

```tsx
// import (near the BackupButton import):
import { BackupStatus } from './BackupStatus'
```

```tsx
<div className={styles.backupSection} data-testid="backup-section">
  <p className={styles.backupCaption}>{t('board.backup.caption')}</p>
  <div className={styles.backupRow}>
    <BackupButton buttonClassName={styles.backupBtn} />
  </div>
  <BackupStatus />
</div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `rtk vitest run components/board/BackupStatus.test.tsx`
Expected: PASS (never/today/day-count).

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/BackupStatus.tsx components/board/BackupStatus.module.css components/board/BackupStatus.test.tsx components/board/ExtensionEntry.tsx
rtk git commit -m "feat: SETTINGS last-backup status line (s161 T4)"
```

---

### Task 5: First-run data-home card (B)

**Files:**
- Create: `components/board/DataHomeCard.tsx`, `components/board/DataHomeCard.module.css`
- Test: `components/board/DataHomeCard.test.tsx`
- Modify: `lib/board/constants.ts` (add `DATA_HOME` z-index)

**Interfaces:**
- Consumes: `useI18n`, keys `board.dataHome.title` / `board.dataHome.body`, `BOARD_Z_INDEX.DATA_HOME`.
- Produces: `DataHomeCard({ onDismiss: () => void })`.

- [ ] **Step 1: Add the z-index constant**

In `lib/board/constants.ts`, inside `BOARD_Z_INDEX` (near `MODAL_OVERLAY: 200`), add:

```ts
  DATA_HOME: 205,       // first-run "your data lives here" card (after onboarding, below drawer 401)
  BACKUP_REMINDER: 195, // periodic backup nudge toast (below DATA_HOME + drawer)
```

- [ ] **Step 2: Write the failing test**

Create `components/board/DataHomeCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataHomeCard } from './DataHomeCard'

describe('DataHomeCard', () => {
  it('renders the title + body and GOT IT dismisses', () => {
    const onDismiss = vi.fn()
    render(<DataHomeCard onDismiss={onDismiss} />)
    // English fallback text present:
    expect(screen.getByText(/this device only/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `rtk vitest run components/board/DataHomeCard.test.tsx`
Expected: FAIL — cannot resolve `./DataHomeCard`.

- [ ] **Step 4: Write the component + styles**

Create `components/board/DataHomeCard.module.css` (quiet, glassy, board shows through; match the app's black/white world — do NOT copy exact numbers blindly, keep it small and calm):

```css
.backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 8, 8, 0.42);
  backdrop-filter: blur(3px);
  padding: 24px;
}
.card {
  width: min(420px, 100%);
  background: rgba(20, 20, 20, 0.86);
  color: #f4f4f4;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 18px;
  padding: 26px 26px 22px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
}
.title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.01em;
  margin: 0 0 12px;
}
.body {
  font-size: 14px;
  line-height: 1.7;
  opacity: 0.86;
  margin: 0 0 22px;
}
.actions { display: flex; justify-content: flex-end; }
.gotIt {
  font-size: 13px;
  letter-spacing: 0.08em;
  padding: 9px 20px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: transparent;
  color: #f4f4f4;
  cursor: pointer;
}
.gotIt:hover { background: rgba(255, 255, 255, 0.08); }
```

Create `components/board/DataHomeCard.tsx`:

```tsx
'use client'

import { type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './DataHomeCard.module.css'

export interface DataHomeCardProps {
  /** Records the acknowledgment (timestamp) and hides the card, for good. */
  readonly onDismiss: () => void
}

/** One-time, dry, tutorial-voice notice shown after onboarding: your data is
 *  local to this device; keep a copy with EXPORT. Not a warning, not poetic. */
export function DataHomeCard({ onDismiss }: DataHomeCardProps): ReactElement {
  const { t } = useI18n()
  return (
    <div className={styles.backdrop} style={{ zIndex: BOARD_Z_INDEX.DATA_HOME }}
         role="dialog" aria-modal="true" aria-label="AllMarks data notice">
      <div className={styles.card}>
        <p className={styles.title}>{t('board.dataHome.title')}</p>
        <p className={styles.body}>{t('board.dataHome.body')}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.gotIt} onClick={onDismiss} data-testid="data-home-gotit">
            GOT IT
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `rtk vitest run components/board/DataHomeCard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/DataHomeCard.tsx components/board/DataHomeCard.module.css components/board/DataHomeCard.test.tsx lib/board/constants.ts
rtk git commit -m "feat: first-run data-home card (s161 T5)"
```

---

### Task 6: Periodic backup reminder toast (D)

**Files:**
- Create: `components/board/BackupReminder.tsx`, `components/board/BackupReminder.module.css`
- Test: `components/board/BackupReminder.test.tsx`

**Interfaces:**
- Consumes: `useI18n`, keys `board.backupReminder.body` / `board.backupReminder.bodyFirst`, `BOARD_Z_INDEX.BACKUP_REMINDER` (added in Task 5).
- Produces: `BackupReminder({ newCount, everBackedUp, onExport, onLater })`.

- [ ] **Step 1: Write the failing test**

Create `components/board/BackupReminder.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BackupReminder } from './BackupReminder'

describe('BackupReminder', () => {
  it('shows the count and fires EXPORT / LATER callbacks', () => {
    const onExport = vi.fn()
    const onLater = vi.fn()
    render(<BackupReminder newCount={22} everBackedUp onExport={onExport} onLater={onLater} />)
    expect(screen.getByTestId('backup-reminder').textContent).toContain('22')
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    fireEvent.click(screen.getByRole('button', { name: /later/i }))
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onLater).toHaveBeenCalledTimes(1)
  })
  it('uses the first-time copy when never backed up', () => {
    render(<BackupReminder newCount={30} everBackedUp={false} onExport={vi.fn()} onLater={vi.fn()} />)
    // en bodyFirst: "You've saved 30 bookmarks..."
    expect(screen.getByTestId('backup-reminder').textContent).toContain('30')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk vitest run components/board/BackupReminder.test.tsx`
Expected: FAIL — cannot resolve `./BackupReminder`.

- [ ] **Step 3: Write the component + styles**

Create `components/board/BackupReminder.module.css`:

```css
.toast {
  position: fixed;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  width: min(440px, calc(100% - 32px));
  display: flex;
  align-items: center;
  gap: 14px;
  background: rgba(20, 20, 20, 0.9);
  color: #f2f2f2;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
}
.body { flex: 1; font-size: 13px; line-height: 1.5; margin: 0; opacity: 0.9; }
.actions { display: flex; gap: 8px; flex-shrink: 0; }
.btn {
  font-size: 12px;
  letter-spacing: 0.06em;
  padding: 7px 12px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: transparent;
  color: #f2f2f2;
  cursor: pointer;
}
.btn:hover { background: rgba(255, 255, 255, 0.08); }
.primary { border-color: rgba(40, 241, 0, 0.55); }
```

Create `components/board/BackupReminder.tsx`:

```tsx
'use client'

import { type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './BackupReminder.module.css'

export interface BackupReminderProps {
  readonly newCount: number
  readonly everBackedUp: boolean
  readonly onExport: () => void
  readonly onLater: () => void
}

/** Gentle, dismissible periodic nudge. Shown only when the tested gate in
 *  backup-reminder.ts says there is genuinely unbacked value at risk. */
export function BackupReminder({ newCount, everBackedUp, onExport, onLater }: BackupReminderProps): ReactElement {
  const { t } = useI18n()
  const key = everBackedUp ? 'board.backupReminder.body' : 'board.backupReminder.bodyFirst'
  const text = t(key).replace('{n}', String(newCount))
  return (
    <div className={styles.toast} style={{ zIndex: BOARD_Z_INDEX.BACKUP_REMINDER }}
         role="status" data-testid="backup-reminder">
      <p className={styles.body}>{text}</p>
      <div className={styles.actions}>
        <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={onExport}>EXPORT</button>
        <button type="button" className={styles.btn} onClick={onLater}>LATER</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `rtk vitest run components/board/BackupReminder.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/BackupReminder.tsx components/board/BackupReminder.module.css components/board/BackupReminder.test.tsx
rtk git commit -m "feat: periodic backup reminder toast (s161 T6)"
```

---

### Task 7: Wire B + D into BoardRoot, then full verify

**Files:**
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: everything above — `loadDataHomeAck`, `markDataHomeAck`, `loadLastBackupAt`, `loadNudgeDismissedAt`, `markNudgeDismissed`, `countSavedAfter`, `shouldShowBackupReminder` (Task 1); `exportBackupFile` (Task 3); `DataHomeCard` (Task 5); `BackupReminder` (Task 6).

This task is UI-integration wiring; it is verified by tsc + the full suite + build + manual smoke rather than a new unit test (the decision logic is already unit-tested in Task 1, and BoardRoot has no unit test harness).

- [ ] **Step 1: Add imports**

In `components/board/BoardRoot.tsx` (near the other component/lib imports):

```tsx
import { DataHomeCard } from './DataHomeCard'
import { BackupReminder } from './BackupReminder'
import { exportBackupFile } from '@/lib/board/export-backup'
import {
  loadDataHomeAck, markDataHomeAck, loadLastBackupAt,
  loadNudgeDismissedAt, markNudgeDismissed,
  countSavedAfter, shouldShowBackupReminder,
} from '@/lib/storage/backup-reminder'
```

- [ ] **Step 2: Add state + a ref to the latest items**

Near the existing `const [showOnboarding, setShowOnboarding] = useState<boolean>(false)` (~line 380):

```tsx
const [showDataHomeCard, setShowDataHomeCard] = useState<boolean>(false)
const [backupReminder, setBackupReminder] = useState<{ newCount: number; everBackedUp: boolean } | null>(null)
// One decision per board load; refs avoid re-firing on every items change.
const backupUiCheckedRef = useRef(false)
const itemsRef = useRef(items)
itemsRef.current = items
```

(`useRef`/`useState` are already imported in this file.)

- [ ] **Step 3: Add the decision effect**

Add after the effect(s) that set up onboarding (anywhere among the board effects). It runs once the board is loaded AND onboarding is not showing:

```tsx
// Backup safety UI: after onboarding (or immediately for returning users),
// show the one-time data-home card, else maybe the periodic reminder.
useEffect(() => {
  if (loading || showOnboarding || backupUiCheckedRef.current) return
  backupUiCheckedRef.current = true
  let alive = true
  void (async () => {
    const db = onboardingDbRef.current ?? ((await initDB()) as unknown as DbLike)
    const ack = await loadDataHomeAck(db)
    if (!alive) return
    if (ack === null) { setShowDataHomeCard(true); return }
    const lastBackupAt = await loadLastBackupAt(db)
    const nudgeDismissedAt = await loadNudgeDismissedAt(db)
    if (!alive) return
    const savedAts = itemsRef.current.map((i) => i.savedAt)
    const newCount = countSavedAfter(savedAts, lastBackupAt)
    const show = shouldShowBackupReminder({
      nowMs: Date.now(), newCount, lastBackupAt, dataHomeAck: ack, nudgeDismissedAt,
    })
    if (alive && show) setBackupReminder({ newCount, everBackedUp: lastBackupAt !== null })
  })()
  return () => { alive = false }
}, [loading, showOnboarding])
```

> Note: `DbLike` is the alias already used in this file for `initDB()` casts (see the existing `const db = (await initDB()) as unknown as DbLike` usage around line 767). Reuse it. `item.savedAt` exists on every bookmark (see `lib/storage/indexeddb.ts`).

- [ ] **Step 4: Add the handlers**

```tsx
const onDataHomeGotIt = useCallback((): void => {
  setShowDataHomeCard(false)
  void (async () => {
    const db = (await initDB()) as unknown as DbLike
    await markDataHomeAck(db, new Date().toISOString())
  })()
}, [])

const onReminderExport = useCallback((): void => {
  setBackupReminder(null)
  void (async () => {
    try {
      const db = (await initDB()) as unknown as DbLike
      await exportBackupFile(db, new Date().toISOString())
    } catch {
      window.alert(t('board.backup.exportFailed'))
    }
  })()
}, [t])

const onReminderLater = useCallback((): void => {
  setBackupReminder(null)
  void (async () => {
    const db = (await initDB()) as unknown as DbLike
    await markNudgeDismissed(db, new Date().toISOString())
  })()
}, [])
```

> `t` comes from the existing `useI18n()` in this component (used elsewhere in BoardRoot). If BoardRoot does not already destructure `t`, add it where it reads i18n; grep for `useI18n(` in this file first. `useCallback` is already imported.

- [ ] **Step 5: Render the card + toast**

Immediately AFTER the `<OnboardingController ... />` conditional block (~line 2560), add:

```tsx
{!loading && !showOnboarding && showDataHomeCard && (
  <DataHomeCard onDismiss={onDataHomeGotIt} />
)}
{!loading && !showOnboarding && !showDataHomeCard && backupReminder && (
  <BackupReminder
    newCount={backupReminder.newCount}
    everBackedUp={backupReminder.everBackedUp}
    onExport={onReminderExport}
    onLater={onReminderLater}
  />
)}
```

- [ ] **Step 6: Typecheck**

Run: `rtk tsc`
Expected: 0 errors. (Fix any type mismatch — e.g. confirm `t` is in scope, `DbLike` alias name matches the file's existing one, `items` element type exposes `savedAt`.)

- [ ] **Step 7: Full test suite**

Run: `rtk vitest run`
Expected: green (known-flaky `tests/lib/channel.test.ts` may need a re-run per CURRENT_GOAL; do NOT run a dev server alongside vitest).

- [ ] **Step 8: Production build**

Run: `rtk pnpm build`
Expected: success; `out/` regenerated (static export — `rtk next build` is NOT sufficient per memory `reference_pnpm_build_required`).

- [ ] **Step 9: Commit**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat: wire data-home card + periodic backup reminder into board (s161 T7)"
```

- [ ] **Step 10: Manual smoke (real device) BEFORE deploy** — memory `feedback_verify_before_claiming`, s159 lesson

Use a fresh profile / cleared site data on `localhost` (or a dev build):
1. First visit → onboarding runs → on finish, the **data-home card** appears once; `GOT IT` dismisses it and it never returns on reload.
2. A **returning user with data but no ack** (simulate by clearing only the `data-home-ack` settings row, or fresh) sees the card once, not during onboarding.
3. SETTINGS drawer shows **`Last backup: never`**, then after clicking EXPORT shows **`Last backup: today`**.
4. **default board byte-identical**: an acknowledged user with a recent backup sees no card and no toast.
5. (Reminder path is time-gated 30d/15-new; verify via the Task-1 unit tests rather than waiting — do not fake the clock in prod.)

Note: Playwright cannot click real board cards (pointer-capture reorder rejects synthetic pointers — memory `reference_board_card_click_pointer_capture`); the card/toast buttons are plain buttons and CAN be Playwright-clicked, but onboarding gestures need manual steps.

- [ ] **Step 11: Deploy** (per CLAUDE.md)

```bash
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

Tell the user to hard-reload `https://allmarks.app`.

---

## Self-Review (author checklist — completed)

**Spec coverage:**
- A (Terms clause) → Task 2 Steps 1–2 (+13 langs Step 3). ✅
- B (first-run card) → Task 5 + wiring Task 7. ✅
- C (SETTINGS last-backup line) → Task 4. ✅
- D (periodic reminder + humane gate) → Task 1 (`shouldShowBackupReminder`) + Task 6 + wiring Task 7. ✅
- EXPORT records last-backup → Task 3 (shared helper) used by BackupButton + reminder. ✅
- Data model (`data-home-ack` / `last-backup-at` / `backup-nudge-dismissed-at`) → Task 1. ✅ (timestamp-only `last-backup-at`, per spec §5 update; new count via `savedAt` compare.)
- i18n 15 langs + parity → Task 2. ✅
- Non-goals (E, sync) → out of scope; recorded in spec + IDEAS.md. ✅

**Placeholder scan:** No TBD/TODO; every code step shows full code. Task 2 Step 3 (13 translations) is genuine work with the parity test as its gate, EN/JA given verbatim. ✅

**Type consistency:** `exportBackupFile(db, nowIso, download?)`, `recordBackup(db, atIso)`, `shouldShowBackupReminder({nowMs,newCount,lastBackupAt,dataHomeAck,nudgeDismissedAt})`, `countSavedAfter(savedAts, sinceIso)`, `daysSince(nowMs, thenIso)`, `BackupStatusView({lastBackupAt,nowMs})`, `DataHomeCard({onDismiss})`, `BackupReminder({newCount,everBackedUp,onExport,onLater})` — names/params identical across tasks. ✅
