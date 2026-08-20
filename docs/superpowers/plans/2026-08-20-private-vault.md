# Private Vault (Phase 1: password lock) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-slot "Private" tag whose bookmarks are truly encrypted at rest (AES-GCM, password-derived key via PBKDF2), invisible everywhere in the app while locked, and never enter a SHARE unless the vault is unlocked and the user explicitly confirms.

**Architecture:** A small `lib/private/` module owns all crypto (Web Crypto `crypto.subtle` only, no new dependency) and an in-memory-only session singleton (never persisted — dies on reload, which is the re-lock mechanism). Existing data-layer functions (`applyFilter`, the board-item loader, `useTags`) gain a "is the Private tag visible right now" gate driven by that singleton. Existing UI (FilterPill, SETTINGS drawer, SHARE) gets small additive wiring, not rewrites.

**Tech Stack:** Web Crypto API (`crypto.subtle`, PBKDF2 + AES-GCM), React `useSyncExternalStore` for the cross-page session singleton, existing IndexedDB (`idb`) `settings` store — no new dependencies.

**Spec:** [docs/superpowers/specs/2026-08-20-private-vault-design.md](../specs/2026-08-20-private-vault-design.md)

## Global Constraints

- No new npm dependency — crypto is `crypto.subtle` only, biometrics are Phase 2 (not in this plan).
- No IndexedDB version bump — `DB_VERSION` stays 16 (all new fields are optional/additive; the `settings` store already exists).
- The vault key must never be written to IndexedDB, `localStorage`, `sessionStorage`, or any persistent store — memory only (a plain JS module variable), so a reload always re-locks.
- Exactly one `TagRecord` may ever have `isPrivateVault: true` — enforced in the setup-dialog flow (task 12), not a DB constraint.
- A Private-tagged item must never appear in `items`/tag lists while locked, and must never appear via any filter that doesn't explicitly include the Private tag id, even while unlocked.
- `rtk` prefix is a shell-command convenience for the user's terminal — do not use it inside test/implementation code; use plain `npx vitest run <path>` for verification (per this repo's own convention: vitest/playwright always run un-prefixed).
- Every new interactive dialog gets `data-no-capture` (SHARE auto-capture exclusion — see the bug this session already fixed in `BackupReminder.tsx`/`DataHomeCard.tsx` for the exact precedent).

---

## File Structure

New:
- `lib/private/crypto.ts` + `.test.ts` — PBKDF2 key derivation, AES-GCM encrypt/decrypt of JSON.
- `lib/private/vault-store.ts` + `.test.ts` — read/write the `settings` store's `private-vault` row; create/unlock orchestration.
- `lib/private/vault-session.ts` + `.test.ts` — in-memory-only session singleton + `usePrivateVaultSession()` hook.
- `lib/private/resolve-visibility.ts` + `.test.ts` — filters/decrypts `BookmarkRecord[]` for the board loader.
- `lib/private/apply-tag-change.ts` + `.test.ts` — encrypt-on-add / decrypt-on-remove when the Private tag is toggled.
- `components/board/PrivateSetupDialog.tsx` + `.module.css` + `.test.tsx` — first-time password + hint setup.
- `components/board/PrivateUnlockDialog.tsx` + `.module.css` + `.test.tsx` — password entry to unlock.
- `components/board/PrivateShareConfirmDialog.tsx` + `.module.css` + `.test.tsx` — "this share includes Private items" confirmation.

Modified:
- `lib/storage/indexeddb.ts` — `TagRecord.isPrivateVault`, `BookmarkRecord.encryptedPayload`, `TagInput` picks `isPrivateVault` too.
- `lib/storage/use-tags.ts` — hide the Private row from `tags` while locked; expose a lock-state-independent `privateTagId` (see Task 7 — this split matters, don't collapse it).
- `lib/board/filter.ts` — `applyFilter` gains a `privateTagId` containment gate.
- `lib/storage/use-board-data.ts` — factor the bookmarks→items builder into one function, thread it through `resolvePrivateVisibility`, accept `privateTagId`, react to session changes.
- `components/board/BoardRoot.tsx` — state + wiring (`privateTagId` sourced from `useTags()`, dialogs, `handleTagToggle` branch, `applyFilter`/`useBoardData` call sites, SHARE gate on both the desktop and mobile create paths).
- `components/board/ExtensionEntry.tsx` — new SETTINGS "PRIVATE" section.

---

### Task 1: Crypto core (`lib/private/crypto.ts`)

**Files:**
- Create: `lib/private/crypto.ts`
- Test: `lib/private/crypto.test.ts`

**Interfaces:**
- Produces: `PBKDF2_ITERATIONS: number`, `generateSalt(): string`, `deriveKey(password: string, saltB64: string, iterations?: number): Promise<CryptoKey>`, `encryptJson(key: CryptoKey, data: unknown): Promise<{ iv: string; ciphertext: string }>`, `decryptJson<T>(key: CryptoKey, iv: string, ciphertext: string): Promise<T>`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/private/crypto.test.ts
import { describe, it, expect } from 'vitest'
import { generateSalt, deriveKey, encryptJson, decryptJson, PBKDF2_ITERATIONS } from './crypto'

describe('private/crypto', () => {
  it('generateSalt returns a non-empty base64 string, different each call', () => {
    const a = generateSalt()
    const b = generateSalt()
    expect(a.length).toBeGreaterThan(0)
    expect(a).not.toBe(b)
  })

  it('encrypt then decrypt round-trips arbitrary JSON', async () => {
    const salt = generateSalt()
    const key = await deriveKey('correct horse battery staple', salt, PBKDF2_ITERATIONS)
    const original = { title: 'secret', n: 42, nested: { ok: true } }
    const { iv, ciphertext } = await encryptJson(key, original)
    const roundTripped = await decryptJson<typeof original>(key, iv, ciphertext)
    expect(roundTripped).toEqual(original)
  })

  it('two encryptions of the same data use different IVs', async () => {
    const salt = generateSalt()
    const key = await deriveKey('pw', salt, PBKDF2_ITERATIONS)
    const a = await encryptJson(key, { x: 1 })
    const b = await encryptJson(key, { x: 1 })
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('decrypting with the wrong password throws', async () => {
    const salt = generateSalt()
    const rightKey = await deriveKey('right', salt, PBKDF2_ITERATIONS)
    const wrongKey = await deriveKey('wrong', salt, PBKDF2_ITERATIONS)
    const { iv, ciphertext } = await encryptJson(rightKey, { secret: true })
    await expect(decryptJson(wrongKey, iv, ciphertext)).rejects.toThrow()
  })

  it('deriveKey is deterministic for the same password+salt+iterations', async () => {
    const salt = generateSalt()
    const key1 = await deriveKey('same pw', salt, 1000)
    const key2 = await deriveKey('same pw', salt, 1000)
    const { iv, ciphertext } = await encryptJson(key1, { a: 1 })
    // If key2 isn't byte-identical to key1, this decrypt fails.
    await expect(decryptJson(key2, iv, ciphertext)).resolves.toEqual({ a: 1 })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/private/crypto.test.ts`
Expected: FAIL — `./crypto` has no exports yet (module not found / undefined imports).

- [ ] **Step 3: Implement**

```ts
// lib/private/crypto.ts
// Web Crypto only (crypto.subtle) — no third-party crypto library. PBKDF2 for
// password -> key, AES-256-GCM for authenticated encryption (the GCM auth tag
// IS the "is this the right key" check — a wrong key/tampered ciphertext
// throws from subtle.decrypt rather than silently returning garbage).

/** OWASP Password Storage Cheat Sheet (2023) PBKDF2-SHA256 recommendation. */
export const PBKDF2_ITERATIONS = 600_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 16 random bytes, base64-encoded — pass to deriveKey as the PBKDF2 salt. */
export function generateSalt(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)))
}

/** Password -> non-extractable AES-256-GCM CryptoKey via PBKDF2-SHA256. The
 *  key is marked non-extractable so it can never be read back out of
 *  crypto.subtle once derived (defense in depth beyond "we just don't call
 *  the export API"). */
export async function deriveKey(
  password: string,
  saltB64: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: base64ToBytes(saltB64), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** JSON-serializes `data`, encrypts with AES-GCM under a fresh random IV
 *  (never reuse an IV with the same key). Returns base64 iv + ciphertext
 *  (ciphertext includes the GCM auth tag). */
export async function encryptJson(key: CryptoKey, data: unknown): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(cipherBuf)) }
}

/** Inverse of encryptJson. Throws (DOMException) if `key` is wrong or the
 *  ciphertext was tampered with — callers must catch and treat as "wrong
 *  password", never let this crash the caller. */
export async function decryptJson<T>(key: CryptoKey, iv: string, ciphertext: string): Promise<T> {
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext),
  )
  return JSON.parse(new TextDecoder().decode(plainBuf)) as T
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/private/crypto.test.ts`
Expected: PASS (5 tests). Note: PBKDF2 with 600,000 iterations takes real wall-clock time (tens to low-hundreds of ms per call in Node) — if the full suite feels slow, that's expected and correct, not a bug; do not lower `PBKDF2_ITERATIONS` to make tests faster (weakens production security). The `deriveKey is deterministic` test intentionally uses `1000` iterations to stay fast while still proving determinism.

- [ ] **Step 5: Commit**

```bash
git add lib/private/crypto.ts lib/private/crypto.test.ts
git commit -m "feat(private): AES-GCM + PBKDF2 crypto core for the Private vault"
```

---

### Task 2: Vault session singleton (`lib/private/vault-session.ts`)

Build this before the vault store so later tasks can type against `PrivateVaultSession`.

**Files:**
- Create: `lib/private/vault-session.ts`
- Test: `lib/private/vault-session.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `type PrivateVaultSession = { readonly tagId: string; readonly key: CryptoKey } | null`, `getPrivateVaultSession(): PrivateVaultSession`, `setPrivateVaultSession(session: PrivateVaultSession): void`, `usePrivateVaultSession(): PrivateVaultSession` (React hook).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/private/vault-session.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  getPrivateVaultSession,
  setPrivateVaultSession,
  usePrivateVaultSession,
  type PrivateVaultSession,
} from './vault-session'

const fakeKey = {} as CryptoKey

afterEach(() => {
  setPrivateVaultSession(null)
})

describe('private/vault-session', () => {
  it('defaults to null (locked)', () => {
    expect(getPrivateVaultSession()).toBeNull()
  })

  it('set then get round-trips the session', () => {
    const session: PrivateVaultSession = { tagId: 'tag-1', key: fakeKey }
    setPrivateVaultSession(session)
    expect(getPrivateVaultSession()).toEqual(session)
  })

  it('usePrivateVaultSession reflects the module singleton and re-renders on change', () => {
    const { result } = renderHook(() => usePrivateVaultSession())
    expect(result.current).toBeNull()
    act(() => {
      setPrivateVaultSession({ tagId: 'tag-2', key: fakeKey })
    })
    expect(result.current).toEqual({ tagId: 'tag-2', key: fakeKey })
  })

  it('two independent hook instances (simulating two mounted pages) both see the same session', () => {
    const a = renderHook(() => usePrivateVaultSession())
    const b = renderHook(() => usePrivateVaultSession())
    act(() => {
      setPrivateVaultSession({ tagId: 'tag-3', key: fakeKey })
    })
    expect(a.result.current).toEqual({ tagId: 'tag-3', key: fakeKey })
    expect(b.result.current).toEqual({ tagId: 'tag-3', key: fakeKey })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/private/vault-session.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/private/vault-session.ts
'use client'

import { useSyncExternalStore } from 'react'

/** The unlocked Private vault's tag id + decryption key, held ONLY in this
 *  module-scoped variable — never written to IndexedDB/localStorage/
 *  sessionStorage. A full page reload or tab close resets this module's
 *  state to null, which is the entire re-lock mechanism (see spec §5.3 —
 *  intentionally no separate "lock now" code path in Phase 1).
 *
 *  Deliberately a plain module singleton (not React Context): BoardRoot
 *  (/board) and TriagePage (/triage) are two independently-mounted route
 *  trees that each need to observe the same "is Private unlocked" state
 *  without a shared ancestor. A client-side route change between them does
 *  NOT reset this module (same JS runtime) — only a hard reload does, which
 *  is the desired "stays unlocked while you navigate the app this session"
 *  behavior. */
export type PrivateVaultSession = { readonly tagId: string; readonly key: CryptoKey } | null

let currentSession: PrivateVaultSession = null
const listeners = new Set<() => void>()

export function getPrivateVaultSession(): PrivateVaultSession {
  return currentSession
}

export function setPrivateVaultSession(session: PrivateVaultSession): void {
  currentSession = session
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return (): void => {
    listeners.delete(listener)
  }
}

/** Reactive read of the current session — re-renders the calling component
 *  whenever setPrivateVaultSession is called anywhere in the app. */
export function usePrivateVaultSession(): PrivateVaultSession {
  return useSyncExternalStore(subscribe, getPrivateVaultSession, () => null)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/private/vault-session.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/private/vault-session.ts lib/private/vault-session.test.ts
git commit -m "feat(private): in-memory-only vault session singleton (reload = re-lock)"
```

---

### Task 3: Vault store (`lib/private/vault-store.ts`)

**Files:**
- Create: `lib/private/vault-store.ts`
- Test: `lib/private/vault-store.test.ts`

**Interfaces:**
- Consumes: `deriveKey`, `encryptJson`, `decryptJson`, `generateSalt`, `PBKDF2_ITERATIONS` from `./crypto` (Task 1); `PrivateVaultSession` from `./vault-session` (Task 2).
- Produces: `type PrivateVaultRecord`, `loadVaultRecord(db): Promise<PrivateVaultRecord | null>`, `createVault(db, tagId, password, hint?): Promise<PrivateVaultSession>`, `unlockVault(db, password): Promise<PrivateVaultSession | null>` (null = wrong password or no vault yet).

Test setup note: this codebase's IDB tests open a real `idb` instance against `fake-indexeddb` (confirm the exact import by checking an existing `lib/storage/*.test.ts` that already does this, e.g. `lib/storage/use-tags.ts`'s own test file or `lib/storage/tags.ts`'s test file, for the precise `openDB`/`fake-indexeddb` setup boilerplate to copy — do this as the first sub-step of Step 1 below, don't guess the import path).

- [ ] **Step 1: Look up this repo's IDB-in-tests boilerplate, then write the failing tests**

Read `lib/storage/tags.test.ts` (or the nearest equivalent covering `addTagToBookmark`/`getAllTags`) to copy its exact `beforeEach`/db-setup pattern (likely `fake-indexeddb/auto` import + `openDB` against an in-memory name, or a shared test helper). Match that pattern exactly — do not invent a new one.

```ts
// lib/private/vault-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
// (copy the exact db-setup imports/helpers from lib/storage/tags.test.ts here)
import { loadVaultRecord, createVault, unlockVault } from './vault-store'

describe('private/vault-store', () => {
  // `db` set up in beforeEach using this repo's existing test-db helper.

  it('loadVaultRecord returns null before any vault exists', async () => {
    expect(await loadVaultRecord(db)).toBeNull()
  })

  it('createVault persists a record and returns an unlocked session', async () => {
    const session = await createVault(db, 'tag-abc', 'hunter2', 'my hint')
    expect(session).toEqual({ tagId: 'tag-abc', key: expect.anything() })
    const record = await loadVaultRecord(db)
    expect(record?.tagId).toBe('tag-abc')
    expect(record?.hint).toBe('my hint')
    expect(record?.salt.length).toBeGreaterThan(0)
  })

  it('unlockVault with the right password returns a session with the same tagId', async () => {
    await createVault(db, 'tag-abc', 'hunter2')
    const session = await unlockVault(db, 'hunter2')
    expect(session?.tagId).toBe('tag-abc')
  })

  it('unlockVault with the wrong password returns null (not a thrown error)', async () => {
    await createVault(db, 'tag-abc', 'hunter2')
    const session = await unlockVault(db, 'not-the-password')
    expect(session).toBeNull()
  })

  it('unlockVault before any vault exists returns null', async () => {
    const session = await unlockVault(db, 'anything')
    expect(session).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/private/vault-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/private/vault-store.ts
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
import type { IDBPDatabase } from 'idb'
import { PBKDF2_ITERATIONS, deriveKey, encryptJson, decryptJson, generateSalt } from './crypto'
import type { PrivateVaultSession } from './vault-session'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const VAULT_KEY = 'private-vault'
// Known plaintext used purely to verify a candidate password: if it decrypts
// (GCM auth passes), the password is right. Not secret itself.
const CHECK_PLAINTEXT = { ok: true } as const

export type PrivateVaultRecord = {
  readonly key: 'private-vault'
  readonly tagId: string
  readonly salt: string
  readonly iterations: number
  readonly checkIv: string
  readonly checkCiphertext: string
  readonly hint?: string
}

export async function loadVaultRecord(db: DbLike): Promise<PrivateVaultRecord | null> {
  const record = (await db.get('settings', VAULT_KEY)) as PrivateVaultRecord | undefined
  return record ?? null
}

/** First-time setup: derives a key from `password`, stores the vault record
 *  (salt/iterations/check-blob/hint — never the password itself), and
 *  returns an already-unlocked session for the caller to hand to
 *  setPrivateVaultSession. Overwrites any existing vault record — callers
 *  must ensure this is only reachable when no vault exists yet (Task 13). */
export async function createVault(
  db: DbLike,
  tagId: string,
  password: string,
  hint?: string,
): Promise<PrivateVaultSession> {
  const salt = generateSalt()
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const { iv: checkIv, ciphertext: checkCiphertext } = await encryptJson(key, CHECK_PLAINTEXT)
  const record: PrivateVaultRecord = {
    key: VAULT_KEY,
    tagId,
    salt,
    iterations: PBKDF2_ITERATIONS,
    checkIv,
    checkCiphertext,
    ...(hint ? { hint } : {}),
  }
  await db.put('settings', record)
  return { tagId, key }
}

/** Attempts to unlock with `password`. Returns null (never throws) when
 *  there's no vault yet OR the password is wrong — callers show the same
 *  "wrong password" message either way (no vault-not-found leak needed since
 *  the SETTINGS entry point already knows whether a vault exists). */
export async function unlockVault(db: DbLike, password: string): Promise<PrivateVaultSession | null> {
  const record = await loadVaultRecord(db)
  if (!record) return null
  const key = await deriveKey(password, record.salt, record.iterations)
  try {
    await decryptJson(key, record.checkIv, record.checkCiphertext)
  } catch {
    return null
  }
  return { tagId: record.tagId, key }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/private/vault-store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/private/vault-store.ts lib/private/vault-store.test.ts
git commit -m "feat(private): vault settings-store record + create/unlock orchestration"
```

---

### Task 4: Schema fields (`TagRecord.isPrivateVault`, `BookmarkRecord.encryptedPayload`)

**Files:**
- Modify: `lib/storage/indexeddb.ts:103-121` (`TagRecord`), `:17-97` (`BookmarkRecord`), `:124` (`TagInput`)
- Test: `lib/storage/tags.test.ts` (extend existing file — find it first; do not create a duplicate)

**Interfaces:**
- Produces: `TagRecord.isPrivateVault?: boolean`, `BookmarkRecord.encryptedPayload?: { iv: string; ciphertext: string }`, `TagInput` also picks `isPrivateVault`.

(No new query helper here — Task 7 derives "which tag is Private" from `useTags()`'s already-loaded in-memory state, and no other task needs a fresh DB-level lookup. Don't add one speculatively.)

- [ ] **Step 1: Write the failing test**

Read `lib/storage/tags.test.ts` first to match its existing style/db-setup, then add:

```ts
it('addTag accepts isPrivateVault and getAllTags round-trips it', async () => {
  const created = await addTag(db, { name: 'Private', color: '#000000', order: 0, isPrivateVault: true })
  expect(created.isPrivateVault).toBe(true)
  const all = await getAllTags(db)
  expect(all.find((t) => t.id === created.id)?.isPrivateVault).toBe(true)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/storage/tags.test.ts`
Expected: FAIL — `isPrivateVault` not assignable to `TagInput` (type error).

- [ ] **Step 3: Implement**

In `lib/storage/indexeddb.ts`, extend `TagRecord` (after `onboardingDemo?: boolean` at line 120):
```ts
  /** v16+: true on at most one tag — the "Private" vault tag (app-enforced
   *  singleton, not a DB constraint; see lib/private/vault-store.ts). Display
   *  name is freely renamable; this flag is what makes it the vault. */
  isPrivateVault?: boolean
```
Extend `TagInput` (line 124) to also allow it:
```ts
export type TagInput = Pick<TagRecord, 'name' | 'color' | 'order' | 'onboardingDemo' | 'isPrivateVault'>
```
Extend `BookmarkRecord` (after `lastCheckedAt?: number` around line 90):
```ts
  /** v16+: present only on bookmarks tagged Private. When present,
   *  title/url/description/thumbnail/favicon/siteName are stored as empty
   *  strings and the real values live only here, encrypted. iv/ciphertext
   *  are base64 (see lib/private/crypto.ts). Never decrypt-and-write-back —
   *  decrypted fields exist only transiently in memory
   *  (lib/private/resolve-visibility.ts). */
  encryptedPayload?: { readonly iv: string; readonly ciphertext: string }
```
Both are optional — no `DB_VERSION` bump (matches the existing `dominantColor`/`onboardingDemo` precedent already in this file).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/storage/tags.test.ts`
Expected: PASS (all existing tests + the new one). Also run `npx tsc --noEmit` to confirm the type extension didn't break any existing `TagInput` call site.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/indexeddb.ts lib/storage/tags.ts lib/storage/tags.test.ts
git commit -m "feat(private): TagRecord.isPrivateVault + BookmarkRecord.encryptedPayload schema"
```

---

### Task 5: Encrypt-on-add / decrypt-on-remove (`lib/private/apply-tag-change.ts`)

**Files:**
- Create: `lib/private/apply-tag-change.ts`
- Test: `lib/private/apply-tag-change.test.ts`

**Interfaces:**
- Consumes: `getBookmark`, `type BookmarkRecord` from `@/lib/storage/indexeddb`; `addTagToBookmark`, `removeTagFromBookmark` from `@/lib/storage/tags` (existing, [tags.ts:126-176]); `encryptJson`, `decryptJson` from `./crypto`; `PrivateVaultSession` from `./vault-session`.
- Produces: `addPrivateTag(db, bookmarkId, privateTagId, session): Promise<void>`, `removePrivateTag(db, bookmarkId, privateTagId, session): Promise<void>`. Both throw `Error('vault is locked')` if `session` is null — callers (Task 13's `handleTagToggle`) must only reach these while unlocked, since the Private tag is never selectable in the UI while locked anyway (defense in depth, not the primary guard).

- [ ] **Step 1: Write the failing tests**

Copy the same db-setup pattern used in Task 4's `lib/storage/tags.test.ts`.

```ts
// lib/private/apply-tag-change.test.ts
import { describe, it, expect } from 'vitest'
import { addBookmark } from '@/lib/storage/indexeddb'
import { addPrivateTag, removePrivateTag } from './apply-tag-change'
import { deriveKey, generateSalt } from './crypto'
import type { PrivateVaultSession } from './vault-session'

describe('private/apply-tag-change', () => {
  // db set up per the shared helper (Task 4 pattern)

  async function makeSession(): Promise<PrivateVaultSession> {
    const key = await deriveKey('pw', generateSalt(), 1000)
    return { tagId: 'private-tag-id', key }
  }

  it('addPrivateTag encrypts the sensitive fields and blanks the plaintext columns', async () => {
    const bookmark = await addBookmark(db, {
      url: 'https://example.com', title: 'My Title', description: 'desc',
      thumbnail: 'https://example.com/t.jpg', favicon: '', siteName: 'Example',
      type: 'website', ogpStatus: 'fetched',
    })
    const session = await makeSession()
    await addPrivateTag(db, bookmark.id, 'private-tag-id', session)
    const updated = await db.get('bookmarks', bookmark.id)
    expect(updated.title).toBe('')
    expect(updated.url).toBe('')
    expect(updated.encryptedPayload).toBeDefined()
    expect(updated.tags).toContain('private-tag-id')
  })

  it('removePrivateTag decrypts the fields back to plaintext and clears encryptedPayload', async () => {
    const bookmark = await addBookmark(db, {
      url: 'https://example.com', title: 'My Title', description: 'desc',
      thumbnail: '', favicon: '', siteName: 'Example', type: 'website', ogpStatus: 'fetched',
    })
    const session = await makeSession()
    await addPrivateTag(db, bookmark.id, 'private-tag-id', session)
    await removePrivateTag(db, bookmark.id, 'private-tag-id', session)
    const restored = await db.get('bookmarks', bookmark.id)
    expect(restored.title).toBe('My Title')
    expect(restored.url).toBe('https://example.com')
    expect(restored.encryptedPayload).toBeUndefined()
    expect(restored.tags).not.toContain('private-tag-id')
  })

  it('addPrivateTag throws if the vault is locked (session null)', async () => {
    const bookmark = await addBookmark(db, {
      url: 'https://example.com', title: 't', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website', ogpStatus: 'fetched',
    })
    await expect(addPrivateTag(db, bookmark.id, 'private-tag-id', null)).rejects.toThrow('locked')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/private/apply-tag-change.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/private/apply-tag-change.ts
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
import type { IDBPDatabase } from 'idb'
import { getBookmark } from '@/lib/storage/indexeddb'
import { addTagToBookmark, removeTagFromBookmark } from '@/lib/storage/tags'
import { encryptJson, decryptJson } from './crypto'
import type { PrivateVaultSession } from './vault-session'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type PrivateFields = {
  readonly title: string
  readonly url: string
  readonly description: string
  readonly thumbnail: string
  readonly favicon: string
  readonly siteName: string
}

const BLANK_FIELDS: PrivateFields = { title: '', url: '', description: '', thumbnail: '', favicon: '', siteName: '' }

/** Encrypts the bookmark's sensitive fields, blanks the plaintext columns,
 *  then adds the Private tag. Known limitation (documented, not fixed here):
 *  because `url` is blanked at rest, the URL-based dedupe check
 *  (saveBookmarkDeduped) can no longer see a Private bookmark's URL, so
 *  re-saving the same URL while it's privately stored will not be flagged
 *  as a duplicate. Acceptable for Phase 1 — revisit only if it bites someone
 *  in practice. */
export async function addPrivateTag(
  db: DbLike,
  bookmarkId: string,
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<void> {
  if (session === null) throw new Error('vault is locked')
  const bookmark = await getBookmark(db, bookmarkId)
  if (!bookmark) return
  const fields: PrivateFields = {
    title: bookmark.title,
    url: bookmark.url,
    description: bookmark.description,
    thumbnail: bookmark.thumbnail,
    favicon: bookmark.favicon,
    siteName: bookmark.siteName,
  }
  const encryptedPayload = await encryptJson(session.key, fields)
  await db.put('bookmarks', { ...bookmark, ...BLANK_FIELDS, encryptedPayload })
  await addTagToBookmark(db, bookmarkId, privateTagId)
}

/** Decrypts the bookmark's sensitive fields back to plaintext columns,
 *  clears encryptedPayload, then removes the Private tag. */
export async function removePrivateTag(
  db: DbLike,
  bookmarkId: string,
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<void> {
  if (session === null) throw new Error('vault is locked')
  const bookmark = await getBookmark(db, bookmarkId)
  if (!bookmark) return
  if (bookmark.encryptedPayload) {
    const fields = await decryptJson<PrivateFields>(
      session.key,
      bookmark.encryptedPayload.iv,
      bookmark.encryptedPayload.ciphertext,
    )
    const { encryptedPayload: _drop, ...rest } = bookmark
    await db.put('bookmarks', { ...rest, ...fields })
  }
  await removeTagFromBookmark(db, bookmarkId, privateTagId)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/private/apply-tag-change.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/private/apply-tag-change.ts lib/private/apply-tag-change.test.ts
git commit -m "feat(private): encrypt-on-tag / decrypt-on-untag for the Private tag"
```

---

### Task 6: Board-load visibility resolver (`lib/private/resolve-visibility.ts`)

**Files:**
- Create: `lib/private/resolve-visibility.ts`
- Test: `lib/private/resolve-visibility.test.ts`

**Interfaces:**
- Consumes: `type BookmarkRecord` from `@/lib/storage/indexeddb`; `decryptJson` from `./crypto`; `PrivateVaultSession` from `./vault-session`.
- Produces: `resolvePrivateVisibility(bookmarks: readonly BookmarkRecord[], privateTagId: string | null, session: PrivateVaultSession): Promise<BookmarkRecord[]>`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/private/resolve-visibility.test.ts
import { describe, it, expect } from 'vitest'
import { resolvePrivateVisibility } from './resolve-visibility'
import { deriveKey, encryptJson, generateSalt } from './crypto'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'
import type { PrivateVaultSession } from './vault-session'

function makeBookmark(overrides: Partial<BookmarkRecord>): BookmarkRecord {
  return {
    id: 'b1', url: 'https://example.com', title: 't', description: '', thumbnail: '',
    favicon: '', siteName: '', type: 'website', savedAt: new Date().toISOString(),
    ogpStatus: 'fetched', tags: [], ...overrides,
  }
}

describe('private/resolve-visibility', () => {
  it('passes through untagged bookmarks unchanged regardless of lock state', async () => {
    const b = makeBookmark({ tags: [] })
    const result = await resolvePrivateVisibility([b], 'priv-1', null)
    expect(result).toEqual([b])
  })

  it('returns everything unchanged when no Private tag exists yet (privateTagId null)', async () => {
    const b = makeBookmark({ tags: ['other-tag'] })
    const result = await resolvePrivateVisibility([b], null, null)
    expect(result).toEqual([b])
  })

  it('drops Private-tagged bookmarks entirely when locked', async () => {
    const b = makeBookmark({ tags: ['priv-1'], title: '', encryptedPayload: { iv: 'x', ciphertext: 'y' } })
    const result = await resolvePrivateVisibility([b], 'priv-1', null)
    expect(result).toEqual([])
  })

  it('decrypts and overlays Private-tagged bookmarks when unlocked', async () => {
    const key = await deriveKey('pw', generateSalt(), 1000)
    const session: PrivateVaultSession = { tagId: 'priv-1', key }
    const encryptedPayload = await encryptJson(key, {
      title: 'Real Title', url: 'https://secret.example', description: 'd', thumbnail: 'th', favicon: 'f', siteName: 's',
    })
    const b = makeBookmark({ tags: ['priv-1'], title: '', url: '', encryptedPayload })
    const [result] = await resolvePrivateVisibility([b], 'priv-1', session)
    expect(result.title).toBe('Real Title')
    expect(result.url).toBe('https://secret.example')
  })

  it('drops a Private-tagged bookmark that fails to decrypt (fail closed, not garbage)', async () => {
    const key = await deriveKey('pw', generateSalt(), 1000)
    const wrongKey = await deriveKey('other-pw', generateSalt(), 1000)
    const session: PrivateVaultSession = { tagId: 'priv-1', key: wrongKey }
    const encryptedPayload = await encryptJson(key, { title: 'x', url: 'y', description: '', thumbnail: '', favicon: '', siteName: '' })
    const b = makeBookmark({ tags: ['priv-1'], title: '', encryptedPayload })
    const result = await resolvePrivateVisibility([b], 'priv-1', session)
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/private/resolve-visibility.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/private/resolve-visibility.ts
import type { BookmarkRecord } from '@/lib/storage/indexeddb'
import { decryptJson } from './crypto'
import type { PrivateVaultSession } from './vault-session'

type PrivateFields = {
  readonly title: string
  readonly url: string
  readonly description: string
  readonly thumbnail: string
  readonly favicon: string
  readonly siteName: string
}

/** Board-load-time gate: drops Private-tagged bookmarks entirely while
 *  locked (they never reach BoardItem/toItem — indistinguishable from not
 *  existing), and overlays decrypted fields onto them while unlocked. Runs
 *  on the raw BookmarkRecord[] BEFORE the toItem mapping so no other code
 *  needs to know about encryptedPayload. Fails closed: a row that can't be
 *  decrypted (wrong key mid-transition, corruption) is dropped, never shown
 *  with garbage content. */
export async function resolvePrivateVisibility(
  bookmarks: readonly BookmarkRecord[],
  privateTagId: string | null,
  session: PrivateVaultSession,
): Promise<BookmarkRecord[]> {
  if (privateTagId === null) return [...bookmarks]
  const result: BookmarkRecord[] = []
  for (const b of bookmarks) {
    if (!b.tags.includes(privateTagId)) {
      result.push(b)
      continue
    }
    if (session === null) continue
    if (!b.encryptedPayload) {
      result.push(b)
      continue
    }
    try {
      const fields = await decryptJson<PrivateFields>(session.key, b.encryptedPayload.iv, b.encryptedPayload.ciphertext)
      result.push({ ...b, ...fields })
    } catch {
      continue
    }
  }
  return result
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/private/resolve-visibility.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/private/resolve-visibility.ts lib/private/resolve-visibility.test.ts
git commit -m "feat(private): board-load visibility resolver (drop-locked / decrypt-unlocked)"
```

---

### Task 7: `useTags()` hides the Private row while locked

**Files:**
- Modify: `lib/storage/use-tags.ts:1-117`
- Test: `lib/storage/use-tags.test.ts` (extend existing — check it exists first; if not, create colocated per this file's own convention)

**Interfaces:**
- Consumes: `usePrivateVaultSession` from `@/lib/private/vault-session` (Task 2).
- Produces: `useTags()` gains a new return field `privateTagId: string | null`, computed from the hook's UNFILTERED internal `rawTags` state (never itself hidden by lock state — see the note below on why this matters). The returned `tags` array excludes any `isPrivateVault: true` row whenever `usePrivateVaultSession()` is null.

**Important — this field must NOT be derived from the filtered `tags` array.** `tags` is deliberately hidden while locked (that's this task's whole point, for tag-LIST-rendering consumers like `FilterPill`/`TopTagStrip`). But `privateTagId` is consumed by different, lower-level code (Task 9's `useBoardData`, Task 13's `applyFilter` calls) that needs to know WHICH tag id to exclude — including while locked, which is precisely when exclusion matters most. If `privateTagId` were computed as `tags.find(t => t.isPrivateVault)?.id`, it would silently become `null` the instant the vault locks (because `tags` itself just dropped that row), which would make every downstream exclusion check believe there's no Private tag to hide at all — the exact opposite of the intended behavior, and a security bug, not a cosmetic one. Compute it from `rawTags` instead, which always contains every tag regardless of lock state (only the plaintext tag *name* is ever secret-adjacent here, and it isn't — only bookmark content is encrypted, per spec §3.1).

- [ ] **Step 1: Write the failing test**

```ts
// (add to lib/storage/use-tags.test.ts, or create it if it doesn't exist yet —
//  check first; match this repo's existing hook-test pattern, e.g. renderHook
//  + act + the same fake-indexeddb setup Task 3/4 used)
it('excludes the Private tag from the returned list while locked, includes it while unlocked', async () => {
  // seed one normal tag + one isPrivateVault tag directly via addTag(db, ...)
  // render useTags(), wait for loading to flip false
  // assert result.current.tags has length 1 (normal tag only)
  // act(() => setPrivateVaultSession({ tagId: privateTag.id, key: fakeKey }))
  // assert result.current.tags now has length 2
  // act(() => setPrivateVaultSession(null))
  // assert back to length 1
})

it('privateTagId is stable regardless of lock state (the bug this task must not reintroduce)', async () => {
  // seed one isPrivateVault tag, render useTags(), wait for loading false
  // assert result.current.privateTagId === privateTag.id  (locked)
  // act(() => setPrivateVaultSession({ tagId: privateTag.id, key: fakeKey }))
  // assert result.current.privateTagId === privateTag.id  (still the same, unlocked)
})

it('privateTagId is null when no Private tag has been created yet', async () => {
  // render useTags() with only normal tags seeded
  // assert result.current.privateTagId === null
})
```

(Write this against whatever db/render-hook harness the existing `use-tags` tests already use — read the file first rather than inventing a new harness.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/storage/use-tags.test.ts`
Expected: FAIL — Private tag still present while locked (no filtering yet), `privateTagId` not returned at all.

- [ ] **Step 3: Implement**

In `lib/storage/use-tags.ts`, add the import:
```ts
import { usePrivateVaultSession } from '@/lib/private/vault-session'
```
Change line 36 from:
```ts
  const tags = useMemo(() => sortTagsByMode(rawTags, orderMode), [rawTags, orderMode])
```
to:
```ts
  const privateSession = usePrivateVaultSession()
  // Computed from rawTags (UNFILTERED) — must stay resolvable while locked.
  // See this task's "Important" note above before changing this.
  const privateTagId = useMemo(
    () => rawTags.find((t) => t.isPrivateVault === true)?.id ?? null,
    [rawTags],
  )
  const tags = useMemo(() => {
    const sorted = sortTagsByMode(rawTags, orderMode)
    return privateSession === null ? sorted.filter((t) => t.isPrivateVault !== true) : sorted
  }, [rawTags, orderMode, privateSession])
```
Add `privateTagId` to the function's return type block (near the top, alongside the existing `tags: TagRecord[]` entry) and to the final `return { tags, loading, ... }` statement (`:116`):
```ts
return { tags, privateTagId, loading, orderMode, setOrderMode, create, rename, remove, reorder, reload }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/storage/use-tags.test.ts`
Expected: PASS. Also run `npx vitest run components/board` and `npx vitest run components/triage` to confirm nothing that consumes `useTags()` broke (both `FilterPill`/`BoardRoot` and `TopTagStrip`/`TriagePage` get the `tags` filtering for free — that's the point of centralizing it here — while `BoardRoot`, Task 13, switches to consuming the hook's own `privateTagId` instead of deriving one itself).

- [ ] **Step 5: Commit**

```bash
git add lib/storage/use-tags.ts lib/storage/use-tags.test.ts
git commit -m "feat(private): useTags hides the Private tag row while locked"
```

---

### Task 8: `applyFilter` containment gate

**Files:**
- Modify: `lib/board/filter.ts:1-26`
- Test: `lib/board/filter.test.ts` (extend existing if present, else create colocated)

**Interfaces:**
- Produces: `applyFilter(items, filter, privateTagId?: string | null): BoardItem[]` — `privateTagId` defaults to `null` so every existing call site keeps compiling and behaving identically without changes (only `BoardRoot.tsx`'s two call sites will be updated in Task 13 to actually pass it).

- [ ] **Step 1: Write the failing tests**

```ts
// add to lib/board/filter.test.ts
import { applyFilter } from './filter'
import type { BoardItem } from '@/lib/storage/use-board-data'

function item(overrides: Partial<BoardItem>): BoardItem {
  return {
    bookmarkId: 'b', cardId: 'c', title: 't', url: 'https://x', aspectRatio: 1,
    gridIndex: 0, orderIndex: 0, cardWidth: 240, customCardWidth: false,
    isRead: false, isDeleted: false, tags: [], displayMode: null, ...overrides,
  }
}

describe('applyFilter — Private containment', () => {
  const privateItem = item({ bookmarkId: 'priv', tags: ['priv-1', 'travel'] })
  const normalItem = item({ bookmarkId: 'norm', tags: ['travel'] })
  const items = [privateItem, normalItem]

  it('all: Private item never appears even when privateTagId is passed', () => {
    expect(applyFilter(items, { kind: 'all' }, 'priv-1').map((i) => i.bookmarkId)).toEqual(['norm'])
  })

  it('tags filter on a NON-private tag alone excludes the Private item', () => {
    const result = applyFilter(items, { kind: 'tags', tagIds: ['travel'], mode: 'or' }, 'priv-1')
    expect(result.map((i) => i.bookmarkId)).toEqual(['norm'])
  })

  it('tags filter that explicitly includes the Private tag id shows it', () => {
    const result = applyFilter(items, { kind: 'tags', tagIds: ['priv-1'], mode: 'or' }, 'priv-1')
    expect(result.map((i) => i.bookmarkId)).toEqual(['priv'])
  })

  it('tags filter combining Private + travel (AND) shows the Private item', () => {
    const result = applyFilter(items, { kind: 'tags', tagIds: ['priv-1', 'travel'], mode: 'and' }, 'priv-1')
    expect(result.map((i) => i.bookmarkId)).toEqual(['priv'])
  })

  it('privateTagId omitted (default null) preserves today\'s exact behavior', () => {
    const result = applyFilter(items, { kind: 'tags', tagIds: ['travel'], mode: 'or' })
    expect(result.map((i) => i.bookmarkId).sort()).toEqual(['norm', 'priv'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/board/filter.test.ts`
Expected: FAIL — `applyFilter` doesn't accept a third argument / Private item leaks through.

- [ ] **Step 3: Implement**

```ts
// lib/board/filter.ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/board/filter.test.ts`
Expected: PASS (all existing tests unchanged + 5 new).

- [ ] **Step 5: Commit**

```bash
git add lib/board/filter.ts lib/board/filter.test.ts
git commit -m "feat(private): applyFilter containment — Private items need an explicit Private filter"
```

---

### Task 9: `use-board-data.ts` — locked exclusion + decrypt overlay

**Files:**
- Modify: `lib/storage/use-board-data.ts:156-307` (hook signature + mount effect), `:633-651` (`reload`)
- Test: `lib/storage/use-board-data.test.ts` (extend existing — this file is referenced in memory as already covered; find and match its harness)

**Interfaces:**
- Consumes: `resolvePrivateVisibility` from `@/lib/private/resolve-visibility` (Task 6); `usePrivateVaultSession` from `@/lib/private/vault-session` (Task 2).
- Produces: `useBoardData(privateTagId: string | null = null): { ...same shape as today... }` — the new param DEFAULTS to `null` (same reasoning as Task 8's `applyFilter`): `BoardRoot.tsx`'s call site isn't updated to actually pass it until Task 13, three tasks later (Tasks 10-12 land first). A required param would leave the whole app failing `tsc --noEmit` for that entire window; a default keeps it green throughout and Task 13's edit is then just "start passing the real value," not "fix a break."

- [ ] **Step 1: Write the failing tests**

```ts
// add to lib/storage/use-board-data.test.ts
import { setPrivateVaultSession } from '@/lib/private/vault-session'
import { encryptJson, deriveKey, generateSalt } from '@/lib/private/crypto'

afterEach(() => {
  setPrivateVaultSession(null)
})

it('items excludes a bookmark tagged with privateTagId while locked', async () => {
  // seed one normal bookmark + one bookmark with tags: ['priv-1'] and a real encryptedPayload
  // (use addBookmark then db.put to attach encryptedPayload + blank fields, mirroring apply-tag-change's shape)
  const { result } = renderHook(() => useBoardData('priv-1'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.items.some((i) => i.tags.includes('priv-1'))).toBe(false)
})

it('items includes the decrypted bookmark once the vault session is set, and drops it again once cleared', async () => {
  const key = await deriveKey('pw', generateSalt(), 1000)
  const encryptedPayload = await encryptJson(key, {
    title: 'Real', url: 'https://secret.example', description: '', thumbnail: '', favicon: '', siteName: '',
  })
  // seed bookmark with tags: ['priv-1'], title: '', url: '', encryptedPayload
  setPrivateVaultSession({ tagId: 'priv-1', key })
  const { result } = renderHook(() => useBoardData('priv-1'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.items.find((i) => i.tags.includes('priv-1'))?.title).toBe('Real')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/storage/use-board-data.test.ts`
Expected: FAIL — `useBoardData` doesn't accept a param yet / Private item still visible while locked.

- [ ] **Step 3: Implement**

Factor the duplicated "bookmarks -> active/trashed BoardItem[]" logic (currently duplicated at `:282-300` and `:633-651`) into one function, and route it through `resolvePrivateVisibility`:

```ts
// near the top of the file, alongside toItem (after its definition, ~line 155)
import { resolvePrivateVisibility } from '@/lib/private/resolve-visibility'
import { usePrivateVaultSession, type PrivateVaultSession } from '@/lib/private/vault-session'

async function buildBoardItems(
  bookmarks: readonly BookmarkRecord[],
  cardByBookmark: ReadonlyMap<string, CardRecord>,
  privateTagId: string | null,
  session: PrivateVaultSession,
): Promise<{ active: BoardItem[]; trashed: BoardItem[] }> {
  const visible = await resolvePrivateVisibility(bookmarks, privateTagId, session)
  const active = visible
    .filter((b) => !b.isDeleted)
    .map((b) => toItem(b, cardByBookmark.get(b.id)))
    .sort((a, b) => b.orderIndex - a.orderIndex)
  const trashed = visible
    .filter((b) => b.isDeleted)
    .map((b) => toItem(b, cardByBookmark.get(b.id)))
    .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
  return { active, trashed }
}
```

Change the hook signature (`:156`) to `export function useBoardData(privateTagId: string | null = null): { ... }` (default `null` — same return type as before, no change to the type block itself). The default is load-bearing, not cosmetic: it's what keeps `BoardRoot.tsx`'s existing no-arg call site compiling through Tasks 10-12, before Task 13 updates it to pass the real value.

Inside the hook body, add near the top: `const privateSession = usePrivateVaultSession()`.

Replace the mount-effect block at `:282-300`:
```ts
      const bookmarks = await getAllBookmarks(db as Parameters<typeof getAllBookmarks>[0])
      const cards = (await db.getAll('cards')) as CardRecord[]
      const cardByBookmark = new Map<string, CardRecord>()
      for (const c of cards) cardByBookmark.set(c.bookmarkId, c)
      if (cancelled) return
      const { active, trashed } = await buildBoardItems(bookmarks, cardByBookmark, privateTagId, privateSession)
      if (cancelled) return
      setItems(active)
      setDeletedItems(trashed)
      setLoading(false)
```
(delete the two old `.filter().map().sort()` blocks and their "DESC by orderIndex" comment migrates onto `buildBoardItems`'s own comment — keep it there instead of duplicating).

Replace the `reload` callback at `:633-651`:
```ts
  const reload = useCallback(async (): Promise<void> => {
    const db = dbRef.current
    if (!db) return
    const bookmarks = await getAllBookmarks(db as Parameters<typeof getAllBookmarks>[0])
    const cards = (await db.getAll('cards')) as CardRecord[]
    const cardByBookmark = new Map<string, CardRecord>()
    for (const c of cards) cardByBookmark.set(c.bookmarkId, c)
    const { active, trashed } = await buildBoardItems(bookmarks, cardByBookmark, privateTagId, privateSession)
    setItems(active)
    setDeletedItems(trashed)
  }, [privateTagId, privateSession])
```

Add a new effect right after the mount effect so unlocking/locking mid-session refreshes `items` without waiting for some unrelated `reload()` call:
```ts
  useEffect(() => {
    if (!dbRef.current) return
    void reload()
    // Only re-run when the lock state itself changes — reload is already
    // memoized on [privateTagId, privateSession] so this stays in sync.
  }, [privateSession, privateTagId, reload])
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/storage/use-board-data.test.ts`
Expected: PASS (all existing tests unchanged + 2 new). Because the new param defaults to `null`, existing tests that call `useBoardData()` with no args keep compiling and behaving identically (no call-site fixes needed in the test file, unlike a required param would force) — confirm this by running the full existing `use-board-data.test.ts` suite, not just the two new tests.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/use-board-data.ts lib/storage/use-board-data.test.ts
git commit -m "feat(private): board loader excludes locked Private items, decrypts when unlocked"
```

---

### Task 10: `PrivateSetupDialog` + `PrivateUnlockDialog`

**Files:**
- Create: `components/board/PrivateSetupDialog.tsx`, `.module.css`, `.test.tsx`
- Create: `components/board/PrivateUnlockDialog.tsx`, `.module.css`, `.test.tsx`

**Interfaces:**
- Consumes: `createVault`, `unlockVault` from `@/lib/private/vault-store` (Task 3).
- Produces:
  - `PrivateSetupDialog({ onCreate, onCancel }: { onCreate: (password: string, hint?: string) => void; onCancel: () => void })` — pure presentational; password/hint state lives inside the dialog, `onCreate` fires with the final values (the caller in `BoardRoot.tsx`, Task 13, does the actual `createVault` DB call + `setPrivateVaultSession`).
  - `PrivateUnlockDialog({ hint, onSubmit, onCancel }: { hint?: string; onSubmit: (password: string) => Promise<boolean>; onCancel: () => void })` — `onSubmit` returns whether the password was right (caller does the actual `unlockVault` call); on `false` the dialog shows an inline "パスワードが違います" error and does not close.

Both follow `components/board/TrashConfirmDialog.tsx`'s structure (`role="dialog" aria-modal="true"`, backdrop `onClick`=cancel, panel `onClick` stops propagation, Esc=cancel) but WITHOUT its 2-second hold mechanic (that's specific to irreversible deletes) — a plain form + submit button. Both carry `data-no-capture` on the outermost element (this session's `BackupReminder.tsx`/`DataHomeCard.tsx` fix is the precedent for why).

- [ ] **Step 1: Write the failing tests**

```tsx
// components/board/PrivateSetupDialog.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivateSetupDialog } from './PrivateSetupDialog'

describe('PrivateSetupDialog', () => {
  it('carries data-no-capture', () => {
    render(<PrivateSetupDialog onCreate={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog').hasAttribute('data-no-capture')).toBe(true)
  })

  it('does not call onCreate until password and confirm match and are non-empty', () => {
    const onCreate = vi.fn()
    render(<PrivateSetupDialog onCreate={onCreate} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('calls onCreate with the password and optional hint once confirmed', () => {
    const onCreate = vi.fn()
    render(<PrivateSetupDialog onCreate={onCreate} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'hunter2' } })
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: 'hunter2' } })
    fireEvent.change(screen.getByLabelText(/hint/i), { target: { value: 'my hint' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    expect(onCreate).toHaveBeenCalledWith('hunter2', 'my hint')
  })

  it('shows a mismatch error and does not call onCreate when passwords differ', () => {
    const onCreate = vi.fn()
    render(<PrivateSetupDialog onCreate={onCreate} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'a' } })
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: 'b' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    expect(onCreate).not.toHaveBeenCalled()
    expect(screen.getByText(/match/i)).toBeInTheDocument()
  })

  it('CANCEL fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateSetupDialog onCreate={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

```tsx
// components/board/PrivateUnlockDialog.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PrivateUnlockDialog } from './PrivateUnlockDialog'

describe('PrivateUnlockDialog', () => {
  it('carries data-no-capture', () => {
    render(<PrivateUnlockDialog onSubmit={vi.fn().mockResolvedValue(true)} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog').hasAttribute('data-no-capture')).toBe(true)
  })

  it('shows the hint text when provided', () => {
    render(<PrivateUnlockDialog hint="my hint" onSubmit={vi.fn().mockResolvedValue(true)} onCancel={vi.fn()} />)
    expect(screen.getByText('my hint')).toBeInTheDocument()
  })

  it('calls onSubmit with the entered password', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    render(<PrivateUnlockDialog onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'hunter2' } })
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('hunter2'))
  })

  it('shows an error and stays open when onSubmit resolves false', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false)
    render(<PrivateUnlockDialog onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    await waitFor(() => expect(screen.getByText(/wrong/i)).toBeInTheDocument())
  })

  it('CANCEL fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateUnlockDialog onSubmit={vi.fn().mockResolvedValue(true)} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/board/PrivateSetupDialog.test.tsx components/board/PrivateUnlockDialog.test.tsx`
Expected: FAIL — components don't exist.

- [ ] **Step 3: Implement**

```tsx
// components/board/PrivateSetupDialog.tsx
'use client'

import { useState, type ReactElement } from 'react'
import styles from './PrivateSetupDialog.module.css'

type Props = {
  readonly onCreate: (password: string, hint?: string) => void
  readonly onCancel: () => void
}

export function PrivateSetupDialog({ onCreate, onCancel }: Props): ReactElement {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (): void => {
    if (password.length === 0) {
      setError('Enter a password.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    onCreate(password, hint.length > 0 ? hint : undefined)
  }

  return (
    <div
      className={styles.backdrop}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-setup-heading"
      data-testid="private-setup-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-setup-heading" className={styles.heading}>SET UP PRIVATE</div>
        <label className={styles.label} htmlFor="private-setup-password">Password</label>
        <input
          id="private-setup-password"
          type="password"
          className={styles.input}
          value={password}
          onChange={(e): void => setPassword(e.target.value)}
        />
        <label className={styles.label} htmlFor="private-setup-confirm">Confirm password</label>
        <input
          id="private-setup-confirm"
          type="password"
          className={styles.input}
          value={confirm}
          onChange={(e): void => setConfirm(e.target.value)}
        />
        <label className={styles.label} htmlFor="private-setup-hint">Hint (optional)</label>
        <input
          id="private-setup-hint"
          type="text"
          className={styles.input}
          value={hint}
          onChange={(e): void => setHint(e.target.value)}
        />
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} data-testid="private-setup-cancel">
            CANCEL
          </button>
          <button type="button" className={styles.createBtn} onClick={submit} data-testid="private-setup-create">
            CREATE
          </button>
        </div>
      </div>
    </div>
  )
}
```

```css
/* components/board/PrivateSetupDialog.module.css */
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
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.heading { font-size: 13px; letter-spacing: 0.08em; color: #f2f2f2; margin-bottom: 8px; }
.label { font-size: 12px; color: rgba(242, 242, 242, 0.7); margin-top: 8px; }
.input {
  font-size: 14px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #f2f2f2;
}
.error { font-size: 12px; color: #ff6b6b; margin-top: 4px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.cancelBtn, .createBtn {
  font-size: 12px;
  letter-spacing: 0.06em;
  padding: 7px 14px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: transparent;
  color: #f2f2f2;
  cursor: pointer;
}
.createBtn { border-color: rgba(40, 241, 0, 0.55); }
```

```tsx
// components/board/PrivateUnlockDialog.tsx
'use client'

import { useState, type ReactElement } from 'react'
import styles from './PrivateUnlockDialog.module.css'

type Props = {
  readonly hint?: string
  readonly onSubmit: (password: string) => Promise<boolean>
  readonly onCancel: () => void
}

export function PrivateUnlockDialog({ hint, onSubmit, onCancel }: Props): ReactElement {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (): Promise<void> => {
    setSubmitting(true)
    const ok = await onSubmit(password)
    setSubmitting(false)
    if (!ok) setError('Wrong password.')
  }

  return (
    <div
      className={styles.backdrop}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-unlock-heading"
      data-testid="private-unlock-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-unlock-heading" className={styles.heading}>UNLOCK PRIVATE</div>
        {hint && <div className={styles.hint}>{hint}</div>}
        <label className={styles.label} htmlFor="private-unlock-password">Password</label>
        <input
          id="private-unlock-password"
          type="password"
          className={styles.input}
          value={password}
          onChange={(e): void => setPassword(e.target.value)}
          onKeyDown={(e): void => { if (e.key === 'Enter') void submit() }}
        />
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} data-testid="private-unlock-cancel">
            CANCEL
          </button>
          <button
            type="button"
            className={styles.unlockBtn}
            onClick={(): void => { void submit() }}
            disabled={submitting}
            data-testid="private-unlock-submit"
          >
            UNLOCK
          </button>
        </div>
      </div>
    </div>
  )
}
```

```css
/* components/board/PrivateUnlockDialog.module.css */
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
  width: min(340px, calc(100% - 32px));
  background: rgba(20, 20, 20, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.heading { font-size: 13px; letter-spacing: 0.08em; color: #f2f2f2; margin-bottom: 4px; }
.hint { font-size: 12px; color: rgba(242, 242, 242, 0.6); font-style: italic; margin-bottom: 8px; }
.label { font-size: 12px; color: rgba(242, 242, 242, 0.7); margin-top: 4px; }
.input {
  font-size: 14px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #f2f2f2;
}
.error { font-size: 12px; color: #ff6b6b; margin-top: 4px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.cancelBtn, .unlockBtn {
  font-size: 12px;
  letter-spacing: 0.06em;
  padding: 7px 14px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: transparent;
  color: #f2f2f2;
  cursor: pointer;
}
.unlockBtn { border-color: rgba(40, 241, 0, 0.55); }
.unlockBtn:disabled { opacity: 0.5; cursor: default; }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/board/PrivateSetupDialog.test.tsx components/board/PrivateUnlockDialog.test.tsx`
Expected: PASS (5 + 5 tests).

- [ ] **Step 5: Commit**

```bash
git add components/board/PrivateSetupDialog.tsx components/board/PrivateSetupDialog.module.css components/board/PrivateSetupDialog.test.tsx components/board/PrivateUnlockDialog.tsx components/board/PrivateUnlockDialog.module.css components/board/PrivateUnlockDialog.test.tsx
git commit -m "feat(private): setup + unlock dialogs"
```

---

### Task 11: `PrivateShareConfirmDialog`

**Files:**
- Create: `components/board/PrivateShareConfirmDialog.tsx`, `.module.css`, `.test.tsx`

**Interfaces:**
- Produces: `PrivateShareConfirmDialog({ count, onConfirm, onCancel }: { count: number; onConfirm: () => void; onCancel: () => void })`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/board/PrivateShareConfirmDialog.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivateShareConfirmDialog } from './PrivateShareConfirmDialog'

describe('PrivateShareConfirmDialog', () => {
  it('carries data-no-capture and shows the count', () => {
    render(<PrivateShareConfirmDialog count={2} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.hasAttribute('data-no-capture')).toBe(true)
    expect(dialog.textContent).toContain('2')
  })

  it('SHARE fires onConfirm', () => {
    const onConfirm = vi.fn()
    render(<PrivateShareConfirmDialog count={1} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /share/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('CANCEL fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateShareConfirmDialog count={1} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('backdrop click fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateShareConfirmDialog count={1} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/board/PrivateShareConfirmDialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/board/PrivateShareConfirmDialog.tsx
'use client'

import type { ReactElement } from 'react'
import styles from './PrivateShareConfirmDialog.module.css'

type Props = {
  readonly count: number
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function PrivateShareConfirmDialog({ count, onConfirm, onCancel }: Props): ReactElement {
  return (
    <div
      className={styles.backdrop}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-share-confirm-heading"
      data-testid="private-share-confirm-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-share-confirm-heading" className={styles.heading}>SHARE INCLUDES PRIVATE</div>
        <div className={styles.body}>
          This selection includes {count} {count === 1 ? 'item' : 'items'} from Private. Share anyway?
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} data-testid="private-share-confirm-cancel">
            CANCEL
          </button>
          <button type="button" className={styles.shareBtn} onClick={onConfirm} data-testid="private-share-confirm-share">
            SHARE
          </button>
        </div>
      </div>
    </div>
  )
}
```

```css
/* components/board/PrivateShareConfirmDialog.module.css */
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
.heading { font-size: 13px; letter-spacing: 0.08em; color: #f2f2f2; margin-bottom: 8px; }
.body { font-size: 13px; line-height: 1.5; color: rgba(242, 242, 242, 0.85); }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.cancelBtn, .shareBtn {
  font-size: 12px;
  letter-spacing: 0.06em;
  padding: 7px 14px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: transparent;
  color: #f2f2f2;
  cursor: pointer;
}
.shareBtn { border-color: rgba(40, 241, 0, 0.55); }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/board/PrivateShareConfirmDialog.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/board/PrivateShareConfirmDialog.tsx components/board/PrivateShareConfirmDialog.module.css components/board/PrivateShareConfirmDialog.test.tsx
git commit -m "feat(private): share confirmation dialog for unlocked Private items"
```

---

### Task 12: SETTINGS entry point (`ExtensionEntry.tsx`)

**Files:**
- Modify: `components/board/ExtensionEntry.tsx:180-356` (add a new `<section>`)
- Test: `components/board/ExtensionEntry.test.tsx` (extend existing — check it exists; this component is covered by `chrome-theme-coverage.test.tsx` / its own tests per the Task-1-era grep, find the right file first)

**Interfaces:**
- Consumes: nothing new from `lib/private` directly — this component only renders a button and reports clicks upward; all vault logic stays in `BoardRoot.tsx` (Task 13).
- Produces: `ExtensionEntry` gains two new props: `privateStatus: 'none' | 'locked' | 'unlocked'` and `onOpenPrivate: () => void`.

- [ ] **Step 1: Write the failing test**

```tsx
// add to components/board/ExtensionEntry.test.tsx (match its existing render-props pattern)
it('renders a PRIVATE entry that calls onOpenPrivate when clicked', () => {
  const onOpenPrivate = vi.fn()
  render(<ExtensionEntry {...baseProps} privateStatus="none" onOpenPrivate={onOpenPrivate} isOpen onOpenChange={vi.fn()} />)
  fireEvent.click(screen.getByTestId('private-entry-button'))
  expect(onOpenPrivate).toHaveBeenCalledTimes(1)
})

it('shows a locked vs unlocked indicator based on privateStatus', () => {
  const { rerender } = render(<ExtensionEntry {...baseProps} privateStatus="locked" onOpenPrivate={vi.fn()} isOpen onOpenChange={vi.fn()} />)
  expect(screen.getByTestId('private-entry-button').textContent).toMatch(/private/i)
  rerender(<ExtensionEntry {...baseProps} privateStatus="unlocked" onOpenPrivate={vi.fn()} isOpen onOpenChange={vi.fn()} />)
  expect(screen.getByTestId('private-entry-button').getAttribute('data-unlocked')).toBe('true')
})
```

(`baseProps` should reuse whatever fixture the existing `ExtensionEntry.test.tsx` already builds for its other required props — read that file first.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/board/ExtensionEntry.test.tsx`
Expected: FAIL — `privateStatus`/`onOpenPrivate` not accepted, `private-entry-button` not found.

- [ ] **Step 3: Implement**

Read `components/board/ExtensionEntry.tsx` lines 1-60 first to see its existing `Props` type shape and copy its style exactly. Add to `Props`:
```ts
  readonly privateStatus: 'none' | 'locked' | 'unlocked'
  readonly onOpenPrivate: () => void
```
Destructure them in the component's param list alongside the existing props. Add a new section between the existing LAYOUT (`:243-274`) and THEME (`:276-291`) sections, following the same `<section className={styles.group}>` shape those use:
```tsx
<section className={styles.group}>
  <div className={styles.groupLabel}>PRIVATE</div>
  <button
    type="button"
    className={styles.actionBtn}
    onClick={onOpenPrivate}
    data-testid="private-entry-button"
    data-unlocked={privateStatus === 'unlocked' ? 'true' : undefined}
    disabled={privateStatus === 'unlocked'}
  >
    {privateStatus === 'unlocked' ? '🔓 PRIVATE (UNLOCKED)' : '🔒 PRIVATE'}
  </button>
</section>
```
(`styles.group`/`styles.groupLabel`/`styles.actionBtn` — reuse whatever class names the LAYOUT section already uses for its own buttons; read that section first and match exactly rather than inventing new class names.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/board/ExtensionEntry.test.tsx`
Expected: PASS (existing tests + 2 new). Also run `npx tsc --noEmit` — the new required props mean `BoardRoot.tsx`'s existing `<ExtensionEntry ...>` call (currently `:3397-3410`) will now fail to type-check until Task 13 adds them; that's expected at this point in the plan (Task 13 fixes it in the same PR-equivalent branch before the branch is considered done — do not merge Task 12 alone to a shared branch without Task 13).

- [ ] **Step 5: Commit**

```bash
git add components/board/ExtensionEntry.tsx components/board/ExtensionEntry.test.tsx
git commit -m "feat(private): PRIVATE entry button in the SETTINGS drawer"
```

---

### Task 13: `BoardRoot.tsx` wiring

This is the integration task — it has no new pure logic of its own, so it's verified by the existing BoardRoot test suite plus the new e2e test in Task 15, not new unit tests. Read the whole diff carefully; this file is large and every anchor below was verified against the current file, but re-check line numbers before editing since earlier tasks in this plan do NOT touch `BoardRoot.tsx` (only Task 13 does), so line numbers should still match — if they don't (e.g. because Task 12 or an unrelated change shifted things), search for the quoted code snippets instead of trusting the numbers blindly.

**Files:**
- Modify: `components/board/BoardRoot.tsx` at: `:255-258` (useTags destructure), `:1090-1091` (applyFilter calls), `:1631-1668` (handleTagToggle), `:2599-2632` (handleCreateHostedShare -> proceedCreateHostedShare), `:2730-2845` (handleMobileCaptureAndCreate -> proceedMobileCaptureAndCreate), `:3397-3410` (ExtensionEntry props). No change needed at `:3192-3215` (FilterPill already receives `tags`, which Task 7 already filters).
- Before starting, re-grep `components/board/BoardRoot.tsx` for `useBoardData(`, `applyFilter(`, and `createHostedShare(` to confirm the line numbers/call-site count above still match — this file changes often and earlier tasks in this plan do not touch it, so drift can only come from work outside this plan.

**Interfaces:**
- Consumes: everything from Tasks 1-12.

- [ ] **Step 1: Add state + derived values**

Near the `useTags()` destructure at `:255-258`, add:
```ts
import { usePrivateVaultSession, setPrivateVaultSession } from '@/lib/private/vault-session'
import { createVault, unlockVault, loadVaultRecord } from '@/lib/private/vault-store'
import { addPrivateTag, removePrivateTag } from '@/lib/private/apply-tag-change'
import { PrivateSetupDialog } from './PrivateSetupDialog'
import { PrivateUnlockDialog } from './PrivateUnlockDialog'
import { PrivateShareConfirmDialog } from './PrivateShareConfirmDialog'
```
Also add `privateTagId` to the existing `useTags()` destructure at `:255-258` (Task 7 now returns it — do NOT derive it separately from `tags` here; `tags` is locked-filtered by Task 7 and re-deriving from it would make `privateTagId` go null exactly when it's needed most — see Task 7's "Important" note):
```ts
const {
  tags, privateTagId, create: createTag, reload: reloadTags, remove: removeTag, rename: renameTag, reorder: reorderTags,
  orderMode: tagOrderMode, setOrderMode: setTagOrderMode,
} = useTags()
```
```ts
const privateSession = usePrivateVaultSession()
const [privateDialog, setPrivateDialog] = useState<'setup' | 'unlock' | null>(null)
const [privateHint, setPrivateHint] = useState<string | undefined>(undefined)
const [pendingPrivateShare, setPendingPrivateShare] = useState<{ count: number; resume: 'desktop' | 'mobile' } | null>(null)
```

- [ ] **Step 2: Thread `privateTagId` into `useBoardData` and `applyFilter`**

Change `:254` (the `useBoardData()` call — confirm exact current line via grep for `= useBoardData(`) to `useBoardData(privateTagId)`.

Change `:1090-1091`:
```ts
    if (activeFilter.kind === 'tags') return applyFilter(items, BOARD_FILTER_ALL, privateTagId)
    return applyFilter(items, activeFilter, privateTagId)
```

- [ ] **Step 3: Branch `handleTagToggle`/`handleTagCreate` for the Private tag**

Current code (verified, `BoardRoot.tsx:1631-1668`):
```ts
const handleTagToggle = useCallback(
  async (bookmarkId: string, tagId: string): Promise<void> => {
    const item = items.find((it) => it.bookmarkId === bookmarkId)
    if (!item) return
    const db = await initDB()
    if (item.tags.includes(tagId)) {
      await removeTagFromBookmark(db, bookmarkId, tagId)
    } else {
      await addTagToBookmark(db, bookmarkId, tagId)
      setTagAddedTick((t) => t + 1)
    }
    await reload()
  },
  [items, reload],
)

const handleTagCreate = useCallback(
  async (bookmarkId: string, name: string): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return
    const db = await initDB()
    const existing = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    const target = existing ?? (await addTag(db, {
      name: trimmed, color: '#28F100', order: tags.length,
      ...(onboardingActiveRef.current ? { onboardingDemo: true } : {}),
    }))
    await addTagToBookmark(db, bookmarkId, target.id)
    setTagAddedTick((t) => t + 1)
    await reloadTags()
    await reload()
  },
  [tags, reload, reloadTags],
)
```
`handleTagCreate` only ever creates/reuses a NORMAL tag (it always calls plain `addTagToBookmark`, never touches `isPrivateVault`) — the Private tag is created exclusively by the setup dialog flow (Step 4 below), never through this path, so `handleTagCreate` needs no change. Only `handleTagToggle` needs the branch, since that's the one path that can add/remove ANY existing tag id — including the Private one, once it's visible in the tag UI post-unlock:
```ts
const handleTagToggle = useCallback(
  async (bookmarkId: string, tagId: string): Promise<void> => {
    const item = items.find((it) => it.bookmarkId === bookmarkId)
    if (!item) return
    const db = await initDB()
    if (tagId === privateTagId) {
      if (privateSession === null) {
        // Unreachable in practice — the Private tag is excluded from `tags`
        // (Task 7) whenever locked, so it can't be offered as a toggle
        // target. Defensive guard, not a normal-path branch.
        console.warn('[allmarks] Private tag toggled while locked — ignoring')
        return
      }
      if (item.tags.includes(tagId)) {
        await removePrivateTag(db, bookmarkId, tagId, privateSession)
      } else {
        await addPrivateTag(db, bookmarkId, tagId, privateSession)
      }
    } else if (item.tags.includes(tagId)) {
      await removeTagFromBookmark(db, bookmarkId, tagId)
    } else {
      await addTagToBookmark(db, bookmarkId, tagId)
      setTagAddedTick((t) => t + 1)
    }
    await reload()
  },
  [items, reload, privateTagId, privateSession],
)
```

- [ ] **Step 4: SETTINGS entry wiring**

At the `<ExtensionEntry ...>` call (`:3397-3410`), add `privateStatus={privateTagId === null ? 'none' : privateSession === null ? 'locked' : 'unlocked'}` and the `onOpenPrivate` handler shown at the end of this step (it needs `initDB`/`loadVaultRecord`, defined below, so it's given once in full there rather than sketched twice).

Render the dialogs as siblings near the other portal-style overlays (e.g. near where `TrashConfirmDialog`/onboarding overlays are rendered — find that region and add alongside it):
```tsx
{privateDialog === 'setup' && (
  <PrivateSetupDialog
    onCreate={(password, hint) => {
      void (async (): Promise<void> => {
        const db = await initDB()
        const tag = await createTag({ name: 'Private', color: '#000000', order: tags.length, isPrivateVault: true })
        const session = await createVault(db, tag.id, password, hint)
        setPrivateVaultSession(session)
        void reloadTags()
        setPrivateDialog(null)
      })()
    }}
    onCancel={() => setPrivateDialog(null)}
  />
)}
{privateDialog === 'unlock' && (
  <PrivateUnlockDialog
    hint={privateHint}
    onSubmit={async (password) => {
      const db = await initDB()
      const session = await unlockVault(db, password)
      if (!session) return false
      setPrivateVaultSession(session)
      setPrivateDialog(null)
      return true
    }}
    onCancel={() => setPrivateDialog(null)}
  />
)}
```
(`initDB()` — the same function `handleTagToggle`/`handleTagCreate` already call directly per Step 3's verified code; BoardRoot has no `dbRef`, every handler just awaits `initDB()` itself, which the `idb` library resolves cheaply against the already-open connection.)

The `onOpenPrivate` prop passed to `<ExtensionEntry>` (also loads `privateHint` lazily, right when the unlock dialog is about to open):
```ts
onOpenPrivate={() => {
  if (privateTagId === null) { setPrivateDialog('setup'); return }
  if (privateSession === null) {
    void (async (): Promise<void> => {
      const db = await initDB()
      const record = await loadVaultRecord(db)
      setPrivateHint(record?.hint)
      setPrivateDialog('unlock')
    })()
  }
}}
```

- [ ] **Step 5: SHARE gate**

There are exactly two call sites that reach `createHostedShare(` (verified — grepped the whole file): the desktop `handleCreateHostedShare` (`:2599-2632`) and the mobile `handleMobileCaptureAndCreate` (`:2730-2845`). Both ultimately call `createHostedShare({ buildShare: buildArrangeShare, ... })`, and `buildArrangeShare` always recomputes its payload from the CURRENT `selectedIds` at call time (`selectedInBoardOrder(items, selectedIds)`) regardless of the mobile visual arrangement state — so gating both on `selectedInBoardOrder(items, selectedIds)` is correct for both, even though the mobile path's `collageOrder`/`collagePositions` are a separate visual-arrangement concern set up earlier by a different handler. (The other share builder in this file, `buildShareData` at `:2505-2543`, feeds `getShareData={buildShareData}` at `:3745` — a Lightbox/selection "share metadata" prop, not a `createHostedShare(` call; it needs no gate here.)

Current code (verified):
```ts
const handleCreateHostedShare = useCallback(async (): Promise<void> => {
  if (selectedInBoardOrder(items, selectedIds).length === 0) return
  setShareCreateState('creating')
  let thumb: string | null = null
  const node = boardFrameRef.current
  if (node && typeof requestAnimationFrame === 'function') {
    setCapturing(true)
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    try {
      thumb = await captureCollageShareImage(node, {
        origin: shareOrigin(),
        boardColor: deriveCaptureBoardColor(),
        fit: 'contain',
      })
    } finally {
      setCapturing(false)
    }
  }
  setCapturedImageUrl(thumb)
  const res = await createHostedShare({
    buildShare: buildArrangeShare,
    thumb: thumb ?? undefined,
    createShare,
    origin: shareOrigin(),
    warm: (u: string): void => { void fetch(u).catch((): void => {}) },
  })
  if (res.ok) {
    setHostedShareUrl(res.url)
    setShareCreateState('idle')
  } else {
    setShareCreateState('error')
  }
}, [items, selectedIds, buildArrangeShare, deriveCaptureBoardColor])
```
Rename this whole function to `proceedCreateHostedShare` (body unchanged) and add a new thin `handleCreateHostedShare` wrapper in its place, so every existing JSX call site that references `handleCreateHostedShare` (the button's `onClick`) keeps compiling unchanged:
```ts
const proceedCreateHostedShare = useCallback(async (): Promise<void> => {
  if (selectedInBoardOrder(items, selectedIds).length === 0) return
  setShareCreateState('creating')
  let thumb: string | null = null
  const node = boardFrameRef.current
  if (node && typeof requestAnimationFrame === 'function') {
    setCapturing(true)
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    try {
      thumb = await captureCollageShareImage(node, {
        origin: shareOrigin(),
        boardColor: deriveCaptureBoardColor(),
        fit: 'contain',
      })
    } finally {
      setCapturing(false)
    }
  }
  setCapturedImageUrl(thumb)
  const res = await createHostedShare({
    buildShare: buildArrangeShare,
    thumb: thumb ?? undefined,
    createShare,
    origin: shareOrigin(),
    warm: (u: string): void => { void fetch(u).catch((): void => {}) },
  })
  if (res.ok) {
    setHostedShareUrl(res.url)
    setShareCreateState('idle')
  } else {
    setShareCreateState('error')
  }
}, [items, selectedIds, buildArrangeShare, deriveCaptureBoardColor])

const handleCreateHostedShare = useCallback(async (): Promise<void> => {
  const privateCount = privateTagId === null ? 0
    : selectedInBoardOrder(items, selectedIds).filter((it) => it.tags.includes(privateTagId)).length
  if (privateCount > 0) {
    setPendingPrivateShare({ count: privateCount, resume: 'desktop' })
    return
  }
  await proceedCreateHostedShare()
}, [items, selectedIds, privateTagId, proceedCreateHostedShare])
```
Do the identical rename-and-wrap for the mobile path: rename `handleMobileCaptureAndCreate` (`:2730-2845`, deps `[mobileBandRect, collageOrder, collagePositions, collageRotations, lightboxNavItems, roundedCorners, themeMeta, buildArrangeShare, deriveCaptureBoardColor]`) to `proceedMobileCaptureAndCreate` (body unchanged), and add:
```ts
const handleMobileCaptureAndCreate = useCallback(async (): Promise<void> => {
  const privateCount = privateTagId === null ? 0
    : selectedInBoardOrder(items, selectedIds).filter((it) => it.tags.includes(privateTagId)).length
  if (privateCount > 0) {
    setPendingPrivateShare({ count: privateCount, resume: 'mobile' })
    return
  }
  await proceedMobileCaptureAndCreate()
}, [items, selectedIds, privateTagId, proceedMobileCaptureAndCreate])
```
Change the `pendingPrivateShare` state type declared in Step 1 from `{ count: number } | null` to `{ count: number; resume: 'desktop' | 'mobile' } | null` (so one confirm dialog instance can resume whichever path triggered it). Render the dialog once, near the other Private dialogs:
```tsx
{pendingPrivateShare && (
  <PrivateShareConfirmDialog
    count={pendingPrivateShare.count}
    onConfirm={() => {
      const resume = pendingPrivateShare.resume
      setPendingPrivateShare(null)
      void (resume === 'desktop' ? proceedCreateHostedShare() : proceedMobileCaptureAndCreate())
    }}
    onCancel={() => setPendingPrivateShare(null)}
  />
)}
```

- [ ] **Step 6: Full verification**

Run: `npx tsc --noEmit` — must be clean (0 errors).
Run: `npx vitest run` — full suite must pass (no regressions in the ~2400+ existing tests; any failure here means an untraced `useBoardData(`/`applyFilter(`/`createHostedShare(` call site was missed — go find it, don't work around it).

- [ ] **Step 7: Commit**

```bash
git add components/board/BoardRoot.tsx
git commit -m "feat(private): wire setup/unlock/share-confirm into BoardRoot"
```

---

### Task 14: EXPORT/IMPORT round-trip regression test

**Files:**
- Test: extend `lib/storage/backup.test.ts` (find the existing test file for `exportAllStores`/`importAllStores` first — do not create a duplicate)

**Interfaces:**
- Consumes: `exportAllStores`, `importAllStores` from `@/lib/storage/backup`; `createVault`, `unlockVault` from `@/lib/private/vault-store`.

- [ ] **Step 1: Write the failing test**

```ts
it('EXPORT then IMPORT preserves the Private vault — same password unlocks after restore', async () => {
  const tag = await addTag(db, { name: 'Private', color: '#000', order: 0, isPrivateVault: true })
  await createVault(db, tag.id, 'hunter2', 'my hint')
  const dump = await exportAllStores(db)

  const freshDb = /* open a second, empty in-memory db instance the same way this test file's other tests do */
  await importAllStores(freshDb, dump)

  const session = await unlockVault(freshDb, 'hunter2')
  expect(session?.tagId).toBe(tag.id)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/storage/backup.test.ts`
Expected: PASS or FAIL — if this fails, it means `exportAllStores`/`importAllStores`'s existing whole-store dump does NOT actually carry the `settings` store's `private-vault` row through (contradicts the Task 3-research finding that `settings` is already in `KNOWN_STORES`). If it fails, that research finding was wrong somewhere and needs re-investigation before writing any fix — do not paper over it with a special case.

- [ ] **Step 3: Implement (only if Step 2 failed)**

If needed, add `'settings'` handling explicitly, matching whatever pattern `KNOWN_STORES`/`BackupJson`/the byName block already use for the other stores. Expected to be a no-op given the research in this plan's Task 3, but this step exists precisely to catch a wrong assumption.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/storage/backup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/backup.test.ts
git commit -m "test(private): EXPORT/IMPORT round-trip preserves the Private vault"
```

---

### Task 15: e2e (Playwright)

**Files:**
- Create: `tests/e2e/private-vault.spec.ts`

**Interfaces:**
- Consumes: this repo's existing e2e seed helper (`reference_e2e_seed_helper` per project memory — `seed-db.ts`; read an existing spec like `tests/e2e/mobile-share.spec.ts` for the exact import/usage pattern before writing this).

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/private-vault.spec.ts
import { test, expect } from '@playwright/test'
// import whatever seed helper this repo's other e2e specs use

test('Private: create, disappears on reload while locked, reappears when unlocked, gated from SHARE', async ({ page }) => {
  // 1. seed one bookmark, load /board
  // 2. open SETTINGS -> click PRIVATE -> fill setup dialog (password "testpass123") -> CREATE
  // 3. tag the seeded bookmark with the new Private tag (via whatever UI this repo uses for tagging — TopTagStrip/drag-to-tag)
  // 4. reload the page
  // 5. assert the bookmark card is NOT visible on the board, and the Private tag is NOT in the FilterPill list
  // 6. open SETTINGS -> click PRIVATE -> enter "testpass123" -> UNLOCK
  // 7. click the Private tag in FilterPill -> assert the bookmark card IS now visible
  // 8. switch to a different, non-Private tag filter -> assert the bookmark is NOT visible (containment rule)
  // 9. re-select the Private filter, select the card, trigger SHARE -> assert PrivateShareConfirmDialog appears
  // 10. click CANCEL -> assert no share link was created
})
```

Fill in each numbered step with real Playwright locators once Task 13 lands — this spec's exact selectors depend on `data-testid`s chosen during Task 13's implementation (e.g. `private-entry-button`, `private-setup-*`, `private-unlock-*`, `private-share-confirm-*` are already fixed by Tasks 10-12; the tag-toggle and FilterPill selectors should match whatever an existing e2e spec (e.g. one covering tag filtering) already uses).

- [ ] **Step 2: Run**

Run: `npx playwright test tests/e2e/private-vault.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/private-vault.spec.ts
git commit -m "test(private): e2e coverage for create/lock/unlock/share-gate"
```

---

## Post-plan gate (before this ships to `allmarks.app`)

- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — full suite green.
- `pnpm build` — clean static export.
- Manual pass by the user on a real device (per this project's established practice — Claude does not self-verify visuals): create a Private tag, reload, confirm it's really gone, unlock, confirm it's back, try to SHARE it and confirm the warning appears.
- Phase 2 (WebAuthn biometric shortcut) is a separate future plan — not part of this one.
