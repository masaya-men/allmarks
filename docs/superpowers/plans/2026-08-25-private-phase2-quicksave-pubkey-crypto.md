# Private Phase 2 ② クイック保存面対応 + 公開鍵暗号への移行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch Private's encryption from a single symmetric password-derived key to an ECDH (P-256) public/private key pair, so tagging something Private (encrypting) never requires the vault to be unlocked — only viewing or removing (decrypting) does — and wire this into PopOut and the bookmarklet's quick-save surfaces plus the extension's message-passing backend.

**Architecture:** `lib/private/crypto.ts` gains ECDH keypair generation, private-key wrap/unwrap (via the existing password-derived key), and public-key-encrypt / private-key-decrypt (ephemeral-static ECDH → HKDF-SHA256 → AES-256-GCM, reusing the existing `encryptJson`/`decryptJson`). `lib/private/vault-store.ts`'s `PrivateVaultRecord` stores the public key in plaintext and the private key wrapped; the password-derived key's only remaining job is unwrapping. `lib/private/apply-tag-change.ts`'s "add" functions drop their `session` parameter entirely (they only need the public key, loaded from the vault record) while "remove" stays session-gated. `BoardRoot.tsx`'s `handlePrivateEntry` routes on whether the action needs decryption, not on lock state alone. PopOut (`PipCompanion.tsx`) and the bookmarklet (`SaveToast.tsx`) wire a `privateEntry` prop into their existing `TagAddPopover` calls, calling the new session-less `addPrivateTag` directly. The extension's save-iframe (`SaveIframeClient.tsx`) gets a new `booklage:add-private-tag` message type as its receiving end; the extension's own content-script strip UI that would *send* that message is an explicit follow-up plan (see Out of Scope).

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Vitest, `idb` (IndexedDB wrapper), Web Crypto API only (no third-party crypto library), Playwright for e2e.

**Spec:** [docs/superpowers/specs/2026-08-25-private-phase2-quicksave-pubkey-crypto-design.md](../specs/2026-08-25-private-phase2-quicksave-pubkey-crypto-design.md)

## Global Constraints

- Web Crypto (`crypto.subtle`) only — no third-party crypto library, matching `lib/private/crypto.ts`'s existing header comment.
- `any` is forbidden by `tsconfig.json` (`strict: true`) — the existing `DbLike = IDBPDatabase<any>` pattern in `lib/private/*.ts` files is a pre-existing `eslint-disable-next-line` exception; keep using that exact pattern, don't introduce new bare `any`.
- No data migration code: the only Private-tagged bookmarks that ever existed in production have already had the tag removed by the user, and there are no other users yet — this plan replaces the `PrivateVaultRecord`/`encryptedPayload` shapes outright, no dual-format reading.
- `--no-verify` is never used to skip hooks.
- Run `rtk` in front of `git`/`npm`/`npx`/`vitest`/`tsc` commands per this project's shell convention (token-saving proxy) — if `rtk` reports "No hook installed", the underlying command still ran; read its output normally.
- Every new/changed test file follows the existing `describe`/`it`/`expect` (Vitest) style already used in `lib/private/*.test.ts` — see Task 1 for the exact style reference.
- Visual changes in Task 7 are limited to exactly what was approved in chat (remove the icon-to-label space, extract the icon to one swappable constant) — do not restyle anything else about these 5 rows.

---

### Task 1: ECDH + HKDF primitives in `lib/private/crypto.ts`

**Files:**
- Modify: `lib/private/crypto.ts` (append new functions after the existing `decryptJson`)
- Test: `lib/private/crypto.test.ts` (append new `describe` block)

**Interfaces:**
- Consumes: existing `bytesToBase64`/`base64ToBytes` (module-private helpers already in this file), `encryptJson`/`decryptJson` (already exported).
- Produces (used by Tasks 2, 4, 5):
  - `generateEcdhKeyPair(): Promise<CryptoKeyPair>`
  - `exportPublicKeyB64(key: CryptoKey): Promise<string>`
  - `importPublicKey(b64: string): Promise<CryptoKey>`
  - `wrapPrivateKey(key: CryptoKey, wrappingKey: CryptoKey): Promise<{ iv: string; ciphertext: string }>`
  - `unwrapPrivateKey(wrapped: { iv: string; ciphertext: string }, wrappingKey: CryptoKey): Promise<CryptoKey>`
  - `encryptWithPublicKey(publicKey: CryptoKey, data: unknown): Promise<{ ephemeralPublicKey: string; iv: string; ciphertext: string }>`
  - `decryptWithPrivateKey<T>(privateKey: CryptoKey, envelope: { ephemeralPublicKey: string; iv: string; ciphertext: string }): Promise<T>`

- [ ] **Step 1: Write the failing tests**

Append to `lib/private/crypto.test.ts` (after the existing `describe('private/crypto', ...)` block, as a new top-level `describe`):

```ts
describe('private/crypto ECDH', () => {
  it('generateEcdhKeyPair produces a public+private key pair usable for ECDH', async () => {
    const pair = await generateEcdhKeyPair()
    expect(pair.publicKey.algorithm.name).toBe('ECDH')
    expect(pair.privateKey.algorithm.name).toBe('ECDH')
  })

  it('exportPublicKeyB64 then importPublicKey round-trips to a usable public key', async () => {
    const pair = await generateEcdhKeyPair()
    const b64 = await exportPublicKeyB64(pair.publicKey)
    const imported = await importPublicKey(b64)
    expect(imported.algorithm.name).toBe('ECDH')
    const envelope = await encryptWithPublicKey(imported, { ok: true })
    await expect(decryptWithPrivateKey(pair.privateKey, envelope)).resolves.toEqual({ ok: true })
  })

  it('wrapPrivateKey then unwrapPrivateKey round-trips to a usable private key', async () => {
    const pair = await generateEcdhKeyPair()
    const wrappingKey = await deriveKey('pw', generateSalt(), 1000)
    const wrapped = await wrapPrivateKey(pair.privateKey, wrappingKey)
    const unwrapped = await unwrapPrivateKey(wrapped, wrappingKey)
    const envelope = await encryptWithPublicKey(pair.publicKey, { secret: 42 })
    await expect(decryptWithPrivateKey(unwrapped, envelope)).resolves.toEqual({ secret: 42 })
  })

  it('the private key recovered by unwrapPrivateKey is non-extractable', async () => {
    const pair = await generateEcdhKeyPair()
    const wrappingKey = await deriveKey('pw', generateSalt(), 1000)
    const wrapped = await wrapPrivateKey(pair.privateKey, wrappingKey)
    const unwrapped = await unwrapPrivateKey(wrapped, wrappingKey)
    expect(unwrapped.extractable).toBe(false)
  })

  it('unwrapPrivateKey throws when given the wrong wrapping key (wrong password)', async () => {
    const pair = await generateEcdhKeyPair()
    const rightKey = await deriveKey('right', generateSalt(), 1000)
    const wrongKey = await deriveKey('wrong', generateSalt(), 1000)
    const wrapped = await wrapPrivateKey(pair.privateKey, rightKey)
    await expect(unwrapPrivateKey(wrapped, wrongKey)).rejects.toThrow()
  })

  it('encryptWithPublicKey then decryptWithPrivateKey round-trips arbitrary JSON', async () => {
    const pair = await generateEcdhKeyPair()
    const original = { title: 'secret', n: 42, nested: { ok: true } }
    const envelope = await encryptWithPublicKey(pair.publicKey, original)
    const roundTripped = await decryptWithPrivateKey<typeof original>(pair.privateKey, envelope)
    expect(roundTripped).toEqual(original)
  })

  it('two encryptions with the same public key use different ephemeral keys and ciphertexts', async () => {
    const pair = await generateEcdhKeyPair()
    const a = await encryptWithPublicKey(pair.publicKey, { x: 1 })
    const b = await encryptWithPublicKey(pair.publicKey, { x: 1 })
    expect(a.ephemeralPublicKey).not.toBe(b.ephemeralPublicKey)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('decrypting with the wrong private key throws', async () => {
    const pairA = await generateEcdhKeyPair()
    const pairB = await generateEcdhKeyPair()
    const envelope = await encryptWithPublicKey(pairA.publicKey, { secret: true })
    await expect(decryptWithPrivateKey(pairB.privateKey, envelope)).rejects.toThrow()
  })
})
```

Update the file's top `import` line to add the new names:

```ts
import { generateSalt, deriveKey, encryptJson, decryptJson, PBKDF2_ITERATIONS, generateEcdhKeyPair, exportPublicKeyB64, importPublicKey, wrapPrivateKey, unwrapPrivateKey, encryptWithPublicKey, decryptWithPrivateKey } from './crypto'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npx vitest run lib/private/crypto.test.ts`
Expected: FAIL — `generateEcdhKeyPair` (and friends) is not exported from `./crypto`.

- [ ] **Step 3: Implement**

Append to `lib/private/crypto.ts`, after the existing `decryptJson` function (end of file):

```ts
/** ECDH (P-256) key pair for the vault's public/private split: the public
 *  half is safe to store in plaintext (it's not secret) and lets ANY
 *  context encrypt (tag something Private) without the password. Only the
 *  matching private half (wrapped elsewhere under the password-derived
 *  key) can decrypt. */
export async function generateEcdhKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'])
}

export async function exportPublicKeyB64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('spki', key)
  return bytesToBase64(new Uint8Array(raw))
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', base64ToBytes(b64), { name: 'ECDH', namedCurve: 'P-256' }, true, [])
}

/** Wraps (encrypts) a private key with `wrappingKey` (the PBKDF2-derived
 *  password key) for storage. Reuses encryptJson rather than adding new
 *  low-level byte-encryption code. */
export async function wrapPrivateKey(
  key: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<{ iv: string; ciphertext: string }> {
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', key)
  return encryptJson(wrappingKey, { pkcs8: bytesToBase64(new Uint8Array(pkcs8)) })
}

/** Inverse of wrapPrivateKey. Throws (DOMException) if `wrappingKey` is
 *  wrong — same contract as decryptJson, and this doubles as the vault's
 *  password-correctness check (no separate check-blob needed). Imports the
 *  recovered key as non-extractable. */
export async function unwrapPrivateKey(
  wrapped: { iv: string; ciphertext: string },
  wrappingKey: CryptoKey,
): Promise<CryptoKey> {
  const { pkcs8 } = await decryptJson<{ pkcs8: string }>(wrappingKey, wrapped.iv, wrapped.ciphertext)
  return crypto.subtle.importKey(
    'pkcs8',
    base64ToBytes(pkcs8),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits'],
  )
}

/** ECDH shared secret -> HKDF-SHA256 -> AES-256-GCM key. Shared by
 *  encryptWithPublicKey/decryptWithPrivateKey so both sides derive the
 *  identical key (ECDH is symmetric: derive(A_priv, B_pub) ==
 *  derive(B_priv, A_pub)). No HKDF salt (zero-length — the shared secret is
 *  already unique per call via the ephemeral key, so no extra randomness is
 *  needed); `info` fixes the derivation to this one purpose. */
async function deriveAesKeyFromEcdh(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256)
  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('allmarks-private-v1'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Encrypts `data` under `publicKey` — usable from ANY context that can
 *  read the (non-secret) public key, no password/session required. Each
 *  call generates a fresh disposable (ephemeral) key pair; only its public
 *  half is included in the result (safe) so decryptWithPrivateKey can
 *  reconstruct the same AES key. */
export async function encryptWithPublicKey(
  publicKey: CryptoKey,
  data: unknown,
): Promise<{ ephemeralPublicKey: string; iv: string; ciphertext: string }> {
  const ephemeral = await generateEcdhKeyPair()
  const aesKey = await deriveAesKeyFromEcdh(ephemeral.privateKey, publicKey)
  const { iv, ciphertext } = await encryptJson(aesKey, data)
  const ephemeralPublicKey = await exportPublicKeyB64(ephemeral.publicKey)
  return { ephemeralPublicKey, iv, ciphertext }
}

/** Inverse of encryptWithPublicKey. Requires the vault's own (unwrapped,
 *  password-gated) static private key. */
export async function decryptWithPrivateKey<T>(
  privateKey: CryptoKey,
  envelope: { ephemeralPublicKey: string; iv: string; ciphertext: string },
): Promise<T> {
  const ephemeralPublicKey = await importPublicKey(envelope.ephemeralPublicKey)
  const aesKey = await deriveAesKeyFromEcdh(privateKey, ephemeralPublicKey)
  return decryptJson<T>(aesKey, envelope.iv, envelope.ciphertext)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npx vitest run lib/private/crypto.test.ts`
Expected: PASS (all tests, old and new).

- [ ] **Step 5: Commit**

```bash
git add lib/private/crypto.ts lib/private/crypto.test.ts
git commit -m "feat(private): add ECDH public-key encrypt/decrypt primitives"
```

---

### Task 2: `BookmarkRecord.encryptedPayload` gains `ephemeralPublicKey`

**Files:**
- Modify: `lib/storage/indexeddb.ts` (the `BookmarkRecord.encryptedPayload` field, currently `{ readonly iv: string; readonly ciphertext: string }`)

**Interfaces:**
- Consumes: nothing new.
- Produces: the `encryptedPayload` shape Tasks 4 and 5 read/write.

- [ ] **Step 1: Change the type**

In `lib/storage/indexeddb.ts`, find the `encryptedPayload` field on `BookmarkRecord` (its doc comment starts with `/** v16+: present only on bookmarks tagged Private...`). Replace:

```ts
  encryptedPayload?: { readonly iv: string; readonly ciphertext: string }
```

with:

```ts
  encryptedPayload?: { readonly ephemeralPublicKey: string; readonly iv: string; readonly ciphertext: string }
```

Also update that field's doc comment to mention the public-key scheme:

```ts
  /** v16+: present only on bookmarks tagged Private. When present,
   *  title/url/description/thumbnail/favicon/siteName are stored as empty
   *  strings and the real values live only here, encrypted under the
   *  vault's public key (lib/private/crypto.ts encryptWithPublicKey) —
   *  ephemeralPublicKey/iv/ciphertext are all base64. Never
   *  decrypt-and-write-back — decrypted fields exist only transiently in
   *  memory (lib/private/resolve-visibility.ts). */
  encryptedPayload?: { readonly ephemeralPublicKey: string; readonly iv: string; readonly ciphertext: string }
```

- [ ] **Step 2: Verify it compiles (will show downstream errors — expected until Tasks 4/5 land)**

Run: `rtk npx tsc --noEmit`
Expected: errors in `lib/private/apply-tag-change.ts` and `lib/private/resolve-visibility.ts` (both still using the old 2-field shape) — this confirms the type change took effect. Tasks 4 and 5 fix these.

- [ ] **Step 3: Commit**

```bash
git add lib/storage/indexeddb.ts
git commit -m "feat(private): encryptedPayload carries an ephemeral public key"
```

---

### Task 3: `PrivateVaultRecord` + `createVault`/`unlockVault` use the ECDH key pair

**Files:**
- Modify: `lib/private/vault-store.ts`
- Test: `lib/private/vault-store.test.ts`

**Interfaces:**
- Consumes: Task 1's `generateEcdhKeyPair`, `exportPublicKeyB64`, `wrapPrivateKey`, `unwrapPrivateKey`, `importPublicKey`, `encryptWithPublicKey`, `decryptWithPrivateKey`.
- Produces (used by Tasks 4, 6):
  - `PrivateVaultRecord` now has `publicKey: string` and `wrappedPrivateKey: { iv: string; ciphertext: string }` instead of `checkIv`/`checkCiphertext`.
  - `createVault(db, tagId, password, hint?): Promise<PrivateVaultSession>` — session now has `.privateKey` not `.key` (Task 4 renames the type).
  - `unlockVault(db, password): Promise<PrivateVaultSession | null>` — same return shape.
  - `loadVaultRecord(db): Promise<PrivateVaultRecord | null>` — unchanged signature.

**Note:** This task's tests use `session.privateKey` and `PrivateVaultSession`'s new shape, which Task 4 defines. Do Task 4's `vault-session.ts` rename FIRST if executing out of the numbered order — the numbering here reflects dependency order for a single executor reading top to bottom; if dispatched as independent subagent tasks, Task 4 (vault-session.ts) must land before this one.

- [ ] **Step 1: Write the failing tests**

Replace `lib/private/vault-store.test.ts` in full:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import { loadVaultRecord, createVault, unlockVault } from './vault-store'
import { importPublicKey, encryptWithPublicKey, decryptWithPrivateKey } from './crypto'

const TEST_DB = 'allmarks-test-private-vault-store'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>

async function makeDb(): Promise<TestDb> {
  return await openDB(TEST_DB, 1, {
    upgrade(db) {
      db.createObjectStore('settings', { keyPath: 'key' })
    },
  })
}

describe('private/vault-store', () => {
  let db: TestDb

  beforeEach(async () => {
    const databases = await indexedDB.databases()
    for (const info of databases) {
      if (info.name) indexedDB.deleteDatabase(info.name)
    }
    db = await makeDb()
  })

  afterEach(() => {
    db.close()
  })

  it('loadVaultRecord returns null before any vault exists', async () => {
    expect(await loadVaultRecord(db)).toBeNull()
  })

  it('createVault persists a record (with a public key, no plaintext secret) and returns an unlocked session', async () => {
    const session = await createVault(db, 'tag-abc', 'hunter2', 'my hint')
    expect(session).toEqual({ tagId: 'tag-abc', privateKey: expect.anything() })
    const record = await loadVaultRecord(db)
    expect(record?.tagId).toBe('tag-abc')
    expect(record?.hint).toBe('my hint')
    expect(record?.salt.length).toBeGreaterThan(0)
    expect(record?.publicKey.length).toBeGreaterThan(0)
    expect(record?.wrappedPrivateKey.iv.length).toBeGreaterThan(0)
    expect(record?.wrappedPrivateKey.ciphertext.length).toBeGreaterThan(0)
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

  it("createVault's public key can encrypt data that a later unlockVault session can decrypt", async () => {
    await createVault(db, 'tag-abc', 'hunter2')
    const record = await loadVaultRecord(db)
    const publicKey = await importPublicKey(record!.publicKey)
    const envelope = await encryptWithPublicKey(publicKey, { secret: 'hello' })
    const session = await unlockVault(db, 'hunter2')
    await expect(decryptWithPrivateKey(session!.privateKey, envelope)).resolves.toEqual({ secret: 'hello' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npx vitest run lib/private/vault-store.test.ts`
Expected: FAIL — `PrivateVaultRecord` still has `checkIv`/`checkCiphertext`, session still has `.key`.

- [ ] **Step 3: Implement**

Replace `lib/private/vault-store.ts` in full:

```ts
import type { IDBPDatabase } from 'idb'
import {
  PBKDF2_ITERATIONS, deriveKey, generateSalt,
  generateEcdhKeyPair, exportPublicKeyB64, wrapPrivateKey, unwrapPrivateKey,
} from './crypto'
import type { PrivateVaultSession } from './vault-session'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const VAULT_KEY = 'private-vault'

export type PrivateVaultRecord = {
  readonly key: 'private-vault'
  readonly tagId: string
  readonly salt: string
  readonly iterations: number
  /** ECDH public key (raw/spki, base64) — not secret, safe in plaintext.
   *  Lets any context encrypt (tag Private) without the password. */
  readonly publicKey: string
  /** ECDH private key (pkcs8, base64), encrypted under the password-derived
   *  key. Unwrapping this doubles as the "is this the right password?"
   *  check — no separate check-blob needed. */
  readonly wrappedPrivateKey: { readonly iv: string; readonly ciphertext: string }
  readonly hint?: string
}

export async function loadVaultRecord(db: DbLike): Promise<PrivateVaultRecord | null> {
  const record = (await db.get('settings', VAULT_KEY)) as PrivateVaultRecord | undefined
  return record ?? null
}

/** First-time setup: derives a wrapping key from `password`, generates a
 *  fresh ECDH key pair (public half stored in plaintext; private half
 *  wrapped under the password-derived key), stores the vault record, and
 *  returns an already-unlocked session. Overwrites any existing vault
 *  record — callers must ensure this is only reachable when no vault
 *  exists yet. */
export async function createVault(
  db: DbLike,
  tagId: string,
  password: string,
  hint?: string,
): Promise<PrivateVaultSession> {
  const salt = generateSalt()
  const wrappingKey = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const keyPair = await generateEcdhKeyPair()
  const publicKey = await exportPublicKeyB64(keyPair.publicKey)
  const wrappedPrivateKey = await wrapPrivateKey(keyPair.privateKey, wrappingKey)
  const record: PrivateVaultRecord = {
    key: VAULT_KEY,
    tagId,
    salt,
    iterations: PBKDF2_ITERATIONS,
    publicKey,
    wrappedPrivateKey,
    ...(hint ? { hint } : {}),
  }
  await db.put('settings', record)
  // Re-import from the just-wrapped blob (rather than reusing keyPair.privateKey
  // directly) so the session key is the same non-extractable shape unlockVault
  // produces, and this doubles as a sanity check that wrapping round-trips.
  const privateKey = await unwrapPrivateKey(wrappedPrivateKey, wrappingKey)
  return { tagId, privateKey }
}

/** Attempts to unlock with `password`. Returns null (never throws) when
 *  there's no vault yet OR the password is wrong — callers show the same
 *  "wrong password" message either way. */
export async function unlockVault(db: DbLike, password: string): Promise<PrivateVaultSession | null> {
  const record = await loadVaultRecord(db)
  if (!record) return null
  const wrappingKey = await deriveKey(password, record.salt, record.iterations)
  try {
    const privateKey = await unwrapPrivateKey(record.wrappedPrivateKey, wrappingKey)
    return { tagId: record.tagId, privateKey }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npx vitest run lib/private/vault-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/private/vault-store.ts lib/private/vault-store.test.ts
git commit -m "feat(private): vault record stores an ECDH key pair, not a check-blob"
```

---

### Task 4: `vault-session.ts` — rename `key` to `privateKey`

**Files:**
- Modify: `lib/private/vault-session.ts`
- Test: `lib/private/vault-session.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `PrivateVaultSession = { readonly tagId: string; readonly privateKey: CryptoKey } | null` — the shape every other task's `session.privateKey` reference depends on.

- [ ] **Step 1: Write the failing tests**

Replace `lib/private/vault-session.test.ts` in full:

```ts
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
    const session: PrivateVaultSession = { tagId: 'tag-1', privateKey: fakeKey }
    setPrivateVaultSession(session)
    expect(getPrivateVaultSession()).toEqual(session)
  })

  it('usePrivateVaultSession reflects the module singleton and re-renders on change', () => {
    const { result } = renderHook(() => usePrivateVaultSession())
    expect(result.current).toBeNull()
    act(() => {
      setPrivateVaultSession({ tagId: 'tag-2', privateKey: fakeKey })
    })
    expect(result.current).toEqual({ tagId: 'tag-2', privateKey: fakeKey })
  })

  it('two independent hook instances (simulating two mounted pages) both see the same session', () => {
    const a = renderHook(() => usePrivateVaultSession())
    const b = renderHook(() => usePrivateVaultSession())
    act(() => {
      setPrivateVaultSession({ tagId: 'tag-3', privateKey: fakeKey })
    })
    expect(a.result.current).toEqual({ tagId: 'tag-3', privateKey: fakeKey })
    expect(b.result.current).toEqual({ tagId: 'tag-3', privateKey: fakeKey })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npx vitest run lib/private/vault-session.test.ts`
Expected: FAIL (type error / property mismatch — `privateKey` doesn't exist yet).

- [ ] **Step 3: Implement**

In `lib/private/vault-session.ts`, change only the type line:

```ts
export type PrivateVaultSession = { readonly tagId: string; readonly key: CryptoKey } | null
```

to:

```ts
export type PrivateVaultSession = { readonly tagId: string; readonly privateKey: CryptoKey } | null
```

Also update the file's leading doc comment (currently reads "The unlocked Private vault's tag id + decryption key...") to say "...tag id + private key..." — a one-word wording tweak, no structural change. Nothing else in this file changes (the module variable, getter/setter, and hook are all opaque to the session's internal shape).

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npx vitest run lib/private/vault-session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/private/vault-session.ts lib/private/vault-session.test.ts
git commit -m "refactor(private): rename vault session's key field to privateKey"
```

---

### Task 5: `apply-tag-change.ts` — "add" drops `session`, "remove" uses `privateKey`

**Files:**
- Modify: `lib/private/apply-tag-change.ts`
- Test: `lib/private/apply-tag-change.test.ts`

**Interfaces:**
- Consumes: Task 1's `encryptWithPublicKey`, `decryptWithPrivateKey`, `importPublicKey`; Task 3's `loadVaultRecord`; Task 4's `PrivateVaultSession.privateKey`.
- Produces (used by Task 6 and e2e):
  - `addPrivateTag(db, bookmarkId, privateTagId): Promise<void>` — **no `session` parameter**.
  - `addPrivateTagBatch(db, bookmarkIds, privateTagId): Promise<{succeeded, failed}>` — **no `session` parameter**.
  - `removePrivateTag(db, bookmarkId, privateTagId, session): Promise<void>` — unchanged signature.
  - `executePrivateAction(db, action, privateTagId, session): Promise<{failed}>` — unchanged signature (internally stops passing `session` to the add calls).
  - `privateActionNeedsUnlock(action: PendingPrivateAction): boolean` — **new**, used by Task 6.
  - `resolvePrivateStatus`, `PRIVATE_DROP_KEY`, `PendingPrivateAction` — unchanged.

- [ ] **Step 1: Write the failing tests**

Replace `lib/private/apply-tag-change.test.ts` in full:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import {
  addPrivateTag, removePrivateTag, addPrivateTagBatch, executePrivateAction,
  resolvePrivateStatus, privateActionNeedsUnlock, PRIVATE_DROP_KEY,
} from './apply-tag-change'
import {
  deriveKey, generateSalt, generateEcdhKeyPair, exportPublicKeyB64, wrapPrivateKey, unwrapPrivateKey,
} from './crypto'
import type { PrivateVaultSession } from './vault-session'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'

const TEST_DB = 'allmarks-test-apply-tag-change'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>

async function makeDb(): Promise<TestDb> {
  return await openDB(TEST_DB, 1, {
    upgrade(db) {
      const bs = db.createObjectStore('bookmarks', { keyPath: 'id' })
      bs.createIndex('by-tag', 'tags', { multiEntry: true })
      db.createObjectStore('settings', { keyPath: 'key' })
    },
  })
}

function makeBookmark(id: string, overrides: Partial<BookmarkRecord> = {}): BookmarkRecord {
  return {
    id,
    url: 'https://example.com',
    title: 'My Title',
    description: 'desc',
    thumbnail: 'https://example.com/t.jpg',
    favicon: '',
    siteName: 'Example',
    type: 'website',
    savedAt: new Date().toISOString(),
    ogpStatus: 'fetched',
    tags: [],
    ...overrides,
  } as BookmarkRecord
}

describe('private/apply-tag-change', () => {
  let db: TestDb

  beforeEach(async () => {
    const databases = await indexedDB.databases()
    for (const info of databases) {
      if (info.name) indexedDB.deleteDatabase(info.name)
    }
    db = await makeDb()
  })

  afterEach(() => {
    db.close()
  })

  /** Puts a real vault record (matching vault-store's shape) directly into
   *  `settings` and returns a matching unlocked session — mirrors what
   *  createVault/unlockVault do, without importing vault-store (keeps this
   *  test file focused on apply-tag-change's own contract). */
  async function makeVault(): Promise<PrivateVaultSession> {
    const salt = generateSalt()
    const wrappingKey = await deriveKey('pw', salt, 1000)
    const keyPair = await generateEcdhKeyPair()
    const publicKey = await exportPublicKeyB64(keyPair.publicKey)
    const wrappedPrivateKey = await wrapPrivateKey(keyPair.privateKey, wrappingKey)
    await db.put('settings', {
      key: 'private-vault',
      tagId: 'private-tag-id',
      salt,
      iterations: 1000,
      publicKey,
      wrappedPrivateKey,
    })
    const privateKey = await unwrapPrivateKey(wrappedPrivateKey, wrappingKey)
    return { tagId: 'private-tag-id', privateKey }
  }

  it('addPrivateTag encrypts the sensitive fields and blanks the plaintext columns', async () => {
    const bookmark = makeBookmark('b1')
    await db.put('bookmarks', bookmark)
    await makeVault()
    await addPrivateTag(db, bookmark.id, 'private-tag-id')
    const updated = await db.get('bookmarks', bookmark.id)
    expect(updated.title).toBe('')
    expect(updated.url).toBe('')
    expect(updated.encryptedPayload).toBeDefined()
    expect(updated.encryptedPayload.ephemeralPublicKey).toBeDefined()
    expect(updated.tags).toContain('private-tag-id')
  })

  it('addPrivateTag is a no-op when no vault has been set up yet', async () => {
    const bookmark = makeBookmark('b0')
    await db.put('bookmarks', bookmark)
    await addPrivateTag(db, bookmark.id, 'private-tag-id')
    const stored = await db.get('bookmarks', bookmark.id)
    expect(stored.encryptedPayload).toBeUndefined()
    expect(stored.tags).not.toContain('private-tag-id')
  })

  it('removePrivateTag decrypts the fields back to plaintext and clears encryptedPayload', async () => {
    const bookmark = makeBookmark('b2', { thumbnail: '' })
    await db.put('bookmarks', bookmark)
    const session = await makeVault()
    await addPrivateTag(db, bookmark.id, 'private-tag-id')
    await removePrivateTag(db, bookmark.id, 'private-tag-id', session)
    const restored = await db.get('bookmarks', bookmark.id)
    expect(restored.title).toBe('My Title')
    expect(restored.url).toBe('https://example.com')
    expect(restored.encryptedPayload).toBeUndefined()
    expect(restored.tags).not.toContain('private-tag-id')
  })

  it('removePrivateTag throws if the vault is locked (session null)', async () => {
    const bookmark = makeBookmark('b3')
    await db.put('bookmarks', bookmark)
    await makeVault()
    await addPrivateTag(db, bookmark.id, 'private-tag-id')
    await expect(removePrivateTag(db, bookmark.id, 'private-tag-id', null)).rejects.toThrow('locked')
  })

  it('addPrivateTag also encrypts photos/mediaSlots and blanks them at rest', async () => {
    const bookmark = makeBookmark('b4', {
      photos: ['https://pbs.twimg.com/a.jpg'],
      mediaSlots: [{ type: 'photo', url: 'https://pbs.twimg.com/a.jpg' }],
    })
    await db.put('bookmarks', bookmark)
    const session = await makeVault()
    await addPrivateTag(db, bookmark.id, 'private-tag-id')
    const updated = await db.get('bookmarks', bookmark.id)
    expect(updated.photos).toBeUndefined()
    expect(updated.mediaSlots).toBeUndefined()

    await removePrivateTag(db, bookmark.id, 'private-tag-id', session)
    const restored = await db.get('bookmarks', bookmark.id)
    expect(restored.photos).toEqual(['https://pbs.twimg.com/a.jpg'])
    expect(restored.mediaSlots).toEqual([{ type: 'photo', url: 'https://pbs.twimg.com/a.jpg' }])
  })

  describe('resolvePrivateStatus', () => {
    it('returns none when no Private tag exists yet', () => {
      expect(resolvePrivateStatus(null, null)).toBe('none')
    })
    it('returns locked when the tag exists but there is no session', () => {
      expect(resolvePrivateStatus('private-tag-id', null)).toBe('locked')
    })
    it('returns unlocked when the tag exists and a session is present', async () => {
      const session = await makeVault()
      expect(resolvePrivateStatus('private-tag-id', session)).toBe('unlocked')
    })
  })

  describe('privateActionNeedsUnlock', () => {
    it('filter always needs unlock', () => {
      expect(privateActionNeedsUnlock({ kind: 'filter' })).toBe(true)
    })
    it('toggle-tag adding (currentlyTagged: false) does not need unlock', () => {
      expect(privateActionNeedsUnlock({ kind: 'toggle-tag', bookmarkId: 'x', currentlyTagged: false })).toBe(false)
    })
    it('toggle-tag removing (currentlyTagged: true) needs unlock', () => {
      expect(privateActionNeedsUnlock({ kind: 'toggle-tag', bookmarkId: 'x', currentlyTagged: true })).toBe(true)
    })
    it('batch-encrypt does not need unlock', () => {
      expect(privateActionNeedsUnlock({ kind: 'batch-encrypt', bookmarkIds: ['x'] })).toBe(false)
    })
  })

  describe('PRIVATE_DROP_KEY', () => {
    it('is a sentinel string, never a valid tag id shape', () => {
      expect(PRIVATE_DROP_KEY).toBe('__private__')
    })
  })

  describe('addPrivateTagBatch', () => {
    it('encrypts every listed bookmark not already Private, without needing a session', async () => {
      await db.put('bookmarks', makeBookmark('b1'))
      await db.put('bookmarks', makeBookmark('b2'))
      await makeVault()
      const result = await addPrivateTagBatch(db, ['b1', 'b2'], 'private-tag-id')
      expect(result.succeeded).toEqual(['b1', 'b2'])
      expect(result.failed).toEqual([])
      const b1 = await db.get('bookmarks', 'b1')
      const b2 = await db.get('bookmarks', 'b2')
      expect(b1.encryptedPayload).toBeDefined()
      expect(b2.encryptedPayload).toBeDefined()
    })

    it('skips (as succeeded, unchanged) a bookmark already carrying the Private tag', async () => {
      const already = makeBookmark('b3', {
        tags: ['private-tag-id'], title: '',
        encryptedPayload: { ephemeralPublicKey: 'e', iv: 'x', ciphertext: 'y' },
      })
      await db.put('bookmarks', already)
      await makeVault()
      const result = await addPrivateTagBatch(db, ['b3'], 'private-tag-id')
      expect(result.succeeded).toEqual(['b3'])
      expect(result.failed).toEqual([])
      const stored = await db.get('bookmarks', 'b3')
      expect(stored.encryptedPayload).toEqual({ ephemeralPublicKey: 'e', iv: 'x', ciphertext: 'y' })
    })

    it('silently skips (neither list) a bookmark id that does not exist', async () => {
      await makeVault()
      const result = await addPrivateTagBatch(db, ['does-not-exist'], 'private-tag-id')
      expect(result.succeeded).toEqual([])
      expect(result.failed).toEqual([])
    })

    it('reports failed ids without throwing when encryption itself fails (corrupted vault record)', async () => {
      await db.put('bookmarks', makeBookmark('b4'))
      await db.put('bookmarks', makeBookmark('b5'))
      await db.put('settings', {
        key: 'private-vault', tagId: 'private-tag-id', salt: 's', iterations: 1000,
        publicKey: 'not-valid-base64-spki', wrappedPrivateKey: { iv: 'x', ciphertext: 'y' },
      })
      const result = await addPrivateTagBatch(db, ['b4', 'b5'], 'private-tag-id')
      expect(result.succeeded).toEqual([])
      expect(result.failed).toEqual(['b4', 'b5'])
    })
  })

  describe('executePrivateAction', () => {
    it('toggle-tag with currentlyTagged: false encrypts the bookmark without needing a session', async () => {
      await db.put('bookmarks', makeBookmark('b6'))
      await makeVault()
      const result = await executePrivateAction(
        db, { kind: 'toggle-tag', bookmarkId: 'b6', currentlyTagged: false }, 'private-tag-id', null,
      )
      expect(result.failed).toEqual([])
      const stored = await db.get('bookmarks', 'b6')
      expect(stored.encryptedPayload).toBeDefined()
    })

    it('toggle-tag with currentlyTagged: true decrypts the bookmark back', async () => {
      const bookmark = makeBookmark('b7')
      await db.put('bookmarks', bookmark)
      const session = await makeVault()
      await addPrivateTag(db, 'b7', 'private-tag-id')
      const result = await executePrivateAction(
        db, { kind: 'toggle-tag', bookmarkId: 'b7', currentlyTagged: true }, 'private-tag-id', session,
      )
      expect(result.failed).toEqual([])
      const stored = await db.get('bookmarks', 'b7')
      expect(stored.encryptedPayload).toBeUndefined()
      expect(stored.title).toBe('My Title')
    })

    it('toggle-tag removing reports a failure instead of throwing (session null)', async () => {
      const bookmark = makeBookmark('b9')
      await db.put('bookmarks', bookmark)
      await makeVault()
      await addPrivateTag(db, 'b9', 'private-tag-id')
      const result = await executePrivateAction(
        db, { kind: 'toggle-tag', bookmarkId: 'b9', currentlyTagged: true }, 'private-tag-id', null,
      )
      expect(result.failed).toEqual(['b9'])
      const stored = await db.get('bookmarks', 'b9')
      // Untouched — the failed remove never got to decrypt/write.
      expect(stored.encryptedPayload).toBeDefined()
    })

    it('batch-encrypt delegates to addPrivateTagBatch and surfaces failed ids', async () => {
      await db.put('bookmarks', makeBookmark('b8'))
      await makeVault()
      const result = await executePrivateAction(
        db, { kind: 'batch-encrypt', bookmarkIds: ['b8', 'missing-id'] }, 'private-tag-id', null,
      )
      expect(result.failed).toEqual([])
      const stored = await db.get('bookmarks', 'b8')
      expect(stored.encryptedPayload).toBeDefined()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npx vitest run lib/private/apply-tag-change.test.ts`
Expected: FAIL — old signatures require `session` on `addPrivateTag`/`addPrivateTagBatch`; `privateActionNeedsUnlock` doesn't exist yet.

- [ ] **Step 3: Implement**

Replace `lib/private/apply-tag-change.ts` in full:

```ts
import type { IDBPDatabase } from 'idb'
import { getBookmark } from '@/lib/storage/indexeddb'
import { encryptWithPublicKey, decryptWithPrivateKey, importPublicKey } from './crypto'
import { loadVaultRecord } from './vault-store'
import type { PrivateVaultSession } from './vault-session'
import type { MediaSlot } from '@/lib/embed/types'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type PrivateFields = {
  readonly title: string
  readonly url: string
  readonly description: string
  readonly thumbnail: string
  readonly favicon: string
  readonly siteName: string
  readonly photos?: readonly string[]
  readonly mediaSlots?: readonly MediaSlot[]
}

const BLANK_FIELDS: PrivateFields = {
  title: '', url: '', description: '', thumbnail: '', favicon: '', siteName: '',
  photos: undefined, mediaSlots: undefined,
}

/** Encrypts the bookmark's sensitive fields under the vault's PUBLIC key
 *  (loaded from the vault record) and adds the Private tag — all in ONE
 *  transaction. No session/password is required: encryption only ever
 *  needs the public half of the vault's key pair, which is not secret and
 *  is always readable from IndexedDB once a vault exists — this is what
 *  lets quick-save surfaces with no unlocked session still tag Private.
 *  No-ops if no vault has been set up yet. */
export async function addPrivateTag(
  db: DbLike,
  bookmarkId: string,
  privateTagId: string,
): Promise<void> {
  const record = await loadVaultRecord(db)
  if (!record) return
  const bookmark = await getBookmark(db, bookmarkId)
  if (!bookmark) return
  const fields: PrivateFields = {
    title: bookmark.title,
    url: bookmark.url,
    description: bookmark.description,
    thumbnail: bookmark.thumbnail,
    favicon: bookmark.favicon,
    siteName: bookmark.siteName,
    photos: bookmark.photos,
    mediaSlots: bookmark.mediaSlots,
  }
  const publicKey = await importPublicKey(record.publicKey)
  const encryptedPayload = await encryptWithPublicKey(publicKey, fields)
  const tx = db.transaction('bookmarks', 'readwrite')
  const store = tx.objectStore('bookmarks')
  const current = await store.get(bookmarkId)
  if (!current) { await tx.done; return }
  const tags = current.tags.includes(privateTagId) ? current.tags : [...current.tags, privateTagId]
  await store.put({ ...current, ...BLANK_FIELDS, encryptedPayload, tags })
  await tx.done
}

/** Decrypts the bookmark's sensitive fields back to plaintext columns,
 *  clears encryptedPayload, then removes the Private tag — all in ONE
 *  transaction. Unlike addPrivateTag, this DOES require an unlocked
 *  `session` — reading the content back out means decrypting, which needs
 *  the private key. */
export async function removePrivateTag(
  db: DbLike,
  bookmarkId: string,
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<void> {
  if (session === null) throw new Error('vault is locked')
  const bookmark = await getBookmark(db, bookmarkId)
  if (!bookmark) return
  const fields = bookmark.encryptedPayload
    ? await decryptWithPrivateKey<PrivateFields>(session.privateKey, bookmark.encryptedPayload)
    : null
  const tx = db.transaction('bookmarks', 'readwrite')
  const store = tx.objectStore('bookmarks')
  const current = await store.get(bookmarkId)
  if (!current) { await tx.done; return }
  const { encryptedPayload: _drop, ...rest } = current
  const tags = current.tags.filter((t: string) => t !== privateTagId)
  await store.put(fields ? { ...rest, ...fields, tags } : { ...rest, tags })
  await tx.done
}

export type PrivateStatus = 'none' | 'locked' | 'unlocked'

/** Derives the 3-state Private status. Pure — no IDB access. `privateTagId`
 *  null means the vault has never been set up; a non-null id with a null
 *  session means it exists but is locked. */
export function resolvePrivateStatus(
  privateTagId: string | null,
  session: PrivateVaultSession,
): PrivateStatus {
  if (privateTagId === null) return 'none'
  if (session === null) return 'locked'
  return 'unlocked'
}

/** Sentinel drop-target key for the MANAGE TAGS panel's pinned Private row. */
export const PRIVATE_DROP_KEY = '__private__'

export type PendingPrivateAction =
  | { readonly kind: 'toggle-tag'; readonly bookmarkId: string; readonly currentlyTagged: boolean }
  | { readonly kind: 'filter' }
  | { readonly kind: 'batch-encrypt'; readonly bookmarkIds: readonly string[] }

/** True when `action` requires decrypting existing content (removing the
 *  Private tag, or viewing/filtering by it) — i.e. requires an unlocked
 *  session. Adding the Private tag (`toggle-tag` with `currentlyTagged:
 *  false`, or `batch-encrypt`) only ever encrypts, which needs just the
 *  vault's public key — never gated on unlock. */
export function privateActionNeedsUnlock(action: PendingPrivateAction): boolean {
  if (action.kind === 'filter') return true
  if (action.kind === 'toggle-tag') return action.currentlyTagged
  return false
}

/** Encrypts each bookmark not already Private, one at a time (each call is
 *  its own atomic transaction via addPrivateTag). No session required —
 *  see addPrivateTag. Additive only, mirroring the plain-tag
 *  drag-and-drop's "union, skip already-tagged" semantics. A bookmark id
 *  that doesn't exist is silently skipped (neither list). A failure on one
 *  card doesn't stop the rest; failed ids come back so the caller can
 *  report them. */
export async function addPrivateTagBatch(
  db: DbLike,
  bookmarkIds: readonly string[],
  privateTagId: string,
): Promise<{ readonly succeeded: readonly string[]; readonly failed: readonly string[] }> {
  const succeeded: string[] = []
  const failed: string[] = []
  for (const id of bookmarkIds) {
    try {
      const bookmark = await getBookmark(db, id)
      if (!bookmark) continue
      if (bookmark.tags.includes(privateTagId)) { succeeded.push(id); continue }
      await addPrivateTag(db, id, privateTagId)
      succeeded.push(id)
    } catch {
      failed.push(id)
    }
  }
  return { succeeded, failed }
}

/** Executes an already-routed `toggle-tag` or `batch-encrypt` action.
 *  `session` is only actually used by the `toggle-tag` + `currentlyTagged:
 *  true` (remove) branch — the add-only branches ignore it, so callers may
 *  pass `null` for those (see privateActionNeedsUnlock). The `filter` kind
 *  is intentionally NOT accepted here — it has no IDB side effect; callers
 *  apply it directly via their own filter-change handler. */
export async function executePrivateAction(
  db: DbLike,
  action: Extract<PendingPrivateAction, { kind: 'toggle-tag' | 'batch-encrypt' }>,
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<{ readonly failed: readonly string[] }> {
  if (action.kind === 'toggle-tag') {
    try {
      if (action.currentlyTagged) {
        await removePrivateTag(db, action.bookmarkId, privateTagId, session)
      } else {
        await addPrivateTag(db, action.bookmarkId, privateTagId)
      }
      return { failed: [] }
    } catch {
      return { failed: [action.bookmarkId] }
    }
  }
  const { failed } = await addPrivateTagBatch(db, action.bookmarkIds, privateTagId)
  return { failed }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npx vitest run lib/private/apply-tag-change.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/private/apply-tag-change.ts lib/private/apply-tag-change.test.ts
git commit -m "feat(private): adding the Private tag no longer requires an unlocked session"
```

---

### Task 6: `resolve-visibility.ts` uses `decryptWithPrivateKey`

**Files:**
- Modify: `lib/private/resolve-visibility.ts`
- Test: `lib/private/resolve-visibility.test.ts`

**Interfaces:**
- Consumes: Task 1's `decryptWithPrivateKey`; Task 4's `PrivateVaultSession.privateKey`.
- Produces: `resolvePrivateVisibility(bookmarks, privateTagId, session): Promise<BookmarkRecord[]>` — signature unchanged.

- [ ] **Step 1: Write the failing tests**

Replace `lib/private/resolve-visibility.test.ts` in full:

```ts
import { describe, it, expect } from 'vitest'
import { resolvePrivateVisibility } from './resolve-visibility'
import { generateEcdhKeyPair, encryptWithPublicKey } from './crypto'
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
    const b = makeBookmark({
      tags: ['priv-1'], title: '',
      encryptedPayload: { ephemeralPublicKey: 'e', iv: 'x', ciphertext: 'y' },
    })
    const result = await resolvePrivateVisibility([b], 'priv-1', null)
    expect(result).toEqual([])
  })

  it('decrypts and overlays Private-tagged bookmarks when unlocked', async () => {
    const pair = await generateEcdhKeyPair()
    const session: PrivateVaultSession = { tagId: 'priv-1', privateKey: pair.privateKey }
    const encryptedPayload = await encryptWithPublicKey(pair.publicKey, {
      title: 'Real Title', url: 'https://secret.example', description: 'd', thumbnail: 'th', favicon: 'f', siteName: 's',
    })
    const b = makeBookmark({ tags: ['priv-1'], title: '', url: '', encryptedPayload })
    const [result] = await resolvePrivateVisibility([b], 'priv-1', session)
    expect(result.title).toBe('Real Title')
    expect(result.url).toBe('https://secret.example')
  })

  it('drops a Private-tagged bookmark that fails to decrypt (fail closed, not garbage)', async () => {
    const pair = await generateEcdhKeyPair()
    const wrongPair = await generateEcdhKeyPair()
    const session: PrivateVaultSession = { tagId: 'priv-1', privateKey: wrongPair.privateKey }
    const encryptedPayload = await encryptWithPublicKey(pair.publicKey, {
      title: 'x', url: 'y', description: '', thumbnail: '', favicon: '', siteName: '',
    })
    const b = makeBookmark({ tags: ['priv-1'], title: '', encryptedPayload })
    const result = await resolvePrivateVisibility([b], 'priv-1', session)
    expect(result).toEqual([])
  })

  it('drops a Private-tagged bookmark that has no encryptedPayload, even when unlocked (fail closed)', async () => {
    const pair = await generateEcdhKeyPair()
    const session: PrivateVaultSession = { tagId: 'priv-1', privateKey: pair.privateKey }
    const b = makeBookmark({ tags: ['priv-1'] })
    const result = await resolvePrivateVisibility([b], 'priv-1', session)
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npx vitest run lib/private/resolve-visibility.test.ts`
Expected: FAIL (type errors — old `session.key`, `decryptJson` shape).

- [ ] **Step 3: Implement**

In `lib/private/resolve-visibility.ts`, change the import and the one decrypt call:

```ts
import { decryptJson } from './crypto'
```
becomes
```ts
import { decryptWithPrivateKey } from './crypto'
```

and

```ts
      const fields = await decryptJson<PrivateFields>(session.key, b.encryptedPayload.iv, b.encryptedPayload.ciphertext)
```
becomes
```ts
      const fields = await decryptWithPrivateKey<PrivateFields>(session.privateKey, b.encryptedPayload)
```

Everything else in the file (the loop structure, the doc comment, the fail-closed `try`/`catch`) stays as-is.

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npx vitest run lib/private/resolve-visibility.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/private/resolve-visibility.ts lib/private/resolve-visibility.test.ts
git commit -m "refactor(private): resolve-visibility decrypts via the ECDH private key"
```

---

### Task 7: `BoardRoot.tsx` — `handlePrivateEntry` routes on decrypt-need, not lock state

**Files:**
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: Task 5's `privateActionNeedsUnlock`.
- Produces: no new exports — this is the board's internal routing logic. Its correctness is verified by Task 11's e2e tests.

- [ ] **Step 1: Update the import**

Find the import line (currently, per the existing codebase):

```tsx
import {
  addPrivateTag, removePrivateTag, resolvePrivateStatus, executePrivateAction, PRIVATE_DROP_KEY,
  // ...other names on this or adjacent lines
} from '@/lib/private/apply-tag-change'
```

Add `privateActionNeedsUnlock` to that import list (alongside the existing names — do not remove any existing import, this task only adds one).

- [ ] **Step 2: Rewrite `handlePrivateEntry`**

Find `handlePrivateEntry` (currently reads `privateSession === null` unconditionally to decide whether to show the unlock dialog). Replace the function body:

```tsx
  /** Single entry point for every "🔒 Private" row/chip's click or drop.
   *  Not-set-up -> opens PrivateSetupDialog; locked -> opens
   *  PrivateUnlockDialog (both remember `action` as pendingPrivateAction, to
   *  auto-resume on success); unlocked -> executes immediately, no dialog. */
  const handlePrivateEntry = useCallback(
    (action: PendingPrivateAction): void => {
      if (privateTagId === null) {
        setPendingPrivateAction(action)
        setPrivateDialog('setup')
        return
      }
      if (privateSession === null) {
        setPendingPrivateAction(action)
        // Mirrors onOpenPrivate's SETTINGS-path hint load below — the hint is
        // the only recovery mechanism this feature has (no backdoor, by
        // design), so it must appear on these 3 new entry points too, not
        // just the pre-existing SETTINGS entry (final whole-branch review
        // finding).
        void (async (): Promise<void> => {
          const record = await loadVaultRecord(await initDB())
          if (record) setPrivateHint(record.hint)
        })()
        setPrivateDialog('unlock')
        return
      }
      void runPrivateAction(action, privateTagId, privateSession)
    },
    [privateTagId, privateSession, runPrivateAction],
  )
```

with:

```tsx
  /** Single entry point for every "🔒 Private" row/chip's click or drop.
   *  Not-set-up -> opens PrivateSetupDialog. Otherwise: actions that only
   *  encrypt (adding the tag, batch-encrypting — privateActionNeedsUnlock
   *  === false) run immediately regardless of lock state, since encryption
   *  only needs the vault's public key, never the password. Actions that
   *  need to decrypt (removing the tag, filtering/viewing) open
   *  PrivateUnlockDialog when locked (remembered as pendingPrivateAction,
   *  to auto-resume on success). */
  const handlePrivateEntry = useCallback(
    (action: PendingPrivateAction): void => {
      if (privateTagId === null) {
        setPendingPrivateAction(action)
        setPrivateDialog('setup')
        return
      }
      if (privateActionNeedsUnlock(action) && privateSession === null) {
        setPendingPrivateAction(action)
        // Mirrors onOpenPrivate's SETTINGS-path hint load below — the hint is
        // the only recovery mechanism this feature has (no backdoor, by
        // design), so it must appear on these entry points too, not just
        // the pre-existing SETTINGS entry (final whole-branch review
        // finding).
        void (async (): Promise<void> => {
          const record = await loadVaultRecord(await initDB())
          if (record) setPrivateHint(record.hint)
        })()
        setPrivateDialog('unlock')
        return
      }
      void runPrivateAction(action, privateTagId, privateSession)
    },
    [privateTagId, privateSession, runPrivateAction],
  )
```

`runPrivateAction` itself needs NO changes — it already forwards `session` opaquely to `executePrivateAction` (Task 5), which now tolerates `null` for add-only actions.

- [ ] **Step 3: Verify it compiles**

Run: `rtk npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/board/BoardRoot.tsx
git commit -m "feat(private): adding Private no longer requires unlocking on the board"
```

(This task's behavioral correctness is exercised by Task 11's e2e tests, not a unit test — `handlePrivateEntry` is a closure inside a large client component with no existing unit-test seam, matching how the rest of this function is already tested in this codebase.)

---

### Task 8: Unify the "🔒 Private" icon+label, remove the icon-to-label space

**Files:**
- Create: `lib/private/ui-labels.ts`
- Modify: `components/board/FilterPill.tsx`, `components/board/FilterPill.module.css`
- Modify: `components/board/TagDropPanel.tsx`, `components/board/TagDropPanel.module.css`
- Modify: `components/board/BoardMobileTagBar.tsx`
- Modify: `components/board/ExtensionEntry.tsx`
- Modify: `components/board/TagAddPopover/index.tsx`

**Interfaces:**
- Produces: `PRIVATE_LOCKED_ICON`, `PRIVATE_UNLOCKED_ICON`, `PRIVATE_LABEL` constants, imported by all 5 render sites below.

- [ ] **Step 1: Create the shared constants file**

Create `lib/private/ui-labels.ts`:

```ts
/** Single source for the "🔒 Private" icon+label rendered across FilterPill,
 *  TagDropPanel, BoardMobileTagBar, ExtensionEntry, and TagAddPopover —
 *  change the icon here once to change it everywhere it appears. */
export const PRIVATE_LOCKED_ICON = '🔒'
export const PRIVATE_UNLOCKED_ICON = '🔓'
export const PRIVATE_LABEL = 'Private'
```

- [ ] **Step 2: `FilterPill.tsx` + `FilterPill.module.css`**

Add to the top imports of `FilterPill.tsx`:

```tsx
import { PRIVATE_LOCKED_ICON, PRIVATE_LABEL } from '@/lib/private/ui-labels'
```

Replace:

```tsx
              <span className={styles.privateIcon} aria-hidden="true">🔒</span>
              <span className={styles.itemLabel}>Private</span>
```

with:

```tsx
              <span className={styles.privateIcon} aria-hidden="true">{PRIVATE_LOCKED_ICON}</span>
              <span className={styles.itemLabel}>{PRIVATE_LABEL}</span>
```

In `FilterPill.module.css`, immediately before the existing `.privateIcon { ... }` rule, add a new rule that overrides the parent `.item`'s `gap: 10px` for this row only (both `.item` and `.privateItem` are single-class selectors already combined on this button's `className`, so a later same-specificity rule wins):

```css
.privateItem {
  gap: 0;
}
```

- [ ] **Step 3: `TagDropPanel.tsx` + `TagDropPanel.module.css`**

Add to the top imports of `TagDropPanel.tsx`:

```tsx
import { PRIVATE_LOCKED_ICON, PRIVATE_LABEL } from '@/lib/private/ui-labels'
```

Replace:

```tsx
            <span className={styles.privateIcon} aria-hidden="true">🔒</span>
            <span className={styles.tagLabel}>Private</span>
```

with:

```tsx
            <span className={styles.privateIcon} aria-hidden="true">{PRIVATE_LOCKED_ICON}</span>
            <span className={styles.tagLabel}>{PRIVATE_LABEL}</span>
```

In `TagDropPanel.module.css`, this row's container is the shared `.tagItem` class (no Private-only modifier class exists), but it does carry a Private-only `data-private-status` attribute — use that to scope the gap override without touching any other row. Add, near the existing `.privateIcon` rule:

```css
.tagItem[data-private-status] {
  gap: 0;
}
```

- [ ] **Step 4: `BoardMobileTagBar.tsx`**

Add to the top imports:

```tsx
import { PRIVATE_LOCKED_ICON, PRIVATE_LABEL } from '@/lib/private/ui-labels'
```

Replace:

```tsx
          <span className={styles.tagLabel}>🔒 Private</span>
```

with:

```tsx
          <span className={styles.tagLabel}>{PRIVATE_LOCKED_ICON}{PRIVATE_LABEL}</span>
```

(No CSS change here — this row never used a flex `gap` for the icon/label; it was one literal string with a space, now two adjacent expressions with none.)

- [ ] **Step 5: `ExtensionEntry.tsx`**

Add to the top imports:

```tsx
import { PRIVATE_LOCKED_ICON, PRIVATE_UNLOCKED_ICON, PRIVATE_LABEL } from '@/lib/private/ui-labels'
```

Replace:

```tsx
            {privateStatus === 'unlocked' ? '🔓 PRIVATE (UNLOCKED)' : '🔒 PRIVATE'}
```

with:

```tsx
            {privateStatus === 'unlocked'
              ? `${PRIVATE_UNLOCKED_ICON}${PRIVATE_LABEL.toUpperCase()} (UNLOCKED)`
              : `${PRIVATE_LOCKED_ICON}${PRIVATE_LABEL.toUpperCase()}`}
```

(This button's own existing convention is ALL CAPS, unlike the other four sites — `.toUpperCase()` preserves that exactly while still sourcing the word from the one shared constant.)

- [ ] **Step 6: `TagAddPopover/index.tsx`**

Add to the top imports:

```tsx
import { PRIVATE_LOCKED_ICON, PRIVATE_LABEL } from '@/lib/private/ui-labels'
```

Replace:

```tsx
                🔒 {privateEntry.isTagged ? '✓ ' : ''}Private
```

with:

```tsx
                {PRIVATE_LOCKED_ICON}{privateEntry.isTagged ? '✓ ' : ''}{PRIVATE_LABEL}
```

(Only the icon-to-content gap is removed, per what was approved — the checkmark's own trailing space when `isTagged` is true is untouched, since "✓ Private" reads naturally as two words.)

- [ ] **Step 7: Verify nothing else asserts on the old literal text**

Run: `rtk grep -rn "🔒 Private\|🔒 PRIVATE" tests/ components/ app/ extension/`
Expected: no matches (confirms no test or other component still expects the old spaced text). If any match turns up, update it to match the new spacing before proceeding.

- [ ] **Step 8: Verify it compiles**

Run: `rtk npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add lib/private/ui-labels.ts components/board/FilterPill.tsx components/board/FilterPill.module.css components/board/TagDropPanel.tsx components/board/TagDropPanel.module.css components/board/BoardMobileTagBar.tsx components/board/ExtensionEntry.tsx components/board/TagAddPopover/index.tsx
git commit -m "style(private): unify the Private icon+label, remove the icon-label gap"
```

---

### Task 9: PopOut (`PipCompanion.tsx`) wires a Private chip into its quick-tag popover

**Files:**
- Modify: `components/pip/PipCompanion.tsx`

**Interfaces:**
- Consumes: Task 5's `addPrivateTag(db, bookmarkId, privateTagId): Promise<void>`; `loadVaultRecord` from `@/lib/private/vault-store`; `TagAddPopoverProps.privateEntry` (already exists, currently unused here).
- Produces: nothing new for other tasks — this is a leaf UI wiring.

**Design:** PopOut runs in the same JS realm as the main board (a `createPortal` into a Document Picture-in-Picture window, not a real navigation — see spec §5), so it could in principle read `usePrivateVaultSession()` directly. But since Private tagging never needs a session any more (Task 5), the simplest and most robust wiring doesn't touch the session at all: on mount, load the vault record once to learn whether a vault exists (`hasVault`) and what its `tagId` is; clicking the chip calls `addPrivateTag` directly. When no vault exists yet, clicking shows a small transient notice instead of attempting anything.

- [ ] **Step 1: Add imports**

Add to `PipCompanion.tsx`'s imports:

```tsx
import { loadVaultRecord } from '@/lib/private/vault-store'
import { addPrivateTag } from '@/lib/private/apply-tag-change'
```

- [ ] **Step 2: Track vault existence + a transient "set up in the app" notice**

Add new state alongside the existing `allTags` state (near line 62):

```tsx
  // Whether a Private vault has ever been set up — learned once from IDB (the
  // vault record's public key is not secret, so this needs no unlock). null
  // until the initial load resolves; the chip stays hidden-behavior-wise
  // (status 'none') until then, same as "not set up yet".
  const [privateTagId, setPrivateTagId] = useState<string | null>(null)
  // Shows a brief "set up Private in the app first" notice when the user
  // taps the chip before any vault exists. Auto-clears.
  const [privateSetupNotice, setPrivateSetupNotice] = useState(false)
```

Add `useState` to this file's existing `import { useEffect, useRef, useState, useCallback, type ReactElement } from 'react'` if not already imported — it already is (line 3), so no import change needed for `useState`.

- [ ] **Step 3: Load the vault record on mount**

Add a new effect alongside the existing "load all tags" effect (near line 100-105):

```tsx
  useEffect(() => {
    void (async () => {
      const db = await initDB()
      const record = await loadVaultRecord(db)
      setPrivateTagId(record?.tagId ?? null)
    })()
  }, [])
```

- [ ] **Step 4: Handle the chip click**

Add a handler near `handleAddExisting`/`handleAddNew` (after line 210) — `initDB()` awaited inline via an async IIFE, matching how `handleAddExisting`/`handleAddNew` already do it:

```tsx
  const handlePrivateChip = useCallback((bookmarkId: string) => {
    if (privateTagId === null) {
      setPrivateSetupNotice(true)
      setTimeout(() => setPrivateSetupNotice(false), 3000)
      return
    }
    const tagId = privateTagId
    void (async () => {
      const db = await initDB()
      await addPrivateTag(db, bookmarkId, tagId)
    })()
  }, [privateTagId])
```

- [ ] **Step 5: Wire `privateEntry` into the `TagAddPopover` call**

Replace:

```tsx
            <TagAddPopover
              compact
              allTags={allTags}
              currentTagIds={menuCard.currentTagIds ?? []}
              suggestedEntries={menuCard.suggestedEntries ?? []}
              closing={tagMenuClosing}
              onExited={finishCloseTagMenu}
              onAddExisting={(tagId) => { void handleAddExisting(tagMenuFor, tagId) }}
              onAddNew={(name) => { void handleAddNew(tagMenuFor, name); beginCloseTagMenu() }}
              onClose={beginCloseTagMenu}
            />
```

with:

```tsx
            <TagAddPopover
              compact
              allTags={allTags}
              currentTagIds={menuCard.currentTagIds ?? []}
              suggestedEntries={menuCard.suggestedEntries ?? []}
              closing={tagMenuClosing}
              onExited={finishCloseTagMenu}
              onAddExisting={(tagId) => { void handleAddExisting(tagMenuFor, tagId) }}
              onAddNew={(name) => { void handleAddNew(tagMenuFor, name); beginCloseTagMenu() }}
              onClose={beginCloseTagMenu}
              privateEntry={{
                status: privateTagId === null ? 'none' : 'locked',
                isTagged: false,
                onClick: (): void => handlePrivateChip(tagMenuFor),
              }}
            />
```

(`status` is always either `'none'` or `'locked'` here, never `'unlocked'` — PopOut never carries its own unlock session for this purpose since tagging doesn't need one; `isTagged` is always `false` because these are freshly-saved cards. `TagAddPopover` itself needs no changes — this prop shape already matches its existing `privateEntry?` type.)

- [ ] **Step 6: Render the transient notice**

Add, inside the `{tagMenuFor && menuCard && (...)}` block, right after the `<TagAddPopover ... />` closing tag but still inside `.tagPanel`:

```tsx
            {privateSetupNotice && (
              <div className={styles.privateSetupNotice} data-testid="pip-private-setup-notice">
                Set up Private in the AllMarks board first.
              </div>
            )}
```

Add the corresponding class to `PipCompanion.module.css` (append at the end of the file):

```css
.privateSetupNotice {
  margin-top: 8px;
  padding: 6px 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
}
```

- [ ] **Step 7: Verify it compiles**

Run: `rtk npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/pip/PipCompanion.tsx components/pip/PipCompanion.module.css
git commit -m "feat(private): PopOut can tag Private on a just-saved card"
```

---

### Task 10: Bookmarklet (`SaveToast.tsx`) wires a Private chip into its quick-tag popover

**Files:**
- Modify: `components/bookmarklet/SaveToast.tsx`

**Interfaces:**
- Consumes: Task 5's `addPrivateTag`; `loadVaultRecord` from `@/lib/private/vault-store`; `TagAddPopoverProps.privateEntry`.
- Produces: nothing new for other tasks.

**Design:** Same shape as Task 9. `SaveToast.tsx` already caches its `initDB()` result in `dbRef` (line 74) — reuse that.

- [ ] **Step 1: Add imports**

Add to `SaveToast.tsx`'s imports:

```tsx
import { loadVaultRecord } from '@/lib/private/vault-store'
import { addPrivateTag } from '@/lib/private/apply-tag-change'
```

- [ ] **Step 2: Track vault existence + notice state**

Add near the existing `const [tagData, setTagData] = useState<TagData | null>(null)` (line 70):

```tsx
  const [privateTagId, setPrivateTagId] = useState<string | null>(null)
  const [privateSetupNotice, setPrivateSetupNotice] = useState(false)
```

- [ ] **Step 3: Load the vault record alongside the existing tag load**

Inside the `if (plan.showTags) { ... }` block (lines 117-127), after `setTagData({...})`, add:

```tsx
          const vaultRecord = await loadVaultRecord(db)
          setPrivateTagId(vaultRecord?.tagId ?? null)
```

- [ ] **Step 4: Handle the chip click**

Add a new async function alongside `handleAddExisting`/`handleAddNew` (after line 197):

```tsx
  async function handlePrivateChip(): Promise<void> {
    if (!tagData) return
    if (privateTagId === null) {
      setPrivateSetupNotice(true)
      setTimeout(() => setPrivateSetupNotice(false), 3000)
      return
    }
    const db = dbRef.current ?? (await initDB())
    await addPrivateTag(db, tagData.bookmarkId, privateTagId)
  }
```

- [ ] **Step 5: Wire `privateEntry` into the `TagAddPopover` call**

Replace:

```tsx
          <TagAddPopover
            compact
            allTags={tagData.allTags}
            currentTagIds={tagData.currentTagIds}
            suggestedEntries={tagData.suggestedEntries}
            onAddExisting={(id) => { void handleAddExisting(id) }}
            onAddNew={(name) => { void handleAddNew(name) }}
            onClose={() => { /* lifecycle owns dismissal */ }}
          />
```

with:

```tsx
          <TagAddPopover
            compact
            allTags={tagData.allTags}
            currentTagIds={tagData.currentTagIds}
            suggestedEntries={tagData.suggestedEntries}
            onAddExisting={(id) => { void handleAddExisting(id) }}
            onAddNew={(name) => { void handleAddNew(name) }}
            onClose={() => { /* lifecycle owns dismissal */ }}
            privateEntry={{
              status: privateTagId === null ? 'none' : 'locked',
              isTagged: false,
              onClick: (): void => { void handlePrivateChip() },
            }}
          />
```

- [ ] **Step 6: Render the transient notice**

Add, right after the `</TagAddPopover>`'s closing (within `.tagScroll`, after line 324's `/>`):

```tsx
          {privateSetupNotice && (
            <div className={styles.privateSetupNotice} data-testid="save-toast-private-setup-notice">
              Set up Private in the AllMarks board first.
            </div>
          )}
```

Add to `SaveToast.module.css` (append):

```css
.privateSetupNotice {
  margin-top: 8px;
  padding: 6px 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
}
```

- [ ] **Step 7: Verify it compiles**

Run: `rtk npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/bookmarklet/SaveToast.tsx components/bookmarklet/SaveToast.module.css
git commit -m "feat(private): bookmarklet quick-save can tag Private"
```

---

### Task 11: Extension save-iframe — `booklage:add-private-tag` message backend

**Files:**
- Modify: `lib/utils/save-message.ts`
- Modify: `app/save-iframe/SaveIframeClient.tsx`

**Interfaces:**
- Consumes: Task 5's `addPrivateTag`; `loadVaultRecord` from `@/lib/private/vault-store`.
- Produces: the `booklage:add-private-tag` / `booklage:add-private-tag:result` message contract, and a `privateTagId` field on the save reply — both are what the extension's own content-script strip (a separate follow-up, see Out of Scope) will need to consume.

**Note:** This task only builds the *receiving* end inside this Next.js app. Nothing in `extension/` sends this message yet — that is explicitly out of scope here (see the plan's closing note). This task is still independently valuable and testable: it is exercised the same way the existing `booklage:add-tag` message is, by posting a message at the iframe directly (as the existing e2e/manual test approach already does for `booklage:add-tag`).

- [ ] **Step 1: Add the message schema**

In `lib/utils/save-message.ts`, after the existing `AddNewTagMessage`/`parseAddNewTagMessage`/`AddNewTagResult` block (end of file), add:

```ts
// Applies the Private tag to the just-saved bookmark by encrypting it under
// the vault's public key — no password/session needed (lib/private/
// apply-tag-change.ts addPrivateTag). A no-op (ok: false) if no vault has
// been set up yet; the caller (extension strip) is expected to only show
// this option when the save reply's `privateTagId` field is present.
const AddPrivateTagMessage = z.object({
  type: z.literal('booklage:add-private-tag'),
  payload: z.object({
    bookmarkId: z.string().min(1),
    nonce: z.string().min(1),
  }),
})
export type AddPrivateTagMessageInput = z.infer<typeof AddPrivateTagMessage>
export function parseAddPrivateTagMessage(input: unknown): ParseResult<AddPrivateTagMessageInput> {
  const r = AddPrivateTagMessage.safeParse(input)
  if (r.success) return { ok: true, value: r.data }
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  }
}

export type AddPrivateTagResult =
  | { type: 'booklage:add-private-tag:result'; nonce: string; ok: true }
  | { type: 'booklage:add-private-tag:result'; nonce: string; ok: false; error: string }
```

Also add `privateTagId?: string` to the success variant of `SaveMessageResult` (the type currently listing `tags?`, `currentTagIds?`, `themeTokens?`, `quickTagEnabled?`, `pipActive?`):

```ts
      /** Existing tags, relevant-first, for the quick-tag strip. */
      tags?: QuickTag[]
      /** Tag ids already on this bookmark (marked ✓ in the strip). */
      currentTagIds?: string[]
      /** Active theme's resolved tokens; strip auto-follows theme changes. */
      themeTokens?: StripThemeTokens
      /** Whole-feature ON/OFF (read from app IDB). false = extension shows no
       *  strip (plain save confirmation only). Absent = treat as ON. */
      quickTagEnabled?: boolean
      /** True when a PiP companion window is open at save time. The extension
       *  suppresses its host-page strip when true (PiP handles tagging on the
       *  card instead) — avoids the two surfaces colliding. */
      pipActive?: boolean
      /** The Private tag's id, present only when a vault has been set up.
       *  Absent = no vault yet = the strip should not offer a Private option
       *  (tagging Private through this un-encrypting quick-tag path is
       *  never allowed regardless — see isPrivateVaultTagId — so this field
       *  exists purely so the strip UI knows whether to show the option at
       *  all, not as a permission check). */
      privateTagId?: string
```

- [ ] **Step 2: Handle the new message in `SaveIframeClient.tsx`**

Add to the imports:

```tsx
import { loadVaultRecord } from '@/lib/private/vault-store'
import { addPrivateTag } from '@/lib/private/apply-tag-change'
```

and add `parseAddPrivateTagMessage` to the existing `import { parseSaveMessage, parseProbeMessage, parseAddTagMessage, parseAddNewTagMessage, ... } from '@/lib/utils/save-message'` block.

Add a new handler branch in the message `handler`, right after the existing `addNewTagParsed` block (after its closing `return` and `}` around line 216, before `const parsed = parseSaveMessage(ev.data)`):

```tsx
      const addPrivateTagParsed = parseAddPrivateTagMessage(ev.data)
      if (addPrivateTagParsed.ok) {
        const { bookmarkId, nonce } = addPrivateTagParsed.value.payload
        try {
          const db = await initDB()
          const record = await loadVaultRecord(db)
          if (!record) {
            ev.source?.postMessage(
              { type: 'booklage:add-private-tag:result', nonce, ok: false, error: 'no vault set up' },
              { targetOrigin: ev.origin },
            )
            return
          }
          await addPrivateTag(db, bookmarkId, record.tagId)
          ev.source?.postMessage(
            { type: 'booklage:add-private-tag:result', nonce, ok: true },
            { targetOrigin: ev.origin },
          )
        } catch (err) {
          ev.source?.postMessage(
            { type: 'booklage:add-private-tag:result', nonce, ok: false, error: err instanceof Error ? err.message : String(err) },
            { targetOrigin: ev.origin },
          )
        }
        return
      }
```

- [ ] **Step 3: Include `privateTagId` in the save reply's payload**

In `buildSavePayload` (the function returning `{tags, currentTagIds, themeTokens, quickTagEnabled}`), add a `privateTagId` field:

```tsx
async function buildSavePayload(
  db: SaveDb,
  bookmark: BookmarkRecord,
): Promise<{
  tags: ReturnType<typeof orderTagsForSave>
  currentTagIds: string[]
  themeTokens: StripThemeTokens
  quickTagEnabled: boolean
  privateTagId?: string
}> {
  const [corpus, rawTags, quickTagEnabled, boardConfig, vaultRecord] = await Promise.all([
    getAllBookmarks(db),
    getAllTags(db),
    loadQuickTagEnabled(db),
    loadBoardConfig(db),
    loadVaultRecord(db),
  ])
  const allTags = rawTags.filter((t) => t.isPrivateVault !== true)
  if (typeof document !== 'undefined' && boardConfig.themeId) {
    document.documentElement.setAttribute('data-theme-id', boardConfig.themeId)
  }
  return {
    tags: orderTagsForSave(bookmark, corpus, allTags),
    currentTagIds: bookmark.tags,
    themeTokens: readThemeTokens(),
    quickTagEnabled,
    ...(vaultRecord ? { privateTagId: vaultRecord.tagId } : {}),
  }
}
```

- [ ] **Step 4: Verify it compiles**

Run: `rtk npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manually verify the message round-trips**

This file has no existing unit test (it's exercised via e2e/manual extension testing per the codebase's existing pattern for `booklage:add-tag`). Confirm by running the dev server and posting a message at the iframe from the browser console:

Run: `rtk pnpm dev`

Then, with `/save-iframe` open in a tab (or via the existing e2e harness's iframe-posting pattern in `tests/e2e/save-iframe.spec.ts` as a reference), verify a `booklage:add-private-tag` message with a valid `bookmarkId` (of a bookmark saved without a vault present) returns `{ok: false, error: 'no vault set up'}`, and that after creating a vault via the main board, the same message returns `{ok: true}` and the bookmark's `encryptedPayload` is set.

- [ ] **Step 6: Commit**

```bash
git add lib/utils/save-message.ts app/save-iframe/SaveIframeClient.tsx
git commit -m "feat(private): save-iframe backend accepts add-private-tag messages"
```

---

### Task 12: e2e coverage for the new lock-independent add behavior

**Files:**
- Modify: `tests/e2e/private-vault.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 3, 5, 7 (the full retrofit) as running application behavior.
- Produces: nothing consumed by later tasks — this is the plan's final verification layer.

**Context:** The existing 6 test cases in this file never exercise "tag while locked" (see spec's own e2e coverage-gap note) — they either tag while already unlocked, or resume a setup dialog from `'none'` state. None require modification. The 3 new tests below reuse this file's own `seedDb`, `firstRunSuppressors`, `seedOneBookmark`, `seedTwoBookmarks`, `openSettings`, `PASSWORD`, and `BOOKMARK_ID` (all already defined at the top of the file — no new helpers needed).

- [ ] **Step 1: Write the new test — card + button adds Private while locked, no dialog**

Add to `tests/e2e/private-vault.spec.ts`, as a new top-level `test(...)` (e.g. right after the existing `'Private-tagged card shows its own hover pill...'` test, before the `stale-reload-closure race` describe block):

```ts
test('card + button Private chip encrypts immediately while locked, no unlock dialog', async ({ page }) => {
  // Task 5/7: adding the Private tag (encrypting) no longer requires the
  // vault to be unlocked — only removing/viewing does. Reproduces this
  // file's first test's lock round-trip (create vault, reload to drop the
  // session) but then adds the tag from the LOCKED state, asserting no
  // unlock dialog ever appears.
  await seedDb(page, [...firstRunSuppressors(), ...seedOneBookmark()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  const card = page.locator(`[data-bookmark-id="${BOOKMARK_ID}"]`)
  await expect(card).toBeVisible({ timeout: 15_000 })

  // 1. Create the vault (leaves the session unlocked in this tab).
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const setupDialog = page.getByTestId('private-setup-dialog')
  await expect(setupDialog).toBeVisible()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()
  await expect(setupDialog).toHaveCount(0)

  // 2. Reload — the vault's entire re-lock mechanism (vault-session.ts is a
  // plain module singleton, reset by any reload). privateTagId (from
  // useTags()) survives the reload; privateSession does not.
  await page.reload()
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await expect(card).toBeVisible({ timeout: 15_000 })

  // 3. From this locked state, tag the card Private via the card's own
  // +TAG popover.
  await card.hover()
  await card.getByTestId('card-add-tag-button').click({ force: true })
  const privateChip = card.getByTestId('tag-add-popover-private')
  await expect(privateChip).toHaveAttribute('data-private-status', 'locked')
  await privateChip.click()

  // 4. No unlock dialog should ever appear — adding Private doesn't need
  // the password.
  await expect(page.getByTestId('private-unlock-dialog')).toHaveCount(0)

  // 5. The tag landed for real: the card is now Private-tagged and drops
  // out of the default ALL view (resolvePrivateVisibility, same signal
  // this file's other tests already use).
  await expect(card).toHaveCount(0)
})
```

- [ ] **Step 2: Write the new test — mobile TAG MODE batch-encrypt works while locked**

```ts
test('mobile TAG MODE: tapping Private after selecting two cards encrypts them both, even while locked', async ({ page }) => {
  await seedDb(page, [...firstRunSuppressors(), ...seedTwoBookmarks()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()

  // Reload to lock the vault (same re-lock mechanism as the previous test)
  // before switching to the mobile viewport.
  await page.reload()
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('mobile-nav-tag').dispatchEvent('click')
  const cardA = page.locator(`[data-bookmark-id="${BOOKMARK_ID}"]`)
  const cardB = page.locator('[data-bookmark-id="priv-b-1"]')
  await cardA.click()
  await cardB.click()
  const privateChip = page.getByTestId('mobile-tag-private')
  await expect(privateChip).toHaveAttribute('data-private-status', 'locked')
  await privateChip.click()

  // No unlock dialog — batch-encrypting doesn't need the password either.
  await expect(page.getByTestId('private-unlock-dialog')).toHaveCount(0)

  await page.getByTestId('mobile-tag-done').click()
  await page.reload()
  await expect(cardA).toHaveCount(0)
  await expect(cardB).toHaveCount(0)
})
```

- [ ] **Step 3: Write the new test — removing Private still requires an unlocked session**

```ts
test('removing the Private tag while unlocked still decrypts and restores the card (fail-closed retained)', async ({ page }) => {
  // Task 5/7 made ADDING Private lock-independent, but REMOVING it (which
  // must decrypt the stored payload back to plaintext) is untouched — still
  // gated on an unlocked session (removePrivateTag throws otherwise).
  // Locked-state removal can't be driven through the UI at all: a
  // Private-tagged card is never rendered while locked
  // (resolvePrivateVisibility drops it outright), so there's no chip to
  // click in that state. This test instead confirms the still-gated remove
  // path itself keeps working correctly end-to-end while unlocked, guarding
  // against Task 5's rewrite of removePrivateTag/executePrivateAction
  // accidentally breaking (not just accidentally un-gating) removal.
  await seedDb(page, [...firstRunSuppressors(), ...seedOneBookmark()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  const card = page.locator(`[data-bookmark-id="${BOOKMARK_ID}"]`)
  await expect(card).toBeVisible({ timeout: 15_000 })

  // 1. Create the vault and tag the card Private (mirrors this file's first
  // test, steps 2-3).
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const setupDialog = page.getByTestId('private-setup-dialog')
  await expect(setupDialog).toBeVisible()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()
  await expect(setupDialog).toHaveCount(0)
  await card.hover()
  await card.getByTestId('card-add-tag-button').click({ force: true })
  await card.getByTestId('tag-add-popover-private').click()
  await expect(card).toHaveCount(0)

  // 2. Filter to the Private tag to bring the card back on screen (still
  // unlocked in this same session — no reload here, since this test
  // targets the remove path, not the lock round-trip).
  await page.getByTestId('filter-pill').click()
  const privateRow = page.getByTestId('filter-pill-private')
  await expect(privateRow).toHaveAttribute('data-private-status', 'unlocked')
  await privateRow.click()
  await expect(card).toBeVisible()
  await page.keyboard.press('Escape')

  // 3. Click the card's own Private chip again — now isTagged: true, so
  // this routes through the currentlyTagged:true (remove) branch.
  await card.hover()
  await card.getByTestId('card-add-tag-button').click({ force: true })
  const privateChip = card.getByTestId('tag-add-popover-private')
  await expect(privateChip).toHaveAttribute('data-has', 'true')
  await privateChip.click()

  // 4. The card is no longer Private-tagged, so it drops out of the
  // Private-only filter view...
  await expect(card).toHaveCount(0)

  // 5. ...and reappears, decrypted, in the default ALL view with its real
  // title restored — proving removePrivateTag's decrypt-and-restore path
  // still works after Task 5's rewrite.
  await page.getByTestId('filter-pill').click()
  await page.getByTestId('filter-pill-menu').getByText('ALL', { exact: true }).click()
  await expect(card).toBeVisible()
  await expect(card).toContainText('Private vault e2e card')
})
```

- [ ] **Step 4: Run the full e2e file**

Run: `rtk npx playwright test tests/e2e/private-vault.spec.ts`
Expected: all tests (the original 6 plus the 3 new ones) PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/private-vault.spec.ts
git commit -m "test(private): e2e coverage for lock-independent Private tagging"
```

---

### Task 13: Full gate

**Files:** none (verification only)

- [ ] **Step 1: Type-check**

Run: `rtk npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Full unit test suite**

Run: `rtk npx vitest run`
Expected: all tests pass (no regressions in files this plan didn't touch).

- [ ] **Step 3: Full e2e suite**

Run: `rtk npx playwright test`
Expected: all tests pass, including `tests/e2e/save-iframe.spec.ts` (Task 11 touched `SaveIframeClient.tsx`) and the rest of `tests/e2e/private-vault.spec.ts`'s pre-existing 6 cases (Tasks 5/7 must not have broken the setup/unlock/SHARE-gating flows those already cover).

- [ ] **Step 4: Build**

Run: `rtk pnpm build`
Expected: succeeds.

- [ ] **Step 5: Do NOT commit** — this task is verification-only. If any step fails, return to the task that introduced the regression, fix it there, and re-run this gate.

- [ ] **Step 6: Security review of the new crypto code**

Per spec §7: once Task 13's gate is green, run the `security-review` skill/command over this branch's diff before merging — the ECDH/HKDF/key-wrapping code in `lib/private/crypto.ts` (Task 1) and `lib/private/vault-store.ts` (Task 3) is genuinely new cryptographic composition (not a mechanical refactor) and deserves a dedicated pass beyond the normal code review, independent of who implemented each task.

---

## Out of Scope (explicit follow-up)

The extension's own content-script strip UI (`extension/floating-button.js`, `extension/twitter.js`, both vanilla JS DOM-rendering, ~700 and ~180 lines respectively, sharing pure helpers from `extension/lib/tag-strip-model.js`) is **not** part of this plan. Task 11 builds the receiving end (`booklage:add-private-tag` message handler in `SaveIframeClient.tsx`) and exposes `privateTagId` on the save reply so the strip can learn whether to show a Private option — but nothing in `extension/` sends that message yet, so end users cannot actually tag Private from the extension's on-page strip until that follow-up lands. This was a deliberate scope decision (see chat) to avoid rushing changes to vanilla-JS content-script code that is already live in production, without first reading `floating-button.js`/`twitter.js` in full. Recommended immediately after this plan ships: a short, tightly-scoped follow-up plan (no new brainstorming needed — the message contract and backend are already final) covering just the strip's DOM/click-handler changes in those two files.
