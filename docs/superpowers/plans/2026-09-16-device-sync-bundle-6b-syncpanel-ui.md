# 端末間同期 束6②(SyncPanel UI本体) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the "Googleで接続" first-connect flow, connected-state status display (account + last-synced + manual "今すぐ同期"), and the error/mass-delete surfaces into `SyncPanel.tsx`, plus a headless background-sync mount so an already-connected device keeps syncing without the SETTINGS drawer open.

**Architecture:** `lib/sync/engine.ts`'s `runSyncCycle`/`connectSync` already do pull→merge→push with safety valves (束4, merged, zero callers). This plan adds three small pure helper modules (error classification, JWT email decode, relative-time formatting), teaches `runSyncCycle`/`connectSync` to persist their outcome (`lastIssue`, `connectedEmail`) into `sync-store.ts` so it survives a reload, adds one new confirm dialog, rewrites `SyncPanel.tsx` as a small state machine over that persisted status, and adds a headless `SyncEngineRunner` mounted unconditionally in `BoardRoot.tsx` to drive the existing `sync-controller.ts` (start/flushNow) for an already-connected device.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Vanilla CSS Modules, `idb` (IndexedDB), Vitest + Testing Library, `fake-indexeddb`.

**Spec:** `docs/private/2026-09-02-device-sync-design.md` (§4.1 SyncPanel責務, §7.1 初回接続, §7.2-7.3 pull/pushタイミング, §8 安全弁・エラー処理). Copy/screens approved by the user in-conversation on 2026-09-16 (see below — this plan is the record of that approval).

## Global Constraints

- `strict: true` in tsconfig; no `any`; all i18n strings go through `t('...')`, never hard-coded JA/EN in JSX.
- Framer Motion is banned; no new animation library. GSAP not needed for this bundle (no drag/timeline work).
- Every new i18n key must be added to **all 15** `messages/*.json` files (en + ja get the real approved copy; the other 13 get the English copy verbatim — this repo's established pattern, confirmed via `git show 466414ee --stat`).
- `rtk` prefix on every shell command per the user's global CLAUDE.md. `--no-verify` is forbidden. Use plain `npx vitest`/`npx playwright`, not `rtk npx` (known broken in this repo, per memory `reference_playwright_output_and_rtk_npx`).
- Do **not** touch `lib/sync/merge.ts`, `lib/sync/drive-adapter.ts`, `lib/sync/gauth-types.ts`, `functions/api/gauth/*`, or anything under `lib/board/license-*` — those are shipped and reviewed in earlier bundles; this bundle only adds new files + extends `engine.ts`/`sync-store.ts`/`SyncPanel.tsx`/`BoardRoot.tsx`.
- Do **not** wire `sync-controller.ts`'s `markDirty()` into any bookmark/tag/card/board-config write path in this bundle. That is the deferred "real-time sync" follow-up recorded in `docs/CURRENT_GOAL.md` under "★検討事項" — out of scope here, tracked separately, not silently dropped.
- Do **not** build any vault-conflict UI or touch `vaultConflict`/`vaultRecordsDiffer` — that is bundle ③, explicitly deferred (see `engine.ts` comment above `runSyncCycle`'s `vaultConflict` handling).
- `SyncCycleResult`/`SyncStatus` changes must be **additive only** (new optional fields) — nothing existing may change shape, since `merge.test.ts`/`engine.test.ts`/`sync-store.test.ts` assert exact object shapes in places.

## Approved copy (JA primary / EN — reference for every task below)

| key | JA | EN |
|---|---|---|
| `sync.connectExplanation` | 他の端末でも同じブックマークが使えるようになります。保存先はあなた自身のGoogleドライブ。運営はデータを見られません。 | Use the same bookmarks on every device. Everything is stored in your own Google Drive — we never see it. |
| `sync.connectButton` | Googleで接続 | Connect Google |
| `sync.connecting` | 接続しています… | Connecting… |
| `sync.connectFailed` | 接続できませんでした。もう一度お試しください。 | Couldn't connect. Try again. |
| `sync.connectedAs` | {email} に接続中 | Connected as {email} |
| `sync.connectedGeneric` | 接続済み | Connected |
| `sync.lastSyncedJustNow` | たった今同期しました | Synced just now |
| `sync.lastSyncedMinutesAgo` | {minutes}分前に同期 | Synced {minutes}m ago |
| `sync.lastSyncedHoursAgo` | {hours}時間前に同期 | Synced {hours}h ago |
| `sync.lastSyncedDaysAgo` | {days}日前に同期 | Synced {days}d ago |
| `sync.syncNowButton` | 今すぐ同期 | Sync now |
| `sync.syncingNow` | 同期中… | Syncing… |
| `sync.massDeleteHeading` | 確認してください | Please confirm |
| `sync.massDeleteBody` | このまま同期すると、{count}件のブックマークが削除されます。続けますか? | Syncing will delete {count} bookmarks. Continue? |
| `sync.massDeleteContinue` | 続ける | Continue |
| `sync.reconnectNeeded` | 接続が切れました。もう一度Googleに接続してください。 | Connection lost. Please reconnect to Google. |
| `sync.reconnectButton` | Googleに再接続 | Reconnect Google |
| `sync.errorStorageFull` | Googleドライブの空き容量が足りません。空けてからもう一度お試しください。 | Not enough space in your Google Drive. Free up space, then try again. |
| `sync.errorCorrupt` | 同期データの読み込みに失敗しました。少し待ってからもう一度お試しください。 | Couldn't read the synced data. Wait a moment and try again. |
| `sync.errorOffline` | オフラインのようです。接続が戻ったら自動で同期します。 | You seem to be offline. We'll sync automatically once you're back online. |
| `sync.errorGeneric` | 同期に失敗しました。もう一度お試しください。 | Sync failed. Try again. |

`sync.massDeleteHeading`'s cancel button reuses the existing `share.cancel` key ("キャンセル" / "Cancel") — do not add a duplicate key.

**Remove** `sync.connectComingSoon` from all 15 locale files — it becomes dead code once `SyncPanel.tsx` is rewritten (verified: its only non-message-file reference is the one line in `SyncPanel.tsx` this plan replaces).

---

### Task 1: Pure helpers — error classification, ID-token email, relative-time formatting

**Files:**
- Create: `lib/sync/error-kind.ts`
- Create: `lib/sync/error-kind.test.ts`
- Create: `lib/sync/id-token.ts`
- Create: `lib/sync/id-token.test.ts`
- Create: `lib/sync/format-last-sync.ts`
- Create: `lib/sync/format-last-sync.test.ts`

**Interfaces:**
- Produces: `export type SyncErrorKind = 'network' | 'auth' | 'storage-full' | 'corrupt' | 'other'` and `export function classifySyncError(err: unknown): SyncErrorKind` from `error-kind.ts`.
- Produces: `export function decodeIdTokenEmail(idToken: string): string | null` from `id-token.ts`.
- Produces: `export type LastSyncedDisplay = { readonly kind: 'never' } | { readonly kind: 'just-now' } | { readonly kind: 'minutes'; readonly value: number } | { readonly kind: 'hours'; readonly value: number } | { readonly kind: 'days'; readonly value: number }` and `export function formatLastSynced(lastSyncAt: number | undefined, nowMs: number): LastSyncedDisplay` from `format-last-sync.ts`.
- These three files have **zero imports from the rest of `lib/sync/`** (classification is done by duck-typing on `err.name`/`err.status`, never `instanceof`, specifically to avoid a circular import with `engine.ts`, which will import `classifySyncError` in Task 3).

- [ ] **Step 1: Write the failing tests**

`lib/sync/error-kind.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { classifySyncError } from './error-kind'

function fakeError(name: string, message: string, status?: number): Error {
  const e = new Error(message)
  e.name = name
  if (status !== undefined) (e as Error & { status: number }).status = status
  return e
}

describe('classifySyncError', () => {
  it('classifies a non-Error thrown value as other', () => {
    expect(classifySyncError('boom')).toBe('other')
  })
  it('classifies SyncCorruptDataError as corrupt', () => {
    expect(classifySyncError(fakeError('SyncCorruptDataError', 'bookmarks.json failed validation'))).toBe('corrupt')
  })
  it('classifies SyncNotConnectedError as auth', () => {
    expect(classifySyncError(fakeError('SyncNotConnectedError', 'not connected'))).toBe('auth')
  })
  it('classifies GauthError as auth', () => {
    expect(classifySyncError(fakeError('GauthError', 'invalid_grant'))).toBe('auth')
  })
  it('classifies a DriveError with status 0 as network', () => {
    expect(classifySyncError(fakeError('DriveError', 'drive fetch failed: network error', 0))).toBe('network')
  })
  it('classifies a DriveError with status 401 as auth', () => {
    expect(classifySyncError(fakeError('DriveError', 'drive 401: invalid credentials', 401))).toBe('auth')
  })
  it('classifies a DriveError with status 403 and a storageQuotaExceeded body as storage-full', () => {
    expect(classifySyncError(fakeError('DriveError', 'drive 403: {"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}', 403))).toBe('storage-full')
  })
  it('classifies a DriveError with status 403 and no quota reason as other', () => {
    expect(classifySyncError(fakeError('DriveError', 'drive 403: insufficient permission', 403))).toBe('other')
  })
  it('classifies a DriveError with an unrelated status as other', () => {
    expect(classifySyncError(fakeError('DriveError', 'drive 500: internal error', 500))).toBe('other')
  })
  it('classifies a plain Error as other', () => {
    expect(classifySyncError(new Error('something else'))).toBe('other')
  })
})
```

`lib/sync/id-token.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { decodeIdTokenEmail } from './id-token'

function fakeIdToken(payload: unknown): string {
  const base64url = (s: string): string =>
    btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

describe('decodeIdTokenEmail', () => {
  it('extracts the email claim from a well-formed token', () => {
    const token = fakeIdToken({ email: 'user@example.com', sub: '123' })
    expect(decodeIdTokenEmail(token)).toBe('user@example.com')
  })
  it('returns null when the payload has no email claim', () => {
    const token = fakeIdToken({ sub: '123' })
    expect(decodeIdTokenEmail(token)).toBeNull()
  })
  it('returns null for a token that is not 3 dot-separated segments', () => {
    expect(decodeIdTokenEmail('not-a-jwt')).toBeNull()
  })
  it('returns null when the payload segment is not valid base64/JSON', () => {
    expect(decodeIdTokenEmail('aaa.not-base64!!!.bbb')).toBeNull()
  })
})
```

`lib/sync/format-last-sync.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { formatLastSynced } from './format-last-sync'

describe('formatLastSynced', () => {
  const now = 1_000_000_000_000

  it('returns never when lastSyncAt is undefined', () => {
    expect(formatLastSynced(undefined, now)).toEqual({ kind: 'never' })
  })
  it('returns just-now for under a minute', () => {
    expect(formatLastSynced(now - 30_000, now)).toEqual({ kind: 'just-now' })
  })
  it('returns minutes for 5 minutes ago', () => {
    expect(formatLastSynced(now - 5 * 60_000, now)).toEqual({ kind: 'minutes', value: 5 })
  })
  it('returns hours for 2 hours ago', () => {
    expect(formatLastSynced(now - 2 * 60 * 60_000, now)).toEqual({ kind: 'hours', value: 2 })
  })
  it('returns days for 3 days ago', () => {
    expect(formatLastSynced(now - 3 * 24 * 60 * 60_000, now)).toEqual({ kind: 'days', value: 3 })
  })
  it('clamps a lastSyncAt slightly in the future to just-now (clock skew)', () => {
    expect(formatLastSynced(now + 5000, now)).toEqual({ kind: 'just-now' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/sync/error-kind.test.ts lib/sync/id-token.test.ts lib/sync/format-last-sync.test.ts`
Expected: FAIL — the three source modules don't exist yet (`Cannot find module './error-kind'` etc).

- [ ] **Step 3: Implement the three modules**

`lib/sync/error-kind.ts`:
```ts
// lib/sync/error-kind.ts
// Classifies a thrown error from a sync cycle into a UI-relevant bucket, so
// SyncPanel can show "reconnect", "storage full", "corrupt data", "offline",
// or a generic retry message without importing engine.ts's error classes
// (that would create a circular import: engine.ts needs this file to
// classify what it catches). Duck-types on `.name`/`.status` instead of
// `instanceof` for exactly that reason.

export type SyncErrorKind = 'network' | 'auth' | 'storage-full' | 'corrupt' | 'other'

export function classifySyncError(err: unknown): SyncErrorKind {
  if (!(err instanceof Error)) return 'other'
  if (err.name === 'SyncCorruptDataError') return 'corrupt'
  if (err.name === 'SyncNotConnectedError' || err.name === 'GauthError') return 'auth'
  if (err.name === 'DriveError') {
    const status = (err as Error & { status?: unknown }).status
    if (status === 0) return 'network'
    if (status === 401) return 'auth'
    if (status === 403 && /storageQuotaExceeded|quotaExceeded/i.test(err.message)) return 'storage-full'
    return 'other'
  }
  return 'other'
}
```

`lib/sync/id-token.ts`:
```ts
// lib/sync/id-token.ts
// Best-effort, unverified decode of the OIDC ID token's `email` claim, for
// display only ("Connected as x@y.com" in SyncPanel). No signature check —
// the token just came from our own /api/gauth/token exchange over HTTPS, so
// trusting its shape here is fine; this is not an auth decision point.

export function decodeIdTokenEmail(idToken: string): string | null {
  const parts = idToken.split('.')
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = atob(padded)
    const payload: unknown = JSON.parse(json)
    if (typeof payload === 'object' && payload !== null && typeof (payload as { email?: unknown }).email === 'string') {
      return (payload as { email: string }).email
    }
    return null
  } catch {
    return null
  }
}
```

`lib/sync/format-last-sync.ts`:
```ts
// lib/sync/format-last-sync.ts
// Pure relative-time bucketing for SyncPanel's "last synced" line. Mirrors
// backup-reminder.ts's daysSince() pattern but with minute/hour granularity,
// since sync (unlike backup) is expected to happen within minutes.

export type LastSyncedDisplay =
  | { readonly kind: 'never' }
  | { readonly kind: 'just-now' }
  | { readonly kind: 'minutes'; readonly value: number }
  | { readonly kind: 'hours'; readonly value: number }
  | { readonly kind: 'days'; readonly value: number }

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export function formatLastSynced(lastSyncAt: number | undefined, nowMs: number): LastSyncedDisplay {
  if (lastSyncAt === undefined) return { kind: 'never' }
  const diff = Math.max(0, nowMs - lastSyncAt)
  if (diff < MINUTE_MS) return { kind: 'just-now' }
  if (diff < HOUR_MS) return { kind: 'minutes', value: Math.floor(diff / MINUTE_MS) }
  if (diff < DAY_MS) return { kind: 'hours', value: Math.floor(diff / HOUR_MS) }
  return { kind: 'days', value: Math.floor(diff / DAY_MS) }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/sync/error-kind.test.ts lib/sync/id-token.test.ts lib/sync/format-last-sync.test.ts`
Expected: PASS (20 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/sync/error-kind.ts lib/sync/error-kind.test.ts lib/sync/id-token.ts lib/sync/id-token.test.ts lib/sync/format-last-sync.ts lib/sync/format-last-sync.test.ts
rtk git commit -m "feat(sync): add error classification, id-token email decode, and relative-time formatting helpers"
```

---

### Task 2: `sync-store.ts` — persist `connectedEmail` and `lastIssue`

**Files:**
- Modify: `lib/sync/sync-store.ts:1-58`
- Modify: `lib/sync/sync-store.test.ts`

**Interfaces:**
- Consumes: `SyncErrorKind` from `./error-kind` (Task 1).
- Produces: `export type SyncIssue = { readonly kind: 'needs-confirmation'; readonly deletedCount: number } | { readonly kind: 'error'; readonly errorKind: SyncErrorKind }`. `SyncStatus` gains `readonly connectedEmail?: string` and `readonly lastIssue?: SyncIssue`. Both consumed by `engine.ts` (Task 3) and `SyncPanel.tsx`/`SyncEngineRunner.tsx` (Tasks 6-7).

- [ ] **Step 1: Write the failing tests**

Add to `lib/sync/sync-store.test.ts` (inside the existing `describe('sync-store status', ...)` block, after the last `it`):
```ts
  it('round-trips connectedEmail and lastIssue', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await updateSyncStatus(d, { connected: true, connectedEmail: 'user@example.com' })
    const status = await updateSyncStatus(d, { lastIssue: { kind: 'error', errorKind: 'auth' } })
    expect(status.connectedEmail).toBe('user@example.com')
    expect(status.lastIssue).toEqual({ kind: 'error', errorKind: 'auth' })
  })

  it('a later patch can explicitly clear lastIssue back to undefined', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await updateSyncStatus(d, { lastIssue: { kind: 'needs-confirmation', deletedCount: 5 } })
    const status = await updateSyncStatus(d, { lastIssue: undefined })
    expect(status.lastIssue).toBeUndefined()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/sync/sync-store.test.ts`
Expected: FAIL with a TypeScript error (`connectedEmail`/`lastIssue` do not exist on the patch type) or a runtime assertion failure.

- [ ] **Step 3: Implement**

In `lib/sync/sync-store.ts`, add the import and extend `SyncStatus`:
```ts
import type { IDBPDatabase } from 'idb'
import type { SyncTokens } from './auth'
import type { SyncSnapshot } from './merge'
import type { SyncErrorKind } from './error-kind'
```
Replace the existing `SyncStatus` interface:
```ts
export type SyncIssue =
  | { readonly kind: 'needs-confirmation'; readonly deletedCount: number }
  | { readonly kind: 'error'; readonly errorKind: SyncErrorKind }

export interface SyncStatus {
  readonly connected: boolean
  readonly folderId?: string
  readonly headRevisions: Readonly<Record<string, string>>
  readonly lastSyncAt?: number
  readonly connectedEmail?: string
  readonly lastIssue?: SyncIssue
}
```
`updateSyncStatus`'s existing `{ ...current, ...patch, headRevisions: ... }` spread already handles the two new fields correctly (including explicitly clearing `lastIssue` to `undefined`, since the key is present in `patch`) — no change needed to the function body itself.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/sync/sync-store.test.ts`
Expected: PASS (8 tests, 2 new).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/sync/sync-store.ts lib/sync/sync-store.test.ts
rtk git commit -m "feat(sync): persist connectedEmail and lastIssue on SyncStatus"
```

---

### Task 3: `engine.ts` — persist outcomes, classify errors, decode connected email

**Files:**
- Modify: `lib/sync/engine.ts:230-386`
- Modify: `lib/sync/engine.test.ts`

**Interfaces:**
- Consumes: `classifySyncError` from `./error-kind` (Task 1), `decodeIdTokenEmail` from `./id-token` (Task 1), `SyncIssue` type from `./sync-store` (Task 2, already imported as a value-and-type module).
- Produces: `SyncCycleResult` gains `readonly errorKind?: SyncErrorKind` and `readonly deletedCount?: number`. Every `runSyncCycle`/`connectSync` return path now also persists the outcome via `updateSyncStatus(db, { lastIssue: ... })` (cleared to `undefined` on success), and `connectSync` persists `connectedEmail` on a successful connection. Consumed by `SyncPanel.tsx` (Task 7) and `SyncEngineRunner.tsx` (Task 6, indirectly — it never reads the return value, just relies on this persistence).

- [ ] **Step 1: Write the failing tests**

Add to `lib/sync/engine.test.ts`, inside `describe('runSyncCycle', ...)` (after the existing "bypasses the mass-deletion guard" test — find it via the `it('bypasses the mass-deletion guard...')` block already in the file and add these as siblings):
```ts
  it('persists lastIssue with deletedCount when it pauses for confirmation', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    for (let i = 0; i < 10; i++) await d.put('bookmarks', bookmark(`local-${i}`) as never)
    const remoteBookmarks = Array.from({ length: 8 }, (_, i) =>
      bookmark(`local-${i}`, { isDeleted: true, deletedAt: '2026-06-01T00:00:00.000Z', updatedAt: 999999 }))
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-bm', name: 'bookmarks.json' }])
    vi.mocked(downloadFileText).mockImplementation(async (_t, id) =>
      id === 'f-bm' ? JSON.stringify(remoteBookmarks) : '[]')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')

    const result = await runSyncCycle(d)
    expect(result.status).toBe('needs-confirmation')
    expect(result.deletedCount).toBe(8)
    const status = await loadSyncStatus(d)
    expect(status.lastIssue).toEqual({ kind: 'needs-confirmation', deletedCount: 8 })
  })

  it('persists lastIssue with a classified errorKind on pull failure, and clears it on the next successful cycle', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    vi.mocked(listFolderFiles).mockRejectedValueOnce(new DriveError(0, 'drive fetch failed: network error'))

    const failed = await runSyncCycle(d)
    expect(failed.status).toBe('error')
    expect(failed.errorKind).toBe('network')
    const statusAfterFailure = await loadSyncStatus(d)
    expect(statusAfterFailure.lastIssue).toEqual({ kind: 'error', errorKind: 'network' })

    vi.mocked(listFolderFiles).mockResolvedValue([])
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))
    const succeeded = await runSyncCycle(d)
    expect(succeeded.status).toBe('synced')
    const statusAfterSuccess = await loadSyncStatus(d)
    expect(statusAfterSuccess.lastIssue).toBeUndefined()
  })
```
Add the `DriveError` import to the top of `engine.test.ts`'s existing `vi.mock('./drive-adapter', ...)` region — extend the existing import line:
```ts
import {
  findSyncFolder, createSyncFolder, listFolderFiles, downloadFileText,
  getHeadRevisionId, createTextFile, updateTextFile, DriveError,
} from './drive-adapter'
```
(`DriveError` is a real, un-mocked export from `drive-adapter.ts` — the `vi.mock` factory above already spreads `...actual`, so this import resolves to the real class, not a mock.)

Add to `describe('connectSync', ...)` (after the existing "saves tokens, finds/creates the folder..." test):
```ts
  it('decodes and persists connectedEmail from the ID token on a successful connect', async () => {
    const d = await initDB(); db = d
    vi.mocked(findSyncFolder).mockResolvedValue(null)
    vi.mocked(createSyncFolder).mockResolvedValue('new-folder')
    vi.mocked(listFolderFiles).mockResolvedValue([])
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))
    const base64url = (s: string): string => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const idToken = `${base64url('{}')}.${base64url(JSON.stringify({ email: 'user@example.com' }))}.sig`

    await connectSync(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: SYNC_OAUTH_SCOPE, refreshToken: 'rt', idToken })
    const status = await loadSyncStatus(d)
    expect(status.connectedEmail).toBe('user@example.com')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/sync/engine.test.ts`
Expected: FAIL — `result.errorKind`/`result.deletedCount`/`status.lastIssue`/`status.connectedEmail` are all `undefined` against the current implementation (assertions fail; the `DriveError` import is fine since that class already exists).

- [ ] **Step 3: Implement**

Add imports near the top of `lib/sync/engine.ts` (alongside the existing `sync-store` import):
```ts
import { classifySyncError } from './error-kind'
import { decodeIdTokenEmail } from './id-token'
```

Extend the `SyncCycleResult` interface (currently at the section starting `export interface SyncCycleResult {`):
```ts
export interface SyncCycleResult {
  readonly status: 'not-connected' | 'synced' | 'needs-confirmation' | 'error'
  readonly vaultConflict: boolean
  readonly deletionRatio?: number
  readonly deletedCount?: number
  readonly mergedCounts?: { readonly bookmarks: number; readonly tags: number; readonly cards: number }
  readonly errorMessage?: string
  readonly errorKind?: import('./error-kind').SyncErrorKind
}
```

In `runSyncCycle`, update each return/catch site (matching the current file's exact structure):

1. `ensureAccessToken` catch (currently `return { status: 'error', vaultConflict: false, errorMessage: err instanceof Error ? err.message : 'auth failed' }`):
```ts
  let accessToken: string
  try {
    accessToken = await ensureAccessToken(db)
  } catch (err) {
    const errorKind = classifySyncError(err)
    await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind } })
    return { status: 'error', vaultConflict: false, errorKind, errorMessage: err instanceof Error ? err.message : 'auth failed' }
  }
```

2. First `pullRemoteSnapshot` catch:
```ts
  let pulled: Awaited<ReturnType<typeof pullRemoteSnapshot>>
  try {
    pulled = await pullRemoteSnapshot(accessToken, folderId)
  } catch (err) {
    const errorKind = classifySyncError(err)
    await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind } })
    return { status: 'error', vaultConflict: false, errorKind, errorMessage: err instanceof Error ? err.message : 'pull failed' }
  }
```

3. First mass-delete guard branch (inside `if (!opts.bypassMassDeleteGuard && ...)`):
```ts
    if (deletionRatio > MASS_DELETE_THRESHOLD) {
      const deletedCount = localActive - mergedActive
      await updateSyncStatus(db, { lastIssue: { kind: 'needs-confirmation', deletedCount } })
      return { status: 'needs-confirmation', vaultConflict, deletionRatio, deletedCount }
    }
```

4. Non-conflict push-failure catch (the `if (!(err instanceof SyncConflictError))` branch):
```ts
  } catch (err) {
    if (!(err instanceof SyncConflictError)) {
      const errorKind = classifySyncError(err)
      await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind } })
      return { status: 'error', vaultConflict, errorKind, errorMessage: err instanceof Error ? err.message : 'push failed' }
    }
```

5. Retry-branch re-pull catch (`catch (err2)`):
```ts
    let rePulled: Awaited<ReturnType<typeof pullRemoteSnapshot>>
    try {
      rePulled = await pullRemoteSnapshot(accessToken, folderId)
    } catch (err2) {
      const errorKind = classifySyncError(err2)
      await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind } })
      return { status: 'error', vaultConflict, errorKind, errorMessage: err2 instanceof Error ? err2.message : 'pull failed (retry)' }
    }
```

6. Retry-branch mass-delete guard:
```ts
    const reMergedActive = activeCount(pushedSnapshot.bookmarks)
    if (!opts.bypassMassDeleteGuard && localActive >= MASS_DELETE_MIN_COUNT) {
      const reDeletionRatio = (localActive - reMergedActive) / localActive
      if (reDeletionRatio > MASS_DELETE_THRESHOLD) {
        const deletedCount = localActive - reMergedActive
        await updateSyncStatus(db, { lastIssue: { kind: 'needs-confirmation', deletedCount } })
        return { status: 'needs-confirmation', vaultConflict, deletionRatio: reDeletionRatio, deletedCount }
      }
    }
```

7. Retry-branch re-push catch (`catch (err3)`):
```ts
    try {
      newRevisions = await pushSnapshot(accessToken, folderId, pushedSnapshot, rePulled.headRevisions)
    } catch (err3) {
      const errorKind = classifySyncError(err3)
      await updateSyncStatus(db, { lastIssue: { kind: 'error', errorKind } })
      return { status: 'error', vaultConflict, errorKind, errorMessage: err3 instanceof Error ? err3.message : 'push failed (retry)' }
    }
```

8. Final success path — extend the existing call:
```ts
  await writeManifest(accessToken, folderId, db, pushedSnapshot)
  await saveBaseSnapshot(db, pushedSnapshot)
  await updateSyncStatus(db, { headRevisions: newRevisions, lastSyncAt: Date.now(), lastIssue: undefined })
```

In `connectSync`, classify the scope-check early return and decode+persist the email on success:
```ts
export async function connectSync(db: DbLike, tokens: SyncTokens): Promise<SyncCycleResult> {
  if (!hasRequiredScopes(tokens.scope)) {
    return {
      status: 'error',
      vaultConflict: false,
      errorKind: 'auth',
      errorMessage: 'Missing required Google Drive permission. Please reconnect and grant all requested permissions.',
    }
  }
  try {
    await saveSyncTokens(db, tokens)
    const folderId = await ensureSyncFolder(tokens.accessToken)
    const connectedEmail = tokens.idToken ? decodeIdTokenEmail(tokens.idToken) ?? undefined : undefined
    await updateSyncStatus(db, { connected: true, folderId, connectedEmail })
  } catch (err) {
    const errorKind = classifySyncError(err)
    return { status: 'error', vaultConflict: false, errorKind, errorMessage: err instanceof Error ? err.message : 'connect failed' }
  }
  return runSyncCycle(db)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/sync/engine.test.ts`
Expected: PASS (all existing + 3 new tests).

- [ ] **Step 5: Run the full sync test directory to check for regressions**

Run: `npx vitest run lib/sync/`
Expected: PASS, all files.

- [ ] **Step 6: Commit**

```bash
rtk git add lib/sync/engine.ts lib/sync/engine.test.ts
rtk git commit -m "feat(sync): classify errors and persist lastIssue/connectedEmail on every sync cycle outcome"
```

---

### Task 4: Add the 20 new i18n keys (and remove the dead one) across all 15 locale files

**Files:**
- Modify: `messages/en.json`, `messages/ja.json`, `messages/ar.json`, `messages/de.json`, `messages/es.json`, `messages/fr.json`, `messages/it.json`, `messages/ko.json`, `messages/nl.json`, `messages/pt.json`, `messages/ru.json`, `messages/th.json`, `messages/tr.json`, `messages/vi.json`, `messages/zh.json`
- Create (temporary, scratchpad, not committed): a Node script to perform the edit mechanically and deterministically across all 15 files

**Interfaces:**
- Produces: the 20 `sync.*` keys listed in "Approved copy" above, present in every locale file's `sync` object. `sync.connectComingSoon` removed from every locale file. Consumed by `SyncMassDeleteConfirmDialog.tsx` (Task 5) and `SyncPanel.tsx` (Task 7).

- [ ] **Step 1: Write the script**

Create `scripts/tmp-add-sync-keys.mjs` (repo root, deleted at the end of this task — not committed):
```js
import { readFileSync, writeFileSync } from 'fs'

const EN = {
  connectExplanation: 'Use the same bookmarks on every device. Everything is stored in your own Google Drive — we never see it.',
  connectButton: 'Connect Google',
  connecting: 'Connecting…',
  connectFailed: "Couldn't connect. Try again.",
  connectedAs: 'Connected as {email}',
  connectedGeneric: 'Connected',
  lastSyncedJustNow: 'Synced just now',
  lastSyncedMinutesAgo: 'Synced {minutes}m ago',
  lastSyncedHoursAgo: 'Synced {hours}h ago',
  lastSyncedDaysAgo: 'Synced {days}d ago',
  syncNowButton: 'Sync now',
  syncingNow: 'Syncing…',
  massDeleteHeading: 'Please confirm',
  massDeleteBody: 'Syncing will delete {count} bookmarks. Continue?',
  massDeleteContinue: 'Continue',
  reconnectNeeded: 'Connection lost. Please reconnect to Google.',
  reconnectButton: 'Reconnect Google',
  errorStorageFull: 'Not enough space in your Google Drive. Free up space, then try again.',
  errorCorrupt: "Couldn't read the synced data. Wait a moment and try again.",
  errorOffline: "You seem to be offline. We'll sync automatically once you're back online.",
  errorGeneric: 'Sync failed. Try again.',
}

const JA = {
  connectExplanation: '他の端末でも同じブックマークが使えるようになります。保存先はあなた自身のGoogleドライブ。運営はデータを見られません。',
  connectButton: 'Googleで接続',
  connecting: '接続しています…',
  connectFailed: '接続できませんでした。もう一度お試しください。',
  connectedAs: '{email} に接続中',
  connectedGeneric: '接続済み',
  lastSyncedJustNow: 'たった今同期しました',
  lastSyncedMinutesAgo: '{minutes}分前に同期',
  lastSyncedHoursAgo: '{hours}時間前に同期',
  lastSyncedDaysAgo: '{days}日前に同期',
  syncNowButton: '今すぐ同期',
  syncingNow: '同期中…',
  massDeleteHeading: '確認してください',
  massDeleteBody: 'このまま同期すると、{count}件のブックマークが削除されます。続けますか?',
  massDeleteContinue: '続ける',
  reconnectNeeded: '接続が切れました。もう一度Googleに接続してください。',
  reconnectButton: 'Googleに再接続',
  errorStorageFull: 'Googleドライブの空き容量が足りません。空けてからもう一度お試しください。',
  errorCorrupt: '同期データの読み込みに失敗しました。少し待ってからもう一度お試しください。',
  errorOffline: 'オフラインのようです。接続が戻ったら自動で同期します。',
  errorGeneric: '同期に失敗しました。もう一度お試しください。',
}

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'nl', 'pt', 'ru', 'th', 'tr', 'vi', 'zh']

for (const locale of LOCALES) {
  const path = `messages/${locale}.json`
  const data = JSON.parse(readFileSync(path, 'utf8'))
  const copy = locale === 'ja' ? JA : EN
  delete data.sync.connectComingSoon
  data.sync = { ...data.sync, ...copy }
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8')
}
console.log('done')
```

- [ ] **Step 2: Run the script**

Run: `node scripts/tmp-add-sync-keys.mjs`
Expected: prints `done`, exit code 0.

- [ ] **Step 3: Verify the diff touches exactly the 15 locale files, and spot-check en/ja**

Run: `git diff --stat -- messages/`
Expected: 15 files changed.

Run: `node -e "const j=require('./messages/en.json'); console.log(j.sync.connectButton, j.sync.connectComingSoon)"`
Expected: `Connect Google undefined`

Run: `node -e "const j=require('./messages/ja.json'); console.log(j.sync.connectButton)"`
Expected: `Googleで接続`

- [ ] **Step 4: Run the i18n test suite to confirm no regression**

Run: `npx vitest run lib/i18n/`
Expected: PASS.

- [ ] **Step 5: Delete the temporary script and commit only the message files**

```bash
rm scripts/tmp-add-sync-keys.mjs
rtk git add messages/
rtk git commit -m "i18n: add SyncPanel connect/status/error copy, remove dead connectComingSoon key"
```

---

### Task 5: `SyncMassDeleteConfirmDialog` — mass-deletion confirm dialog

**Files:**
- Create: `components/board/SyncMassDeleteConfirmDialog.tsx`
- Create: `components/board/SyncMassDeleteConfirmDialog.module.css`
- Create: `components/board/SyncMassDeleteConfirmDialog.test.tsx`

**Interfaces:**
- Consumes: `sync.massDeleteHeading`, `sync.massDeleteBody`, `sync.massDeleteContinue`, `share.cancel` (Task 4).
- Produces: `export function SyncMassDeleteConfirmDialog({ count, onConfirm, onCancel }: { readonly count: number; readonly onConfirm: () => void; readonly onCancel: () => void }): ReactElement`. Consumed by `SyncPanel.tsx` (Task 7).

This mirrors `components/board/PrivateShareConfirmDialog.tsx` byte-for-byte in structure (same backdrop/panel/Escape/click-outside behavior, same deliberate CSS duplication convention used throughout this app's dialogs) — only the copy and prop name (`count` → deleted-bookmark count, not selected-card count) differ.

- [ ] **Step 1: Write the failing tests**

`components/board/SyncMassDeleteConfirmDialog.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SyncMassDeleteConfirmDialog } from './SyncMassDeleteConfirmDialog'

describe('SyncMassDeleteConfirmDialog', () => {
  it('shows the count in the body text', () => {
    render(<SyncMassDeleteConfirmDialog count={42} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog').textContent).toContain('42')
  })

  it('CONTINUE fires onConfirm', () => {
    const onConfirm = vi.fn()
    render(<SyncMassDeleteConfirmDialog count={1} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByTestId('sync-mass-delete-continue'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('CANCEL fires onCancel', () => {
    const onCancel = vi.fn()
    render(<SyncMassDeleteConfirmDialog count={1} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('sync-mass-delete-cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('backdrop click fires onCancel', () => {
    const onCancel = vi.fn()
    render(<SyncMassDeleteConfirmDialog count={1} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Escape key fires onCancel', () => {
    const onCancel = vi.fn()
    render(<SyncMassDeleteConfirmDialog count={1} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/board/SyncMassDeleteConfirmDialog.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

`components/board/SyncMassDeleteConfirmDialog.tsx`:
```tsx
'use client'

import { useEffect, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './SyncMassDeleteConfirmDialog.module.css'

type Props = {
  readonly count: number
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function SyncMassDeleteConfirmDialog({ count, onConfirm, onCancel }: Props): ReactElement {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className={styles.backdrop}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-mass-delete-heading"
      data-testid="sync-mass-delete-dialog"
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="sync-mass-delete-heading" className={styles.heading}>{t('sync.massDeleteHeading')}</div>
        <div className={styles.body}>{t('sync.massDeleteBody').replace('{count}', String(count))}</div>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} data-testid="sync-mass-delete-cancel">
            {t('share.cancel')}
          </button>
          <button type="button" className={styles.continueBtn} onClick={onConfirm} data-testid="sync-mass-delete-continue">
            {t('sync.massDeleteContinue')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

`components/board/SyncMassDeleteConfirmDialog.module.css` (identical to `PrivateShareConfirmDialog.module.css`, `.shareBtn` renamed to `.continueBtn`):
```css
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

.panel {
  width: min(360px, calc(100% - 32px));
  background: rgba(20, 20, 20, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  padding: 20px;
}

.heading {
  font-size: 13px;
  letter-spacing: 0.08em;
  color: #f2f2f2;
  margin-bottom: 8px;
}

.body {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(242, 242, 242, 0.85);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.cancelBtn,
.continueBtn {
  font-size: 12px;
  letter-spacing: 0.06em;
  padding: 7px 14px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: transparent;
  color: #f2f2f2;
  cursor: pointer;
}

.continueBtn {
  border-color: rgba(40, 241, 0, 0.55);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/board/SyncMassDeleteConfirmDialog.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/SyncMassDeleteConfirmDialog.tsx components/board/SyncMassDeleteConfirmDialog.module.css components/board/SyncMassDeleteConfirmDialog.test.tsx
rtk git commit -m "feat(sync): add mass-deletion confirm dialog for the sync safety valve"
```

---

### Task 6: `SyncEngineRunner` — headless background sync mount

**Files:**
- Create: `components/board/SyncEngineRunner.tsx`
- Create: `components/board/SyncEngineRunner.test.tsx`

**Interfaces:**
- Consumes: `initDB` from `@/lib/storage/indexeddb`, `loadSyncStatus` from `@/lib/sync/sync-store` (Task 2), `createSyncController` from `@/lib/sync/sync-controller` (existing, untouched).
- Produces: `export function SyncEngineRunner(): ReactElement | null`. Mounted unconditionally in `BoardRoot.tsx` (Task 8).

This does **not** use `sync-controller.ts`'s `onResult` callback — that parameter stays reserved for bundle ③'s vault-conflict UI (per `docs/CURRENT_GOAL.md`). Outcomes from controller-triggered cycles are picked up the same way manual cycles are: `runSyncCycle` (Task 3) already persists `lastIssue`/`lastSyncAt` to `sync-store` on every call, regardless of caller, so `SyncPanel` sees them next time it reads status — no callback wiring needed here.

- [ ] **Step 1: Write the failing tests**

`components/board/SyncEngineRunner.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { SyncEngineRunner } from './SyncEngineRunner'
import { loadSyncStatus } from '@/lib/sync/sync-store'
import { createSyncController } from '@/lib/sync/sync-controller'

vi.mock('@/lib/storage/indexeddb', () => ({ initDB: vi.fn().mockResolvedValue({}) }))
vi.mock('@/lib/sync/sync-store', () => ({ loadSyncStatus: vi.fn() }))
vi.mock('@/lib/sync/sync-controller', () => ({ createSyncController: vi.fn() }))

const mockLoadSyncStatus = vi.mocked(loadSyncStatus)
const mockCreateSyncController = vi.mocked(createSyncController)

function fakeController() {
  return { start: vi.fn(), stop: vi.fn(), markDirty: vi.fn(), flushNow: vi.fn().mockResolvedValue({ status: 'synced', vaultConflict: false }) }
}

describe('SyncEngineRunner', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('does nothing when sync is not connected', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    render(<SyncEngineRunner />)
    await vi.waitFor(() => expect(mockLoadSyncStatus).toHaveBeenCalled())
    expect(mockCreateSyncController).not.toHaveBeenCalled()
  })

  it('starts the controller and flushes once on launch when already connected', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, folderId: 'f1' })
    const controller = fakeController()
    mockCreateSyncController.mockReturnValue(controller)
    render(<SyncEngineRunner />)
    await vi.waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
    expect(controller.flushNow).toHaveBeenCalledTimes(1)
  })

  it('renders nothing', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    const { container } = render(<SyncEngineRunner />)
    await vi.waitFor(() => expect(mockLoadSyncStatus).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('stops the controller on unmount', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, folderId: 'f1' })
    const controller = fakeController()
    mockCreateSyncController.mockReturnValue(controller)
    const { unmount } = render(<SyncEngineRunner />)
    await vi.waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
    unmount()
    expect(controller.stop).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/board/SyncEngineRunner.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

`components/board/SyncEngineRunner.tsx`:
```tsx
'use client'

import { useEffect, type ReactElement } from 'react'
import { initDB } from '@/lib/storage/indexeddb'
import { loadSyncStatus } from '@/lib/sync/sync-store'
import { createSyncController, type SyncController } from '@/lib/sync/sync-controller'

const REVISIT_GAP_MS = 5 * 60 * 1000

/** Headless. Mounted once, unconditionally, at board root (regardless of
 *  whether SETTINGS/SyncPanel is open), so an already-connected device keeps
 *  syncing in the background: pull on launch here, push-ish full cycles on
 *  tab-hide/close via the controller's own visibilitychange/beforeunload
 *  listeners (sync-controller.ts, unchanged), and a re-pull on tab-revisit
 *  after a long-enough gap (handled here, since sync-controller.ts only
 *  reacts to 'hidden', not 'visible'). Renders nothing — SyncPanel is the
 *  only visible surface for sync state, reading it back via sync-store on
 *  its own next mount/read. Wiring markDirty() into write paths for
 *  near-real-time cross-tab sync is deliberately out of scope (see
 *  docs/CURRENT_GOAL.md's "★検討事項"). */
export function SyncEngineRunner(): ReactElement | null {
  useEffect(() => {
    let cancelled = false
    let controller: SyncController | null = null

    void (async (): Promise<void> => {
      try {
        const db = await initDB()
        const status = await loadSyncStatus(db)
        if (cancelled || !status.connected) return
        controller = createSyncController(db)
        controller.start()
        void controller.flushNow()
      } catch (e) {
        console.error('[AllMarks] sync engine failed to start', e)
      }
    })()

    function handleVisible(): void {
      if (document.visibilityState !== 'visible' || !controller) return
      void (async (): Promise<void> => {
        const db = await initDB()
        const status = await loadSyncStatus(db)
        if (!status.lastSyncAt || Date.now() - status.lastSyncAt >= REVISIT_GAP_MS) {
          void controller?.flushNow()
        }
      })()
    }
    document.addEventListener('visibilitychange', handleVisible)

    return (): void => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisible)
      controller?.stop()
    }
  }, [])

  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/board/SyncEngineRunner.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/SyncEngineRunner.tsx components/board/SyncEngineRunner.test.tsx
rtk git commit -m "feat(sync): add headless background sync runner (pull-on-launch, revisit-gap pull)"
```

---

### Task 7: `SyncPanel.tsx` — the connect flow, status display, and error states

**Files:**
- Modify: `components/board/SyncPanel.tsx` (full rewrite of the `unlocked` branch; the `locked` branch and `submit()` key-activation logic are unchanged)
- Modify: `components/board/SyncPanel.module.css` (additive)
- Modify: `components/board/SyncPanel.test.tsx` (add new describe blocks; existing locked-view tests are unchanged)

**Interfaces:**
- Consumes: `loadSyncStatus`/`SyncStatus` from `@/lib/sync/sync-store` (Task 2), `runSyncCycle`/`connectSync`/`SyncCycleResult` from `@/lib/sync/engine` (Task 3), `requestAuthCode`/`exchangeCode` from `@/lib/sync/auth` (existing, untouched), `formatLastSynced` from `@/lib/sync/format-last-sync` (Task 1), `SyncMassDeleteConfirmDialog` (Task 5), all 20 new i18n keys (Task 4).
- Produces: no new exports beyond the existing `SyncPanel` component; new `data-testid`s: `sync-connect-button`, `sync-connecting`, `sync-connect-error`, `sync-connected-status`, `sync-last-synced`, `sync-now-button`, `sync-in-progress`, `sync-issue`, `sync-reconnect-button`.

- [ ] **Step 1: Write the failing tests**

Add to `components/board/SyncPanel.test.tsx`. First, extend the mocks at the top of the file:
```ts
import { loadSyncStatus } from '@/lib/sync/sync-store'
import { runSyncCycle, connectSync } from '@/lib/sync/engine'
import { requestAuthCode, exchangeCode } from '@/lib/sync/auth'

vi.mock('@/lib/sync/sync-store', () => ({ loadSyncStatus: vi.fn() }))
vi.mock('@/lib/sync/engine', () => ({ runSyncCycle: vi.fn(), connectSync: vi.fn() }))
vi.mock('@/lib/sync/auth', () => ({ requestAuthCode: vi.fn(), exchangeCode: vi.fn() }))

const mockLoadSyncStatus = vi.mocked(loadSyncStatus)
const mockRunSyncCycle = vi.mocked(runSyncCycle)
const mockConnectSync = vi.mocked(connectSync)
const mockRequestAuthCode = vi.mocked(requestAuthCode)
const mockExchangeCode = vi.mocked(exchangeCode)
```
And default `mockLoadSyncStatus` to a disconnected status in the existing `beforeEach`, so the pre-existing unlocked-view test (`shows the unlocked view directly when already unlocked on load`) keeps passing unchanged (it doesn't call `loadSyncStatus` today, but will now — the disconnected default matches the current UI's implicit assumption since that test only checks the outer `sync-unlocked` testid, not the connect-flow content):
```ts
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
  })
```

Then add a new `describe` block:
```ts
describe('SyncPanel connected states', () => {
  beforeEach(() => {
    mockLoadLicense.mockResolvedValue({ kid: 'k1', deviceId: 'd1', scope: ['sync'], validatedAt: 1 })
  })

  it('shows the connect explanation and button when unlocked but not connected', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    render(<SyncPanel />)
    await screen.findByTestId('sync-connect-button')
  })

  it('connects: requests a code, exchanges it, calls connectSync, and shows the idle connected view', async () => {
    mockRequestAuthCode.mockResolvedValue('auth-code')
    mockExchangeCode.mockResolvedValue({ accessToken: 'at', expiresAt: Date.now() + 100000, scope: 'drive.file' })
    mockConnectSync.mockResolvedValue({ status: 'synced', vaultConflict: false })
    // First call = initial mount (disconnected). Second call = applyResult's re-read after
    // connectSync resolves 'synced', to pick up the fresh connectedEmail/lastSyncAt.
    mockLoadSyncStatus
      .mockResolvedValueOnce({ connected: false, headRevisions: {} })
      .mockResolvedValueOnce({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    render(<SyncPanel />)
    await screen.findByTestId('sync-connect-button')
    fireEvent.click(screen.getByTestId('sync-connect-button'))
    await screen.findByTestId('sync-connected-status')
    expect(mockRequestAuthCode).toHaveBeenCalledTimes(1)
    expect(mockExchangeCode).toHaveBeenCalledWith('auth-code')
    expect(mockConnectSync).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('sync-connected-status').textContent).toContain('user@example.com')
  })

  it('shows connectFailed and the button again if requestAuthCode rejects (popup closed/cancelled)', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    mockRequestAuthCode.mockRejectedValue(new Error('popup closed'))
    render(<SyncPanel />)
    await screen.findByTestId('sync-connect-button')
    fireEvent.click(screen.getByTestId('sync-connect-button'))
    await screen.findByTestId('sync-connect-error')
    expect(screen.getByTestId('sync-connect-button')).toBeInTheDocument()
  })

  it('shows the idle connected view with last-synced text and a working sync-now button', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() - 5 * 60_000 })
    mockRunSyncCycle.mockResolvedValue({ status: 'synced', vaultConflict: false })
    render(<SyncPanel />)
    await screen.findByTestId('sync-connected-status')
    expect(screen.getByTestId('sync-last-synced').textContent).toMatch(/5/)
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await waitFor(() => expect(mockRunSyncCycle).toHaveBeenCalledTimes(1))
  })

  it('shows the SyncMassDeleteConfirmDialog when a manual sync returns needs-confirmation', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    mockRunSyncCycle.mockResolvedValue({ status: 'needs-confirmation', vaultConflict: false, deletedCount: 12 })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await screen.findByTestId('sync-mass-delete-dialog')
    expect(screen.getByTestId('sync-mass-delete-dialog').textContent).toContain('12')
  })

  it('CONTINUE on the mass-delete dialog re-runs the cycle with bypassMassDeleteGuard', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    mockRunSyncCycle
      .mockResolvedValueOnce({ status: 'needs-confirmation', vaultConflict: false, deletedCount: 12 })
      .mockResolvedValueOnce({ status: 'synced', vaultConflict: false })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await screen.findByTestId('sync-mass-delete-dialog')
    fireEvent.click(screen.getByTestId('sync-mass-delete-continue'))
    await waitFor(() => expect(mockRunSyncCycle).toHaveBeenCalledTimes(2))
    expect(mockRunSyncCycle).toHaveBeenLastCalledWith(expect.anything(), { bypassMassDeleteGuard: true })
  })

  it('shows the reconnect button and copy when the persisted lastIssue is an auth error', async () => {
    mockLoadSyncStatus.mockResolvedValue({
      connected: true, headRevisions: {}, connectedEmail: 'user@example.com',
      lastIssue: { kind: 'error', errorKind: 'auth' },
    })
    render(<SyncPanel />)
    await screen.findByTestId('sync-reconnect-button')
    expect(screen.getByTestId('sync-issue').textContent).toMatch(/reconnect|再接続|接続が切れました/i)
  })

  it('shows the storage-full message with a retry (sync-now) button', async () => {
    mockLoadSyncStatus.mockResolvedValue({
      connected: true, headRevisions: {}, connectedEmail: 'user@example.com',
      lastIssue: { kind: 'error', errorKind: 'storage-full' },
    })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    expect(screen.getByTestId('sync-issue')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/board/SyncPanel.test.tsx`
Expected: FAIL — current `SyncPanel.tsx` has none of these testids/behaviors.

- [ ] **Step 3: Implement**

Replace `components/board/SyncPanel.tsx` in full:
```tsx
'use client'

import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { initDB } from '@/lib/storage/indexeddb'
import { loadLicense } from '@/lib/board/license-store'
import { isSyncUnlocked } from '@/lib/board/theme-entitlement'
import { activateLicenseKey } from '@/lib/board/license-activate'
import { loadSyncStatus, type SyncStatus } from '@/lib/sync/sync-store'
import { runSyncCycle, connectSync, type SyncCycleResult } from '@/lib/sync/engine'
import { requestAuthCode, exchangeCode } from '@/lib/sync/auth'
import { formatLastSynced } from '@/lib/sync/format-last-sync'
import type { SyncErrorKind } from '@/lib/sync/error-kind'
import { SyncMassDeleteConfirmDialog } from './SyncMassDeleteConfirmDialog'
import styles from './SyncPanel.module.css'

type PanelPhase =
  | { readonly kind: 'disconnected' }
  | { readonly kind: 'connecting' }
  | { readonly kind: 'connect-failed' }
  | { readonly kind: 'idle'; readonly email: string | null; readonly lastSyncAt: number | undefined }
  | { readonly kind: 'syncing'; readonly email: string | null }
  | { readonly kind: 'needs-confirmation'; readonly email: string | null; readonly deletedCount: number }
  | { readonly kind: 'issue'; readonly email: string | null; readonly errorKind: SyncErrorKind }

function errorKeyFor(errorKind: SyncErrorKind): string {
  switch (errorKind) {
    case 'network': return 'sync.errorOffline'
    case 'auth': return 'sync.reconnectNeeded'
    case 'storage-full': return 'sync.errorStorageFull'
    case 'corrupt': return 'sync.errorCorrupt'
    default: return 'sync.errorGeneric'
  }
}

function phaseFromStatus(status: SyncStatus): PanelPhase {
  if (!status.connected) return { kind: 'disconnected' }
  const email = status.connectedEmail ?? null
  if (status.lastIssue?.kind === 'needs-confirmation') {
    return { kind: 'needs-confirmation', email, deletedCount: status.lastIssue.deletedCount }
  }
  if (status.lastIssue?.kind === 'error') {
    return { kind: 'issue', email, errorKind: status.lastIssue.errorKind }
  }
  return { kind: 'idle', email, lastSyncAt: status.lastSyncAt }
}

function lastSyncedText(t: (key: string) => string, lastSyncAt: number | undefined): string {
  const display = formatLastSynced(lastSyncAt, Date.now())
  if (display.kind === 'never' || display.kind === 'just-now') return t('sync.lastSyncedJustNow')
  if (display.kind === 'minutes') return t('sync.lastSyncedMinutesAgo').replace('{minutes}', String(display.value))
  if (display.kind === 'hours') return t('sync.lastSyncedHoursAgo').replace('{hours}', String(display.value))
  return t('sync.lastSyncedDaysAgo').replace('{days}', String(display.value))
}

export function SyncPanel(): ReactElement | null {
  const { t } = useI18n()
  const [unlocked, setUnlocked] = useState<boolean | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [capExceeded, setCapExceeded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [phase, setPhase] = useState<PanelPhase>({ kind: 'disconnected' })

  useEffect(() => {
    let cancelled = false
    void (async (): Promise<void> => {
      try {
        const db = await initDB()
        const state = await loadLicense(db)
        const isUnlocked = isSyncUnlocked(state)
        if (cancelled) return
        setUnlocked(isUnlocked)
        if (isUnlocked) {
          const status = await loadSyncStatus(db)
          if (!cancelled) setPhase(phaseFromStatus(status))
        }
      } catch (e) {
        console.error('[AllMarks] failed to load sync license state', e)
        if (!cancelled) setUnlocked(false)
      }
    })()
    return (): void => { cancelled = true }
  }, [])

  const applyResult = useCallback(async (result: SyncCycleResult, fallbackEmail: string | null): Promise<void> => {
    if (result.status === 'synced') {
      const db = await initDB()
      const status = await loadSyncStatus(db)
      setPhase({ kind: 'idle', email: status.connectedEmail ?? fallbackEmail, lastSyncAt: status.lastSyncAt })
    } else if (result.status === 'needs-confirmation') {
      setPhase({ kind: 'needs-confirmation', email: fallbackEmail, deletedCount: result.deletedCount ?? 0 })
    } else if (result.status === 'error') {
      setPhase({ kind: 'issue', email: fallbackEmail, errorKind: result.errorKind ?? 'other' })
    } else {
      setPhase({ kind: 'disconnected' })
    }
  }, [])

  const handleConnect = useCallback(async (): Promise<void> => {
    setPhase({ kind: 'connecting' })
    try {
      const code = await requestAuthCode()
      const tokens = await exchangeCode(code)
      const db = await initDB()
      const result = await connectSync(db, tokens)
      await applyResult(result, null)
    } catch (e) {
      console.error('[AllMarks] connect flow failed', e)
      setPhase({ kind: 'connect-failed' })
    }
  }, [applyResult])

  const handleSyncNow = useCallback(async (email: string | null): Promise<void> => {
    setPhase({ kind: 'syncing', email })
    try {
      const db = await initDB()
      const result = await runSyncCycle(db)
      await applyResult(result, email)
    } catch (e) {
      console.error('[AllMarks] manual sync failed', e)
      setPhase({ kind: 'issue', email, errorKind: 'other' })
    }
  }, [applyResult])

  const handleMassDeleteCancel = useCallback(async (email: string | null): Promise<void> => {
    try {
      const db = await initDB()
      const status = await loadSyncStatus(db)
      setPhase({ kind: 'idle', email: status.connectedEmail ?? email, lastSyncAt: status.lastSyncAt })
    } catch {
      setPhase({ kind: 'idle', email, lastSyncAt: undefined })
    }
  }, [])

  const handleMassDeleteContinue = useCallback(async (email: string | null): Promise<void> => {
    setPhase({ kind: 'syncing', email })
    try {
      const db = await initDB()
      const result = await runSyncCycle(db, { bypassMassDeleteGuard: true })
      await applyResult(result, email)
    } catch (e) {
      console.error('[AllMarks] confirmed sync failed', e)
      setPhase({ kind: 'issue', email, errorKind: 'other' })
    }
  }, [applyResult])

  const submit = async (): Promise<void> => {
    if (submitting) return
    const cleaned = keyInput.replace(/\s+/g, '')
    if (cleaned.length === 0) return
    setSubmitting(true)
    setError(null)
    setCapExceeded(false)
    try {
      const db = await initDB()
      const result = await activateLicenseKey(db, cleaned)
      setSubmitting(false)
      if (result.status === 'unlocked') {
        setUnlocked(true)
        const status = await loadSyncStatus(db)
        setPhase(phaseFromStatus(status))
        return
      }
      if (result.status === 'invalid-key') setError(t('sync.errorInvalidKey'))
      else if (result.status === 'unsupported') setError(t('sync.errorUnsupported'))
      else if (result.status === 'cap-exceeded') {
        setError(t('sync.errorCapExceeded'))
        setCapExceeded(true)
      }
    } catch (e) {
      console.error('[AllMarks] failed to activate sync license key', e)
      setSubmitting(false)
      setError(t('sync.errorActivateFailed'))
    }
  }

  if (unlocked === null) return null

  if (!unlocked) {
    return (
      <div data-testid="sync-locked">
        <p className={styles.body}>{t('sync.lockedExplanation')}</p>
        <span className={styles.soon} aria-disabled="true" data-testid="sync-become-supporter">
          {`${t('sync.becomeSupporter')} (${t('board.settings.comingSoon')})`}
        </span>
        <label className={styles.label} htmlFor="sync-key-input">{t('sync.haveKeyLabel')}</label>
        <div className={styles.keyRow}>
          <input
            id="sync-key-input"
            type="text"
            className={styles.keyInput}
            value={keyInput}
            onChange={(e): void => setKeyInput(e.target.value)}
            placeholder={t('sync.keyPlaceholder')}
            data-testid="sync-key-input"
          />
          <button
            type="button"
            className={styles.unlockBtn}
            onClick={(): void => { void submit() }}
            disabled={submitting || keyInput.trim().length === 0}
            data-testid="sync-key-submit"
          >
            {t('sync.unlockButton')}
          </button>
        </div>
        {error && (
          <div className={styles.error} data-testid="sync-key-error">
            {error}
            {capExceeded && (
              <>
                {' '}
                <a
                  className={styles.contactLink}
                  href="/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="sync-cap-exceeded-contact"
                >
                  {t('sync.errorCapExceededContact')}
                </a>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div data-testid="sync-unlocked">
      {phase.kind === 'disconnected' && (
        <>
          <p className={styles.body}>{t('sync.connectExplanation')}</p>
          <button type="button" className={styles.unlockBtn} onClick={(): void => { void handleConnect() }} data-testid="sync-connect-button">
            {t('sync.connectButton')}
          </button>
        </>
      )}
      {phase.kind === 'connecting' && (
        <div className={styles.status} data-testid="sync-connecting">
          <span className={styles.statusDot} data-pending="true" />
          {t('sync.connecting')}
        </div>
      )}
      {phase.kind === 'connect-failed' && (
        <>
          <div className={styles.error} data-testid="sync-connect-error">{t('sync.connectFailed')}</div>
          <button type="button" className={styles.unlockBtn} onClick={(): void => { void handleConnect() }} data-testid="sync-connect-button">
            {t('sync.connectButton')}
          </button>
        </>
      )}
      {phase.kind === 'idle' && (
        <>
          <div className={styles.status} data-testid="sync-connected-status">
            <span className={styles.statusDot} />
            {phase.email ? t('sync.connectedAs').replace('{email}', phase.email) : t('sync.connectedGeneric')}
          </div>
          <p className={styles.note} data-testid="sync-last-synced">{lastSyncedText(t, phase.lastSyncAt)}</p>
          <button type="button" className={styles.unlockBtn} onClick={(): void => { void handleSyncNow(phase.email) }} data-testid="sync-now-button">
            {t('sync.syncNowButton')}
          </button>
        </>
      )}
      {phase.kind === 'syncing' && (
        <div className={styles.status} data-testid="sync-in-progress">
          <span className={styles.statusDot} data-pending="true" />
          {t('sync.syncingNow')}
        </div>
      )}
      {phase.kind === 'needs-confirmation' && (
        <SyncMassDeleteConfirmDialog
          count={phase.deletedCount}
          onCancel={(): void => { void handleMassDeleteCancel(phase.email) }}
          onConfirm={(): void => { void handleMassDeleteContinue(phase.email) }}
        />
      )}
      {phase.kind === 'issue' && (
        <>
          <div className={styles.error} data-testid="sync-issue">{t(errorKeyFor(phase.errorKind))}</div>
          {phase.errorKind === 'auth' ? (
            <button type="button" className={styles.unlockBtn} onClick={(): void => { void handleConnect() }} data-testid="sync-reconnect-button">
              {t('sync.reconnectButton')}
            </button>
          ) : (
            <button type="button" className={styles.unlockBtn} onClick={(): void => { void handleSyncNow(phase.email) }} data-testid="sync-now-button">
              {t('sync.syncNowButton')}
            </button>
          )}
        </>
      )}
    </div>
  )
}
```

Append to `components/board/SyncPanel.module.css` (additive; nothing existing changes):
```css
.status[data-pending] .statusDot,
.statusDot[data-pending] {
  background: rgba(var(--chrome-ink-rgb), 0.4);
  box-shadow: none;
  animation: sync-pending-pulse 1.2s ease-in-out infinite;
}
@keyframes sync-pending-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.9; }
}
```
(The `data-pending="true"` attribute is set directly on `<span className={styles.statusDot} data-pending="true" />` in the JSX above, so both selectors above target the same element — the second, more specific selector is redundant with the CSS Modules-scoped class already implying `.status`'s child; kept for clarity since `.statusDot` may also be reused bare. This animation replaces the app-wide `@keyframes float` — it is a distinct, small, local keyframe scoped to this file, not reusing the global one, consistent with this file's existing self-contained style.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/board/SyncPanel.test.tsx`
Expected: PASS (all existing locked-view tests + all new connected-state tests).

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/SyncPanel.tsx components/board/SyncPanel.module.css components/board/SyncPanel.test.tsx
rtk git commit -m "feat(sync): implement the SyncPanel connect flow, status display, and error states"
```

---

### Task 8: Mount `SyncEngineRunner` in `BoardRoot`, full verification, and CURRENT_GOAL update

**Files:**
- Modify: `components/board/BoardRoot.tsx:159` (import) and `:3448-3450` (mount point)
- Modify: `docs/CURRENT_GOAL.md`
- Modify: `docs/TODO.md`

**Interfaces:**
- Consumes: `SyncEngineRunner` from `./SyncEngineRunner` (Task 6).
- No new exports.

- [ ] **Step 1: Add the import**

In `components/board/BoardRoot.tsx`, near the existing `import { BackupReminder } from './BackupReminder'` line, add:
```ts
import { SyncEngineRunner } from './SyncEngineRunner'
```

- [ ] **Step 2: Mount it unconditionally at the top of the returned JSX**

Find the component's main return statement:
```tsx
  return (
    <>
    <div
      ref={boardFrameRef}
      className={styles.outerFrame}
```
Change to:
```tsx
  return (
    <>
    <SyncEngineRunner />
    <div
      ref={boardFrameRef}
      className={styles.outerFrame}
```
This mounts it regardless of `loading`/`showOnboarding`/`showDataHomeCard` state — unlike `BackupReminder`, sync must run in the background even before the board has finished its first paint.

- [ ] **Step 3: Run BoardRoot's existing test suite to confirm no regression**

Run: `npx vitest run components/board/BoardRoot.test.tsx`
Expected: PASS (no assertions target the new runner; it renders `null` and its own effect is separately unit-tested in Task 6).

- [ ] **Step 4: Run the full test suite, typecheck, and build**

Run: `npx vitest run`
Expected: PASS, all files, no new failures vs. the pre-bundle baseline (2848 passing per `docs/TODO.md`'s s213 log — expect roughly 2848 + ~45 new tests from Tasks 1/2/3/5/6/7).

Run: `npx tsc --noEmit`
Expected: 0 errors.

Run: `rtk pnpm build`
Expected: exit code 0, no new warnings about unused exports/dead code.

- [ ] **Step 5: Update `docs/CURRENT_GOAL.md` and `docs/TODO.md`**

In `docs/CURRENT_GOAL.md`: replace the "★次セッション = 束6②(SyncPanel UI本体)・③" section's ②-related bullets with a note that ② is complete (connect flow, status display, error states, background runner all shipped, tests passing), and that ③ (vault-conflict UI, `isPrivateVault` tag dedup, EMPTY TRASH copy) is the sole remaining item, plus the still-open "★検討事項" (real-time sync) note stays as-is (not resolved by this bundle — still tracked).

In `docs/TODO.md`'s "現在の状態" section: append an `s214` entry (or next session number) summarizing this bundle's shipped scope, in the same narrative style as the existing `s213` entries, noting the deferred real-time-sync decision is still open.

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/BoardRoot.tsx docs/CURRENT_GOAL.md docs/TODO.md
rtk git commit -m "feat(sync): mount the background sync runner in BoardRoot; update session docs"
```

---

## Self-Review Notes (completed while writing this plan)

- **Spec coverage**: §7.1 initial-connect → Task 7's `handleConnect`. §7.2 pull triggers (launch, revisit>5min, manual) → Task 6 (launch, revisit) + Task 7 (manual `今すぐ同期`). §7.3 push triggers (debounce, hidden, beforeunload) → already built in `sync-controller.ts` (untouched), driven by Task 6's `controller.start()`; debounce-on-edit (`markDirty` call sites) explicitly deferred and tracked, not silently dropped. §8 error table → Task 1 (`classifySyncError`) + Task 3 (persistence) + Task 7 (display): corrupt→`errorCorrupt`, mass-delete→`SyncMassDeleteConfirmDialog`, token-expired→`reconnectButton`, network→silent-if-automatic/`errorOffline`-if-manual, Drive-full→`errorStorageFull`, push-failure→retried inside `engine.ts` already (Task 3 just classifies the final outcome). §9 Private/vault sync's "正直な代償" (strong-password guidance copy) and §6.6 (EMPTY TRASH copy) and vault-conflict UI are bundle ③, explicitly out of scope per Global Constraints.
- **Placeholder scan**: no TBD/"add error handling"/"similar to Task N" phrases; every step has literal code.
- **Type consistency**: `SyncErrorKind` defined once in Task 1, imported (never redefined) in Tasks 2/3/7. `SyncIssue` defined once in Task 2, imported in Task 3/7. `deletedCount`/`errorKind` field names match exactly between `engine.ts`'s `SyncCycleResult` (Task 3) and `SyncPanel.tsx`'s consumption (Task 7). `SyncMassDeleteConfirmDialog`'s prop is `count` (Task 5), and `SyncPanel.tsx` passes `phase.deletedCount` as `count` (Task 7) — matching.
