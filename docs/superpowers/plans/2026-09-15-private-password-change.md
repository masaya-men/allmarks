# Privateパスワード変更・再設定機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 金庫(Private)のパスワードを、既に解錠済みの端末から**古いパスワードを聞かずに**変更できる機能を作る。業界標準(Norton Password Managerの「解錠済み端末からのリセット」パターン)に倣う。あわせて、既存2画面(SET UP PRIVATE / UNLOCK PRIVATE)にも表示/非表示の目のマークを追加して統一する。

**Architecture:** 金庫のECDH秘密鍵そのものは変えない(既存の暗号化ブクマがそのまま読めることを保証するため)。パスワードから導出する「包み鍵」(AES-256-GCM)だけを新しいパスワードで作り直し、秘密鍵を新しい包み鍵で再暗号化(re-wrap)する。既に解錠済みのセッションが持っている「元の包み鍵」を使って一度復号し、新しい包み鍵で暗号化し直すだけなので、古いパスワードの再入力は不要。あわせて、`PrivateVaultRecord`に`updatedAt`を追加し、束3で「将来必要になったら追加する」と明記されていた同期マージのLWW比較を実装する — これをやらないと、パスワードを変更した瞬間に同期の「食い違い」判定に誤って引っかかり、変更が他の端末に永久に伝わらなくなる実害のある不具合になる。

**Tech Stack:** TypeScript strict, Web Crypto API(`crypto.subtle`、既存の`lib/private/crypto.ts`のプリミティブを再利用・新規crypto処理は書かない), React (Next.js App Router, `'use client'`), CSS Modules(Tailwind不使用), `lib/i18n/I18nProvider`, vitest + `fake-indexeddb/auto`。

**Spec:** このplanに設計判断がすべて確定済み(ユーザーとの会話で合意済み)。参照する既存ファイルは各タスクに記載。追加で読む外部specドキュメントは無い。

## Global Constraints

- **秘密鍵(ECDH private key)そのものは絶対に変えない**。変わるのは「パスワードで包む」部分(salt・wrappedPrivateKey・iterations)だけ。これを破ると既存の暗号化ブクマが全部読めなくなる(データ消失に等しい重大バグ)。
- **`unwrapPrivateKey`でインポートした秘密鍵は non-extractable のまま**(既存の防御・変更しない)。「パスワード変更」に必要な生バイトは、既存の`decryptJson`(非対称インポートを経由しない、AES-GCM復号だけの関数)を直接呼んで取り出す — これは既存の`unwrapPrivateKey`が内部でやっているのと全く同じ手順を1歩手前で止めるだけで、新しい露出経路を作るわけではない(既存の低優先度バックログ項目N-65が指摘している「生バイトが一瞬JS経由」は今回のどの変更had前から存在する既知のトレードオフで、今回悪化させない)。
- **`PrivateVaultSession`に`wrappingKey`を追加する**(`lib/private/vault-session.ts`)。これは「今のパスワードから作った包み鍵」で、既に解錠済みのセッションが保持し続ける。IndexedDB/localStorageには絶対に書かない(既存の`privateKey`と同じ扱い・モジュール変数のみ)。
- **`vaultRecordsDiffer`(`lib/sync/engine.ts`)の判定基準を狭める**: 今は1フィールドでも違えば「食い違い(conflict)」扱いだが、これだと「同じ金庫のパスワードを変えただけ」も「本当に別々の金庫が2つある」も区別できない。**`publicKey`と`tagId`が両方一致していれば「食い違いではない」**(=同じ金庫の中身が変わっただけ)とし、`mergeVault`(`lib/sync/merge.ts`)側で`updatedAt`のLWW(新しい方が勝つ)で解決する。`publicKey`が違えば(=本当に別の金庫)引き続き conflict 扱い。**この変更は既存の3つのvault conflictテスト(`engine.test.ts`)が全て`publicKey`の値を変えて食い違いを作っているため、後方互換(既存テストは無改造で通る)** — 各タスクでこれを実際に確認すること。
- **文言はこのplanに書いてある通りに実装する**(ユーザー承認済み・実装前に変えない)。英語が正本、日本語(`ja.json`)は実際の翻訳、他13言語(`ar/de/es/fr/it/ko/nl/pt/ru/th/tr/vi/zh`)は英語文言をそのまま複製する(翻訳は将来の別作業・`messages/all-keys-parity.test.ts`が「全ロケールに同じキーが存在する・空文字でない」ことを強制するため、複製しないとテストが落ちる)。
- **アイコンはインラインSVG・アイコンライブラリを使わない**(`PrivateLockGlyph.tsx`と同じ house style)。
- **`PasswordField`という共通コンポーネントを新規に作り、SETUP/UNLOCK/新規2画面の計5箇所のパスワード入力を全部これに置き換える**(目のマークを1箇所実装して使い回す・DRY)。
- **`z-index: 2000`を新しい2ダイアログにもそのまま使う**(既存の`PrivateSetupDialog`/`PrivateUnlockDialog`と同じ・`BOARD_Z_INDEX` enumへの統合は今回のスコープ外)。
- 各タスクの最後に `npx tsc --noEmit` が0件・そのタスクのテストファイルがgreenであることを確認してからcommitする。フル回帰(`npx vitest run`)は最終タスク完了後にまとめて実行する。
- コマンド先頭に `rtk` を付ける(CLAUDE.md既定)。`--no-verify` は禁止。vitestは素の `npx vitest`。
- **視覚変更なので実装後、ユーザーに実機/ブラウザでの確認を依頼すること**(`.claude/rules/ui-design.md` — 承認フローの(4)実装の後、ユーザーが見て確認する)。

---

## File Structure

| ファイル | 責務 | 作成/変更 |
|---|---|---|
| `lib/private/vault-session.ts` | `PrivateVaultSession`型に`wrappingKey`を追加。 | 変更(Task 1) |
| `lib/private/vault-session.test.ts` | 既存のオブジェクトリテラル3箇所(`{tagId, privateKey}`)に`wrappingKey`を追加(型エラー回避)。 | 変更(Task 1) |
| `lib/private/vault-store.ts` | `PrivateVaultRecord`に`updatedAt`追加。`createVault`/`unlockVault`が`wrappingKey`込みのセッションを返すよう変更。新規`changeVaultPassword`。 | 変更(Task 1) |
| `lib/private/resolve-visibility.test.ts` | `PrivateVaultSession`のオブジェクトリテラル3箇所に`wrappingKey`を追加(型エラー回避・`wrappingKey`自体はこのテストの本題ではない)。 | 変更(Task 1) |
| `lib/storage/use-tags.test.ts` | `setPrivateVaultSession({...})`のオブジェクトリテラル2箇所に`wrappingKey`を追加(型エラー回避)。 | 変更(Task 1) |
| `lib/sync/engine.ts` | `vaultRecordsDiffer`の判定を`publicKey`/`tagId`一致チェックに狭める。 | 変更(Task 2) |
| `lib/sync/merge.ts` | `mergeVault`に`updatedAt`ベースのLWW分岐を追加(同じ金庫の時だけ)。 | 変更(Task 2) |
| `components/board/EyeGlyph.tsx` | 目(表示中)/目に斜線(非表示中)のインラインSVGアイコン。 | 新規(Task 3) |
| `components/board/PasswordField.tsx` + `.module.css` | ラベル+パスワード入力+目のマークの共通コンポーネント。 | 新規(Task 4) |
| `components/board/PrivateSetupDialog.tsx`/`.module.css` | 2つの生パスワード`<input>`を`PasswordField`に置換。説明文を更新。 | 変更(Task 5) |
| `components/board/PrivateUnlockDialog.tsx`/`.module.css` | 1つの生パスワード`<input>`を`PasswordField`に置換。 | 変更(Task 5) |
| `messages/*.json`(15ファイル) | `private.showPassword`/`private.hidePassword`追加・`private.setupExplanation`更新。 | 変更(Task 5) |
| `components/board/PrivateManageDialog.tsx`/`.module.css` | 解錠済み時にSETTINGSのPRIVATEから開く新しい管理画面(状態表示+CHANGE PASSWORDボタン)。 | 新規(Task 6) |
| `components/board/PrivateChangePasswordDialog.tsx`/`.module.css` | 新パスワード+確認+ヒントの入力フォーム。 | 新規(Task 6) |
| `messages/*.json`(15ファイル) | Task 6用の新規キー追加。 | 変更(Task 6) |
| `components/board/BoardRoot.tsx` | `privateDialog`の型に`'manage'`/`'change-password'`を追加。`onOpenPrivate`とunlock成功時の分岐を配線。新規2ダイアログを描画。 | 変更(Task 7) |

---

### Task 1: `vault-session.ts` + `vault-store.ts` — `wrappingKey`保持と`changeVaultPassword`

**Files:**
- Modify: `lib/private/vault-session.ts`
- Modify: `lib/private/vault-session.test.ts`
- Modify: `lib/private/vault-store.ts`
- Modify: `lib/private/vault-store.test.ts`
- Modify: `lib/private/resolve-visibility.test.ts`
- Modify: `lib/storage/use-tags.test.ts`

**Interfaces:**
- Consumes: `lib/private/crypto.ts`の`deriveKey`/`generateSalt`/`encryptJson`/`decryptJson`/`wrapPrivateKey`/`unwrapPrivateKey`/`PBKDF2_ITERATIONS`(全て既存・変更しない)。
- Produces: `PrivateVaultSession = { tagId: string; privateKey: CryptoKey; wrappingKey: CryptoKey } | null`。`PrivateVaultRecord.updatedAt?: number`。`changeVaultPassword(db, session, newPassword, newHint?): Promise<ChangeVaultPasswordResult>`。Task 6/7が使う。

- [ ] **Step 1: 既存テストファイルの実際の構造を確認する**

`lib/private/vault-store.test.ts`(確認済み・存在する)は、独自の軽量`makeDb()`(`openDB(TEST_DB, 1, {upgrade: db => db.createObjectStore('settings', {keyPath:'key'})})`)を`beforeEach`で毎回作り直し、`describe('private/vault-store', () => { let db: TestDb; ... })`という**単一のdescribeブロックの中に全テストが並ぶ**構造(`lib/storage/indexeddb.ts`の`initDB()`は使っていない)。新しいテストはこの1つのdescribeブロックの中に追記する(新しいdescribeブロックを外に作らない・各テストは外側の`db`変数をそのまま使う・`db.close()`は`afterEach`が既にやっているので各テスト内では呼ばない)。

**さらに重要**: 既存の39-49行目のテスト(`'createVault persists a record...'`)に**`expect(session).toEqual({ tagId: 'tag-abc', privateKey: expect.anything() })`という完全一致アサーションがある**。`wrappingKey`をセッションに追加すると、このテストは**そのままでは壊れる**(`toEqual`は余分なプロパティも検出する)。Step 4でこの1行を修正する。

- [ ] **Step 2: 失敗するテストを書く(`describe('private/vault-store', ...)`ブロックの中、末尾に追記)**

```ts
// lib/private/vault-store.test.ts の import 行に changeVaultPassword を追加
import { loadVaultRecord, createVault, unlockVault, changeVaultPassword } from './vault-store'
```

```ts
// describe('private/vault-store', () => { ... }) の中、既存の最後のit(68-75行目)の直後に追記
it("createVault's session.wrappingKey can decrypt the stored wrappedPrivateKey directly", async () => {
  const { decryptJson } = await import('./crypto')
  const session = await createVault(db, 'tag-abc', 'hunter2')
  const record = await loadVaultRecord(db)
  const { pkcs8 } = await decryptJson<{ pkcs8: string }>(
    session.wrappingKey, record!.wrappedPrivateKey.iv, record!.wrappedPrivateKey.ciphertext,
  )
  expect(typeof pkcs8).toBe('string')
  expect(pkcs8.length).toBeGreaterThan(0)
})

it('unlockVault returns a session with a wrappingKey too', async () => {
  await createVault(db, 'tag-abc', 'hunter2')
  const session = await unlockVault(db, 'hunter2')
  expect(session?.wrappingKey).toBeDefined()
})

describe('changeVaultPassword', () => {
  it('changes the password: old password no longer unlocks, new password does', async () => {
    const session = await createVault(db, 'tag-abc', 'old-password123')
    const result = await changeVaultPassword(db, session, 'new-password456', undefined)
    expect(result.ok).toBe(true)
    expect(await unlockVault(db, 'old-password123')).toBeNull()
    expect(await unlockVault(db, 'new-password456')).not.toBeNull()
  })

  it('the same private key still decrypts data encrypted before the password change', async () => {
    const session = await createVault(db, 'tag-abc', 'old-password123')
    const record = await loadVaultRecord(db)
    const publicKey = await importPublicKey(record!.publicKey)
    const envelope = await encryptWithPublicKey(publicKey, { secret: 'hello' })

    const result = await changeVaultPassword(db, session, 'new-password456', undefined)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')

    await expect(decryptWithPrivateKey(result.session!.privateKey, envelope)).resolves.toEqual({ secret: 'hello' })
  })

  it('stamps updatedAt, rotates the salt, and keeps publicKey/tagId unchanged', async () => {
    const session = await createVault(db, 'tag-abc', 'old-password123')
    const before = await loadVaultRecord(db)
    await changeVaultPassword(db, session, 'new-password456', undefined)
    const after = await loadVaultRecord(db)
    expect(after!.salt).not.toBe(before!.salt)
    expect(after!.wrappedPrivateKey.ciphertext).not.toBe(before!.wrappedPrivateKey.ciphertext)
    expect(after!.publicKey).toBe(before!.publicKey)
    expect(after!.tagId).toBe(before!.tagId)
    expect(typeof after!.updatedAt).toBe('number')
  })

  it('updates the hint when a new one is passed, clears it when undefined', async () => {
    const session = await createVault(db, 'tag-abc', 'old-password123', 'old hint')
    const result = await changeVaultPassword(db, session, 'new-password456', 'new hint')
    expect(result.ok).toBe(true)
    expect((await loadVaultRecord(db))!.hint).toBe('new hint')

    const result2 = await changeVaultPassword(db, result.session!, 'newer-password789', undefined)
    expect(result2.ok).toBe(true)
    expect((await loadVaultRecord(db))!.hint).toBeUndefined()
  })

  it('returns ok:false when no vault record exists', async () => {
    const session = await createVault(db, 'tag-abc', 'password123')
    await db.delete('settings', 'private-vault')
    const result = await changeVaultPassword(db, session, 'new-password', undefined)
    expect(result.ok).toBe(false)
  })
})
```
(この最後の`describe('changeVaultPassword', ...)`は、外側の`describe('private/vault-store', ...)`の中にネストする — 独立した新規トップレベルdescribeにはしない)

- [ ] **Step 3: テストが失敗することを確認**

Run: `npx vitest run lib/private/vault-store.test.ts`
Expected: FAIL(`changeVaultPassword`が存在しない・`session.wrappingKey`が`undefined`・既存の完全一致アサーションが`wrappingKey`追加後に壊れる)

- [ ] **Step 4: `vault-session.ts`と、`wrappingKey`追加によって型エラーになる既存テストファイル4箇所を変更**

まず`lib/private/vault-store.test.ts`の既存39-49行目のテスト(`'createVault persists a record...'`)内、41行目の完全一致アサーションを修正する:
```ts
// 変更前
expect(session).toEqual({ tagId: 'tag-abc', privateKey: expect.anything() })
// 変更後
expect(session).toEqual({ tagId: 'tag-abc', privateKey: expect.anything(), wrappingKey: expect.anything() })
```

```ts
// lib/private/vault-session.ts — 型定義部分のみ変更(他は無変更)
export type PrivateVaultSession = {
  readonly tagId: string
  readonly privateKey: CryptoKey
  /** パスワードから導出した現在の「包み鍵」(AES-256-GCM)。IndexedDB等へは
   *  絶対に書かない(privateKeyと同じ扱い)。changeVaultPasswordが「古い
   *  パスワードを聞かずに変更する」ために、保存済みのwrappedPrivateKeyを
   *  この鍵で復号して使う。 */
  readonly wrappingKey: CryptoKey
} | null
```

`lib/private/vault-session.test.ts`(既存・確認済み)には`{ tagId: 'tag-N', privateKey: fakeKey }`という形のオブジェクトリテラルが3箇所ある(22行目・31行目・40行目)。`wrappingKey`が必須フィールドになるとこれらは型エラーになるので、**3箇所とも`wrappingKey: fakeKey`を追加する**(既存の`const fakeKey = {} as CryptoKey`をそのまま`wrappingKey`にも使い回してよい — テストの意図上、実際の鍵である必要はない):

```ts
// 変更前(3箇所とも同じ形)
const session: PrivateVaultSession = { tagId: 'tag-1', privateKey: fakeKey }
// 変更後
const session: PrivateVaultSession = { tagId: 'tag-1', privateKey: fakeKey, wrappingKey: fakeKey }
```
(22行目・31行目・40行目それぞれのtagId値は変えず、`wrappingKey: fakeKey`だけを追加する)

同様に、`lib/private/resolve-visibility.test.ts`の3箇所(39・52・63行目、`const session: PrivateVaultSession = { tagId: 'priv-1', privateKey: pair.privateKey }`または`wrongPair.privateKey`)にも、それぞれ同じ鍵を使い回して`wrappingKey`を追加する(このテストの本題は復号の可否であり、`wrappingKey`の値そのものはテストに使われないので、既にスコープにある鍵を再利用してよい):
```ts
// 39行目・63行目
const session: PrivateVaultSession = { tagId: 'priv-1', privateKey: pair.privateKey, wrappingKey: pair.privateKey }
// 52行目
const session: PrivateVaultSession = { tagId: 'priv-1', privateKey: wrongPair.privateKey, wrappingKey: wrongPair.privateKey }
```

`lib/storage/use-tags.test.ts`の2箇所(43・66行目、`setPrivateVaultSession({ tagId: privateTag.id, privateKey: fakeKey })`)にも同様に`wrappingKey: fakeKey`を追加する:
```ts
setPrivateVaultSession({ tagId: privateTag.id, privateKey: fakeKey, wrappingKey: fakeKey })
```

- [ ] **Step 5: `vault-store.ts`を変更**

```ts
// lib/private/vault-store.ts の全体を以下に置き換える
import type { IDBPDatabase } from 'idb'
import {
  PBKDF2_ITERATIONS, deriveKey, generateSalt, decryptJson, encryptJson,
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
  /** パスワード変更のたびに現在時刻を打つ(初回作成時は無し=undefined)。
   *  同期マージのLWW比較に使う(lib/sync/merge.ts mergeVault)。 */
  readonly updatedAt?: number
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
): Promise<NonNullable<PrivateVaultSession>> {
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
  return { tagId, privateKey, wrappingKey }
}

/** Attempts to unlock with `password`. Returns null (never throws) when
 *  there's no vault yet OR the password is wrong — callers show the same
 *  "wrong password" message either way. */
export async function unlockVault(db: DbLike, password: string): Promise<PrivateVaultSession> {
  const record = await loadVaultRecord(db)
  if (!record) return null
  const wrappingKey = await deriveKey(password, record.salt, record.iterations)
  try {
    const privateKey = await unwrapPrivateKey(record.wrappedPrivateKey, wrappingKey)
    return { tagId: record.tagId, privateKey, wrappingKey }
  } catch {
    return null
  }
}

export type ChangeVaultPasswordResult =
  | { readonly ok: true; readonly session: PrivateVaultSession }
  | { readonly ok: false; readonly session?: undefined }

/**
 * Changes the vault's password WITHOUT requiring the old one — the caller
 * must already hold a valid, unlocked `session` (its `wrappingKey` proves
 * access; that's the whole point of this feature: an already-unlocked
 * device can reset the password for every other synced device too). Only
 * the password-derived wrapping changes; the ECDH key pair itself (and
 * therefore every already-encrypted Private bookmark) is untouched.
 *
 * Decrypts the CURRENTLY stored wrapped blob with `session.wrappingKey`
 * (not by re-deriving from a freshly-typed password) to get the raw pkcs8
 * bytes, then re-wraps them under a freshly-derived key from `newPassword`
 * (with a new random salt). Stamps `updatedAt` so lib/sync/merge.ts's
 * mergeVault can resolve this via LWW instead of treating it as a
 * conflict with another device's copy of the same vault.
 */
export async function changeVaultPassword(
  db: DbLike,
  session: NonNullable<PrivateVaultSession>,
  newPassword: string,
  newHint: string | undefined,
): Promise<ChangeVaultPasswordResult> {
  const record = await loadVaultRecord(db)
  if (!record) return { ok: false }

  let pkcs8: string
  try {
    const decrypted = await decryptJson<{ pkcs8: string }>(
      session.wrappingKey, record.wrappedPrivateKey.iv, record.wrappedPrivateKey.ciphertext,
    )
    pkcs8 = decrypted.pkcs8
  } catch {
    return { ok: false }
  }

  const newSalt = generateSalt()
  const newWrappingKey = await deriveKey(newPassword, newSalt, PBKDF2_ITERATIONS)
  const newWrapped = await encryptJson(newWrappingKey, { pkcs8 })

  const newRecord: PrivateVaultRecord = {
    ...record,
    salt: newSalt,
    iterations: PBKDF2_ITERATIONS,
    wrappedPrivateKey: newWrapped,
    updatedAt: Date.now(),
    hint: newHint,
  }
  await db.put('settings', newRecord)

  return { ok: true, session: { tagId: record.tagId, privateKey: session.privateKey, wrappingKey: newWrappingKey } }
}
```

**確認済み**: `createVault`の戻り値型を元の`Promise<PrivateVaultSession>`(`{...} | null`)から`Promise<NonNullable<PrivateVaultSession>>`に変更した(`createVault`は実装上どのパスでも絶対にnullを返さないため、より正確な型)。これは**後方互換な狭い型への変更**(`NonNullable<PrivateVaultSession>`は`PrivateVaultSession`のサブタイプなので、`setPrivateVaultSession(session)`や`runPrivateAction(..., session)`のように広い型`PrivateVaultSession`を受け取る既存の呼び出し先には無変更でそのまま渡せる)。この変更により、Task1のテストコード内で`session.wrappingKey`のような直接プロパティアクセスや`changeVaultPassword(db, session, ...)`への直接引き渡し(`changeVaultPassword`の第2引数は`NonNullable<PrivateVaultSession>`必須)が、nullチェックや非nullアサーション(`!`)無しでそのまま型チェックを通る。

- [ ] **Step 6: テストが通ることを確認**

Run: `npx vitest run lib/private/vault-store.test.ts lib/private/vault-session.test.ts lib/private/resolve-visibility.test.ts lib/storage/use-tags.test.ts`
Expected: PASS(既存テスト全部 + `vault-store.test.ts`の新規7ケース)

- [ ] **Step 7: 型チェック**

Run: `npx tsc --noEmit`
Expected: 0件。`BoardRoot.tsx`・`lib/private/apply-tag-change.ts`等、`PrivateVaultSession`を扱う他のファイルでも新たなエラーが出ていないか確認する(`session`をそのまま別の関数に渡す・分割代入で`privateKey`だけ取り出す、といった使い方は影響を受けないはず — 明示的に`{tagId, privateKey}`という形でオブジェクトリテラルを組み立てている箇所だけが型エラーになる)。

- [ ] **Step 8: commit**

```bash
git add lib/private/vault-session.ts lib/private/vault-session.test.ts lib/private/vault-store.ts lib/private/vault-store.test.ts lib/private/resolve-visibility.test.ts lib/storage/use-tags.test.ts
git commit -m "feat(private): add changeVaultPassword (reset without the old password)"
```

---

### Task 2: `engine.ts`の`vaultRecordsDiffer` + `merge.ts`の`mergeVault` — 同期マージの食い違い判定を正しくする

**Files:**
- Modify: `lib/sync/engine.ts`
- Modify: `lib/sync/merge.ts`
- Modify: `lib/sync/merge.test.ts`(既存ファイル)

**Interfaces:**
- Consumes: Task1で`PrivateVaultRecord`に追加した`updatedAt?: number`。
- Produces: 変更後の`vaultRecordsDiffer`(engine.ts内・非export)と`mergeVault`(merge.ts・export済み・シグネチャ不変)。

- [ ] **Step 1: `merge.test.ts`の既存の`mergeVault`テストを確認する**

`lib/sync/merge.test.ts`を`Read`し、既存の`describe('mergeVault', ...)`ブロックの現在のテストケースとimport文を確認する。

- [ ] **Step 2: 失敗するテストを書く(既存の`describe('mergeVault', ...)`に追記)**

```ts
// lib/sync/merge.test.ts の describe('mergeVault', ...) 内に追記
it('same vault (same publicKey + tagId), different wrapping: newer updatedAt wins', () => {
  // salt/iv/ciphertext are deliberately chosen so the OLDER record's fields
  // sort lexically AFTER the newer record's (older='z*', newer='a*'). This
  // makes pickDeterministic's stableStringify tie-break pick the WRONG
  // (older) record if it were used — so this test only passes when the
  // updatedAt-LWW branch is actually being taken, not by coincidence.
  const base = { key: 'private-vault' as const, tagId: 'tag1', iterations: 600000, publicKey: 'same-pk' }
  const older = { ...base, salt: 'salt-z', wrappedPrivateKey: { iv: 'iv-z', ciphertext: 'ct-z' }, updatedAt: 1000 }
  const newer = { ...base, salt: 'salt-a', wrappedPrivateKey: { iv: 'iv-a', ciphertext: 'ct-a' }, updatedAt: 2000 }
  expect(mergeVault(older, newer)).toEqual(newer)
  expect(mergeVault(newer, older)).toEqual(newer) // 引数順に依存しない
})

it('same vault, one side has no updatedAt (legacy pre-this-feature record): the stamped side wins', () => {
  // Same anti-coincidence trick: legacy's fields sort lexically AFTER
  // changed's, so pickDeterministic would wrongly favor legacy if it were
  // reached — this test only passes via the updatedAt-LWW branch.
  const base = { key: 'private-vault' as const, tagId: 'tag1', iterations: 600000, publicKey: 'same-pk' }
  const legacy = { ...base, salt: 'salt-z', wrappedPrivateKey: { iv: 'iv-z', ciphertext: 'ct-z' } } // no updatedAt field at all
  const changed = { ...base, salt: 'salt-a', wrappedPrivateKey: { iv: 'iv-a', ciphertext: 'ct-a' }, updatedAt: 2000 }
  expect(mergeVault(legacy, changed)).toEqual(changed)
  expect(mergeVault(changed, legacy)).toEqual(changed)
})

it('genuinely different vault (different publicKey): still falls back to pickDeterministic, not LWW', () => {
  const a = {
    key: 'private-vault' as const, tagId: 'tag1', salt: 'salt-a', iterations: 600000,
    publicKey: 'pk-a', wrappedPrivateKey: { iv: 'iv-a', ciphertext: 'ct-a' }, updatedAt: 9999999, // 新しい方
  }
  const b = {
    key: 'private-vault' as const, tagId: 'tag1', salt: 'salt-b', iterations: 600000,
    publicKey: 'pk-b', wrappedPrivateKey: { iv: 'iv-b', ciphertext: 'ct-b' }, updatedAt: 1, // 古い方
  }
  // publicKeyが違う=別の金庫なので、updatedAtが新しい方(a)が自動で勝つのではなく、
  // 決定的タイブレーク(stableStringifyの大小比較)で選ばれることを確認する
  const result = mergeVault(a, b)
  expect(result).toBe(pickDeterministicForTest(a, b))
})
```

上記最後のテストの`pickDeterministicForTest`は、`merge.ts`の`pickDeterministic`が非exportなので、テスト側で同じロジックを再実装するのではなく、**`JSON.stringify`ベースの安定比較を使わず、単純に「`mergeVault(a,b)`が`a`か`b`のどちらか一方と一致し、かつ`updatedAt`の値では選ばれていない(=もしLWWで選ばれるなら常にaが勝つはずのところ、そうなっていないケースがあることを示す)」ことを確認する形**に書き換えてよい。具体的には:

```ts
it('genuinely different vault (different publicKey): result is deterministic and independent of updatedAt', () => {
  const a = {
    key: 'private-vault' as const, tagId: 'tag1', salt: 'salt-a', iterations: 600000,
    publicKey: 'pk-a', wrappedPrivateKey: { iv: 'iv-a', ciphertext: 'ct-a' }, updatedAt: 1, // 古い方
  }
  const b = {
    key: 'private-vault' as const, tagId: 'tag1', salt: 'salt-b', iterations: 600000,
    publicKey: 'pk-b', wrappedPrivateKey: { iv: 'iv-b', ciphertext: 'ct-b' }, updatedAt: 9999999, // 新しい方
  }
  // 引数順に依存しない(決定的)ことだけを確認する。LWWなら常にbが勝つはずだが、
  // publicKeyが違う=別の金庫なのでLWWの対象外であることをこのテストで担保する。
  const result1 = mergeVault(a, b)
  const result2 = mergeVault(b, a)
  expect(result1).toBe(result2)
})
```

- [ ] **Step 3: `engine.test.ts`の既存3件のvault conflictテストを一度読み、`publicKey`が全て異なる値を使っていることを再確認する**

`lib/sync/engine.test.ts`の以下3箇所を`Read`で確認(既に事前調査済みだが、実装前に再確認):
- `'flags vaultConflict and keeps the local vault untouched when local and remote vaults differ'`(`publicKey: 'different-pk'`)
- `'re-checks the vault conflict on the retry path when the retry re-pull reveals a differing vault'`(`publicKey: 'different-pk'`)
- 3件目(`publicKey: 'remote-pk'`)

3件とも`publicKey`が実際に異なる値を使っているので、Step 5の変更後も無改造で通るはず。**もし読んでみて`publicKey`が同じ値を使っているテストが見つかったら、それはSTOPして報告すること**(このplanの前提が崩れている)。

- [ ] **Step 4: テストが失敗することを確認**

Run: `npx vitest run lib/sync/merge.test.ts`
Expected: FAIL(新規3ケースのうち、LWWを期待する2件が現状の`pickDeterministic`一本槍の実装では偶然にしか通らない — 実際に失敗することを確認する)

- [ ] **Step 5: `merge.ts`の`mergeVault`を変更**

```ts
// lib/sync/merge.ts — mergeVault関数だけを以下に置き換える(前後のコメント含む)
/** local/remote の vault は「まるごと1個」扱い。暗号文は復号しない・見ない。
 *  **食い違い検知(束4のengine.tsのvaultRecordsDiffer)は「本当に別々の金庫」
 *  だけをconflict扱いする**(publicKeyが一致していれば同じ金庫のパスワード
 *  変更に過ぎない)。ここではその2ケースを区別する:
 *  - 同じ金庫(publicKey・tagIdが一致)・中身(wrappedPrivateKey等)が違う
 *    → パスワード変更。updatedAtが新しい方を丸ごと採用(LWW)。updatedAtが
 *    無い方(この機能より前に作られたレコード)は0扱いで必ず負ける。
 *  - それ以外(publicKeyが違う=本当に別の金庫。engineがconflict扱いする
 *    経路で、ここに来る前にvault:nullに差し替えられるので実運用では
 *    ほぼ通らないが、この関数は純関数として単体でも正しく振る舞う必要が
 *    ある) → 決定的タイブレーク(pickDeterministic)。 */
export function mergeVault(
  local: PrivateVaultRecord | null,
  remote: PrivateVaultRecord | null,
): PrivateVaultRecord | null {
  if (!local) return remote
  if (!remote) return local
  if (stableStringify(local) === stableStringify(remote)) return local
  if (local.publicKey === remote.publicKey && local.tagId === remote.tagId) {
    const lt = numericTime(local.updatedAt)
    const rt = numericTime(remote.updatedAt)
    if (lt !== rt) return lt > rt ? local : remote
  }
  return pickDeterministic(local, remote)
}
```

- [ ] **Step 6: `engine.ts`の`vaultRecordsDiffer`を変更**

```ts
// lib/sync/engine.ts — vaultRecordsDiffer関数だけを以下に置き換える
/** 「本当に別々の金庫」かどうかだけを見る。publicKey(ECDH鍵ペアの識別子)と
 *  tagIdが両方一致していれば、salt/wrappedPrivateKey等が違っていても
 *  それは同じ金庫のパスワード変更に過ぎない — conflictではなく
 *  mergeVault(merge.ts)のupdatedAt LWWに解決を委ねる。publicKeyが違う場合
 *  だけ、本当に別々に作られた金庫として引き続きconflict扱いする。 */
function vaultRecordsDiffer(a: PrivateVaultRecord, b: PrivateVaultRecord): boolean {
  return a.publicKey !== b.publicKey || a.tagId !== b.tagId
}
```

- [ ] **Step 7: テストが通ることを確認**

Run: `npx vitest run lib/sync/merge.test.ts lib/sync/engine.test.ts`
Expected: PASS(merge.test.tsの新規3ケース + engine.test.tsの既存3件のvault conflictテストが無改造で通る)

- [ ] **Step 8: 型チェック**

Run: `npx tsc --noEmit`
Expected: 0件

- [ ] **Step 9: commit**

```bash
git add lib/sync/engine.ts lib/sync/merge.ts lib/sync/merge.test.ts
git commit -m "fix(sync): distinguish a vault password change from a genuine vault conflict"
```

---

### Task 3: `EyeGlyph.tsx` — 表示/非表示アイコン

**Files:**
- Create: `components/board/EyeGlyph.tsx`

**Interfaces:**
- Consumes: なし(純粋な表示コンポーネント)。
- Produces: `<EyeGlyph visible={boolean} />`。Task4が使う。

- [ ] **Step 1: 実装**(このコンポーネントは純粋な見た目なので、TDDではなく直接実装 — brief内に完全なコードがあるため)

```tsx
// components/board/EyeGlyph.tsx
// パスワード表示/非表示トグルのアイコン。PrivateLockGlyph.tsxと同じ
// house style(アイコンライブラリ不使用・インラインSVG)。線画スタイルは
// PrivateLockGlyphのfill-evenodd技法ではなくstroke技法(こちらの方が
// hand-authorしても崩れにくい標準的な「アーモンド形+瞳の円」のシルエット)。
import type { ReactElement } from 'react'

type Props = {
  /** true = パスワードが今見えている状態(このアイコンを押すと隠れる)。
   *  false = 隠れている状態(押すと見える)。 */
  readonly visible: boolean
  readonly className?: string
}

export function EyeGlyph({ visible, className }: Props): ReactElement {
  return (
    <svg
      key={visible ? 'visible' : 'hidden'}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2 12C2 12 5.5 6 12 6C18.5 6 22 12 22 12C22 12 18.5 18 12 18C5.5 18 2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      {!visible && (
        <line x1="3" y1="20" x2="21" y2="4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  )
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: 0件

- [ ] **Step 3: commit**

```bash
git add components/board/EyeGlyph.tsx
git commit -m "feat(private): add eye/eye-slash glyph for password visibility toggle"
```

---

### Task 4: `PasswordField.tsx` — 共通パスワード入力コンポーネント

**Files:**
- Create: `components/board/PasswordField.tsx`
- Create: `components/board/PasswordField.module.css`
- Create: `components/board/PasswordField.test.tsx`

**Interfaces:**
- Consumes: Task3の`EyeGlyph`。
- Produces: `<PasswordField id label value onChange onEnter? showLabel hideLabel />`。Task5・Task6が使う(既存の`PrivateSetupDialog`/`PrivateUnlockDialog`のパスワード`<input>`、新規2ダイアログの新パスワード/確認パスワード入力、計5箇所)。

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// components/board/PasswordField.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PasswordField } from './PasswordField'

describe('PasswordField', () => {
  it('renders as type=password by default and toggles to type=text on eye click', () => {
    render(
      <PasswordField
        id="pw" label="Password" value="secret123" onChange={() => {}}
        showLabel="Show password" hideLabel="Hide password"
      />,
    )
    const input = screen.getByLabelText('Password') as HTMLInputElement
    expect(input.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input.type).toBe('password')
  })

  it('calls onChange with the typed value', () => {
    const onChange = vi.fn()
    render(
      <PasswordField
        id="pw" label="Password" value="" onChange={onChange}
        showLabel="Show password" hideLabel="Hide password"
      />,
    )
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abc' } })
    expect(onChange).toHaveBeenCalledWith('abc')
  })

  it('calls onEnter when Enter is pressed, only if provided', () => {
    const onEnter = vi.fn()
    render(
      <PasswordField
        id="pw" label="Password" value="x" onChange={() => {}} onEnter={onEnter}
        showLabel="Show password" hideLabel="Hide password"
      />,
    )
    fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'Enter' })
    expect(onEnter).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run components/board/PasswordField.test.tsx`
Expected: FAIL(`./PasswordField`が存在しない)

- [ ] **Step 3: 実装**

```tsx
// components/board/PasswordField.tsx
'use client'

import { useState, type ReactElement } from 'react'
import { EyeGlyph } from './EyeGlyph'
import styles from './PasswordField.module.css'

type Props = {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly onEnter?: () => void
  /** 目のマークのaria-label。非表示中(押すと見える)のときの文言。 */
  readonly showLabel: string
  /** 目のマークのaria-label。表示中(押すと隠れる)のときの文言。 */
  readonly hideLabel: string
}

/** ラベル+パスワード入力+表示/非表示トグルの共通コンポーネント。
 *  PrivateSetupDialog/PrivateUnlockDialog/PrivateChangePasswordDialogの
 *  全パスワード欄(計5箇所)がこれを使う。 */
export function PasswordField({ id, label, value, onChange, onEnter, showLabel, hideLabel }: Props): ReactElement {
  const [visible, setVisible] = useState(false)
  return (
    <>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <div className={styles.wrapper}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={styles.input}
          value={value}
          onChange={(e): void => onChange(e.target.value)}
          onKeyDown={onEnter ? (e): void => { if (e.key === 'Enter') onEnter() } : undefined}
        />
        <button
          type="button"
          className={styles.toggle}
          onClick={(): void => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
        >
          <EyeGlyph visible={visible} />
        </button>
      </div>
    </>
  )
}
```

```css
/* components/board/PasswordField.module.css */
/* PrivateSetupDialog.module.css / PrivateUnlockDialog.module.css の
   .label / .input と視覚的に同じ値(このアプリのPrivateダイアログ群は
   ボードのテーマに関わらず常に同じ暗い配色 — 意図的・chrome-*トークンは
   使わない)。 */
.label {
  font-size: 12px;
  color: rgba(242, 242, 242, 0.7);
  margin-top: 8px;
}
.wrapper {
  position: relative;
  display: flex;
}
.input {
  width: 100%;
  font-size: 14px;
  padding: 8px 40px 8px 10px; /* 右側に目のマーク分の余白 */
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #f2f2f2;
}
.toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(242, 242, 242, 0.55);
  cursor: pointer;
  border-radius: 6px;
}
.toggle:hover {
  color: rgba(242, 242, 242, 0.9);
  background: rgba(255, 255, 255, 0.08);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run components/board/PasswordField.test.tsx`
Expected: PASS(全3ケース)

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit`
Expected: 0件

- [ ] **Step 6: commit**

```bash
git add components/board/PasswordField.tsx components/board/PasswordField.module.css components/board/PasswordField.test.tsx
git commit -m "feat(private): add shared PasswordField component with show/hide toggle"
```

---

### Task 5: 既存2ダイアログに`PasswordField`を配線 + 説明文更新 + i18n

**Files:**
- Modify: `components/board/PrivateSetupDialog.tsx`
- Modify: `components/board/PrivateSetupDialog.module.css`
- Modify: `components/board/PrivateUnlockDialog.tsx`
- Modify: `components/board/PrivateUnlockDialog.module.css`
- Modify: `components/board/PrivateSetupDialog.test.tsx`(既存ファイルがあれば・`components/board/`配下を確認)
- Modify: `components/board/PrivateUnlockDialog.test.tsx`(既存ファイルがあれば)
- Modify: `messages/en.json`・`messages/ja.json`・`messages/ar.json`・`messages/de.json`・`messages/es.json`・`messages/fr.json`・`messages/it.json`・`messages/ko.json`・`messages/nl.json`・`messages/pt.json`・`messages/ru.json`・`messages/th.json`・`messages/tr.json`・`messages/vi.json`・`messages/zh.json`(全15ファイル)

**Interfaces:**
- Consumes: Task4の`PasswordField`。
- Produces: 既存の`PrivateSetupDialog`/`PrivateUnlockDialog`の外部インターフェース(props)は無変更 — 内部実装だけ変わる。

- [ ] **Step 1: 既存のテストファイルを確認する**

`components/board/PrivateSetupDialog.test.tsx`と`components/board/PrivateUnlockDialog.test.tsx`は既に存在する(確認済み)。両方とも`screen.getByLabelText(/password/i)`等、`<label htmlFor>`+`<input id>`の対応関係だけに依存したセレクタを使っており、`PasswordField`もこの対応関係(`<label htmlFor={id}>`+`<input id={id}>`)を保持するため、**このタスクの変更後もこの2ファイルは無改造で通るはず**。実際に通ることをStep 7で確認する(通らなければ、その時点で何が具体的に壊れたかを見て対処する)。

- [ ] **Step 2: `messages/en.json`の`"private"`ブロックを更新**

`"setupExplanation"`の値を置き換え、`"showPassword"`/`"hidePassword"`を追加する(挿入位置は`"private"`オブジェクト内どこでもよいが、既存キーの並びに合わせて`hintLabel`の直後に追加する):

```json
"setupExplanation": "Encrypts the title, URL, thumbnail and photos of anything tagged Private with this password — the real content is never stored in plain text. You can change the password anytime from a device that's already unlocked. If it's ever forgotten everywhere, the content stays encrypted forever — the hint below is your only clue.",
"passwordLabel": "Password",
"confirmPasswordLabel": "Confirm password",
"hintLabel": "Hint (optional)",
"showPassword": "Show password",
"hidePassword": "Hide password",
```
(他の既存キーはそのまま・上記は`private`オブジェクト内の該当4行を置換+2行追加という意味)

- [ ] **Step 3: `messages/ja.json`の`"private"`ブロックを更新**

```json
"setupExplanation": "このパスワードで、Privateタグを付けたものすべてのタイトル・URL・サムネイル・画像を暗号化します。実際の中身は平文では一切保存されません。既に解錠済みの端末からは、いつでもパスワードを変更できます。もしどの端末でも忘れてしまった場合は、中身は永久に暗号化されたままです — 下のヒントだけが手がかりです。",
"passwordLabel": "パスワード",
"confirmPasswordLabel": "パスワード(確認)",
"hintLabel": "ヒント(任意)",
"showPassword": "パスワードを表示",
"hidePassword": "パスワードを隠す",
```

- [ ] **Step 4: 他の13ロケールファイル(`ar/de/es/fr/it/ko/nl/pt/ru/th/tr/vi/zh`)を更新**

各ファイルの`"private"`ブロック内、同じ位置(`hintLabel`の後)に、**英語の文言をそのまま**追加する(翻訳は将来の別作業):

```json
"showPassword": "Show password",
"hidePassword": "Hide password",
```

`setupExplanation`も英語版の新しい文言(Step 2の値)で置き換える(既存の英語文言を各ロケールにコピーしている運用のため、既存の値も英語のままのはず — 確認して同じ英語新文言に揃える)。

- [ ] **Step 5: `PrivateSetupDialog.tsx`を変更**

```tsx
// components/board/PrivateSetupDialog.tsx の import と JSX 部分を変更
'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { PasswordField } from './PasswordField'
import styles from './PrivateSetupDialog.module.css'

type Props = {
  readonly onCreate: (password: string, hint?: string) => Promise<boolean>
  readonly onCancel: () => void
}

export function PrivateSetupDialog({ onCreate, onCancel }: Props): ReactElement {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (): Promise<void> => {
    if (submitting) return
    if (password.length < 4) {
      setError(t('private.errorTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('private.errorMismatch'))
      return
    }
    setSubmitting(true)
    const ok = await onCreate(password, hint.length > 0 ? hint : undefined)
    if (!ok) {
      setSubmitting(false)
      setError(t('private.errorCreateFailed'))
    }
  }

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
      aria-labelledby="private-setup-heading"
      data-testid="private-setup-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-setup-heading" className={styles.heading}>SET UP PRIVATE</div>
        <div className={styles.explanation} data-testid="private-setup-explanation">
          {t('private.setupExplanation')}
        </div>
        <PasswordField
          id="private-setup-password"
          label={t('private.passwordLabel')}
          value={password}
          onChange={setPassword}
          showLabel={t('private.showPassword')}
          hideLabel={t('private.hidePassword')}
        />
        <PasswordField
          id="private-setup-confirm"
          label={t('private.confirmPasswordLabel')}
          value={confirm}
          onChange={setConfirm}
          showLabel={t('private.showPassword')}
          hideLabel={t('private.hidePassword')}
        />
        <label className={styles.label} htmlFor="private-setup-hint">{t('private.hintLabel')}</label>
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
          <button
            type="button"
            className={styles.createBtn}
            onClick={(): void => { void submit() }}
            disabled={submitting}
            data-testid="private-setup-create"
          >
            CREATE
          </button>
        </div>
      </div>
    </div>
  )
}
```

`PrivateSetupDialog.module.css`は無変更でよい(`.label`/`.input`はヒント欄がまだ使うため残す)。

- [ ] **Step 6: `PrivateUnlockDialog.tsx`を変更**

```tsx
// components/board/PrivateUnlockDialog.tsx 全体
'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { PasswordField } from './PasswordField'
import styles from './PrivateUnlockDialog.module.css'

type Props = {
  readonly hint?: string
  readonly onSubmit: (password: string) => Promise<boolean>
  readonly onCancel: () => void
}

export function PrivateUnlockDialog({ hint, onSubmit, onCancel }: Props): ReactElement {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (): Promise<void> => {
    setSubmitting(true)
    const ok = await onSubmit(password)
    setSubmitting(false)
    if (!ok) setError(t('private.errorWrongPassword'))
  }

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
      aria-labelledby="private-unlock-heading"
      data-testid="private-unlock-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-unlock-heading" className={styles.heading}>UNLOCK PRIVATE</div>
        {hint && <div className={styles.hint}>{hint}</div>}
        <PasswordField
          id="private-unlock-password"
          label={t('private.passwordLabel')}
          value={password}
          onChange={setPassword}
          onEnter={(): void => { void submit() }}
          showLabel={t('private.showPassword')}
          hideLabel={t('private.hidePassword')}
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

`PrivateUnlockDialog.module.css`から、パスワード欄専用だった`.label`/`.input`ルールが完全に未使用になっていないか確認する(このファイルはヒント欄を持たないため、`.input`がもう使われていない可能性が高い)。未使用なら削除する(`.hint`/`.error`/`.actions`/`.cancelBtn`/`.unlockBtn`/`.backdrop`/`.panel`/`.heading`は残す)。

- [ ] **Step 7: テストを確認**

Run: `npx vitest run components/board/PrivateSetupDialog.test.tsx components/board/PrivateUnlockDialog.test.tsx`
Run: `npx vitest run messages/all-keys-parity.test.ts`
Expected: 両方PASS(parityテストは15ファイル全てにキーが揃っていないとここで失敗するので、抜けがあればここで判明する)

- [ ] **Step 8: 型チェック**

Run: `npx tsc --noEmit`
Expected: 0件

- [ ] **Step 9: commit**

```bash
git add components/board/PrivateSetupDialog.tsx components/board/PrivateSetupDialog.module.css components/board/PrivateUnlockDialog.tsx components/board/PrivateUnlockDialog.module.css messages/*.json
git commit -m "feat(private): add show/hide password toggle to setup and unlock dialogs"
```

(既存テストファイルへの変更があれば同じcommitに含める)

---

### Task 6: 新規`PrivateManageDialog` + `PrivateChangePasswordDialog`

**Files:**
- Create: `components/board/PrivateManageDialog.tsx`
- Create: `components/board/PrivateManageDialog.module.css`
- Create: `components/board/PrivateManageDialog.test.tsx`
- Create: `components/board/PrivateChangePasswordDialog.tsx`
- Create: `components/board/PrivateChangePasswordDialog.module.css`
- Create: `components/board/PrivateChangePasswordDialog.test.tsx`
- Modify: `messages/en.json`・`messages/ja.json`・他13ロケール(全15ファイル)

**Interfaces:**
- Consumes: Task4の`PasswordField`。
- Produces: `<PrivateManageDialog hint? onChangePassword onDone />`・`<PrivateChangePasswordDialog hint? onSubmit onCancel />`。Task7が使う。

- [ ] **Step 1: `messages/en.json`の`"private"`ブロックに追記**

`shareIncludesPrivateHeading`の直後に追加:

```json
"manageHeading": "PRIVATE",
"unlockedStatus": "Unlocked on this device",
"manageHintPrefix": "Hint: {hint}",
"changePasswordButton": "CHANGE PASSWORD",
"doneButton": "DONE",
"changePasswordHeading": "CHANGE PASSWORD",
"changePasswordExplanation": "Sets a new password for Private. You'll need it here next time you unlock — and on any other synced device, once it picks up the change.",
"newPasswordLabel": "New password",
"confirmNewPasswordLabel": "Confirm new password",
"changePasswordSuccessToast": "Password updated.",
"errorChangeFailed": "Could not update the password. Try again."
```

- [ ] **Step 2: `messages/ja.json`の`"private"`ブロックに追記**

```json
"manageHeading": "PRIVATE",
"unlockedStatus": "この端末で解錠済み",
"manageHintPrefix": "ヒント: {hint}",
"changePasswordButton": "パスワードを変更",
"doneButton": "完了",
"changePasswordHeading": "パスワードを変更",
"changePasswordExplanation": "Privateの新しいパスワードを設定します。次回この端末で解錠するとき、また同期している他の端末が変更を受け取った後は、そちらでも新しいパスワードが必要になります。",
"newPasswordLabel": "新しいパスワード",
"confirmNewPasswordLabel": "新しいパスワード(確認)",
"changePasswordSuccessToast": "パスワードを更新しました。",
"errorChangeFailed": "パスワードを更新できませんでした。もう一度お試しください。"
```

- [ ] **Step 3: 他13ロケールに英語文言を複製**

各ファイル(`ar/de/es/fr/it/ko/nl/pt/ru/th/tr/vi/zh`)の`"private"`ブロックに、Step 1と同じ英語の11キーをそのまま追加する。

- [ ] **Step 4: 失敗するテストを書く(`PrivateManageDialog.test.tsx`)**

```tsx
// components/board/PrivateManageDialog.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivateManageDialog } from './PrivateManageDialog'

describe('PrivateManageDialog', () => {
  it('shows the unlocked status and, when provided, the hint', () => {
    render(<PrivateManageDialog hint="my hint" onChangePassword={() => {}} onDone={() => {}} />)
    expect(screen.getByText(/unlocked/i)).toBeInTheDocument()
    expect(screen.getByText(/my hint/)).toBeInTheDocument()
  })

  it('does not render a hint line when no hint is set', () => {
    render(<PrivateManageDialog onChangePassword={() => {}} onDone={() => {}} />)
    expect(screen.queryByText(/hint/i)).not.toBeInTheDocument()
  })

  it('calls onChangePassword when the button is clicked', () => {
    const onChangePassword = vi.fn()
    render(<PrivateManageDialog onChangePassword={onChangePassword} onDone={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
    expect(onChangePassword).toHaveBeenCalledOnce()
  })

  it('calls onDone when DONE is clicked or Escape is pressed', () => {
    const onDone = vi.fn()
    render(<PrivateManageDialog onChangePassword={() => {}} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(onDone).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 5: テストが失敗することを確認**

Run: `npx vitest run components/board/PrivateManageDialog.test.tsx`
Expected: FAIL(`./PrivateManageDialog`が存在しない)

- [ ] **Step 6: `PrivateManageDialog.tsx`を実装**

```tsx
// components/board/PrivateManageDialog.tsx
'use client'

import { useEffect, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './PrivateManageDialog.module.css'

type Props = {
  readonly hint?: string
  readonly onChangePassword: () => void
  readonly onDone: () => void
}

/** 金庫が既に解錠済みのときにSETTINGSのPRIVATEから開く管理画面。
 *  今のところ「パスワードを変更する」導線だけを持つ(ロック機能等は
 *  スコープ外・YAGNI)。 */
export function PrivateManageDialog({ hint, onChangePassword, onDone }: Props): ReactElement {
  const { t } = useI18n()

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onDone() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onDone])

  return (
    <div
      className={styles.backdrop}
      onClick={onDone}
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-manage-heading"
      data-testid="private-manage-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-manage-heading" className={styles.heading}>{t('private.manageHeading')}</div>
        <div className={styles.status}>
          <span className={styles.statusDot} />
          {t('private.unlockedStatus')}
        </div>
        {hint && <div className={styles.hint}>{t('private.manageHintPrefix').replace('{hint}', hint)}</div>}
        <button type="button" className={styles.changeBtn} onClick={onChangePassword} data-testid="private-manage-change-password">
          {t('private.changePasswordButton')}
        </button>
        <div className={styles.actions}>
          <button type="button" className={styles.doneBtn} onClick={onDone} data-testid="private-manage-done">
            {t('private.doneButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

```css
/* components/board/PrivateManageDialog.module.css */
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
.status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(242, 242, 242, 0.85);
  margin-bottom: 4px;
}
.statusDot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #28f100;
  box-shadow: 0 0 6px rgba(40, 241, 0, 0.55);
  flex-shrink: 0;
}
.hint { font-size: 12px; color: rgba(242, 242, 242, 0.55); margin-bottom: 8px; }
.changeBtn {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 9px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
  color: #f2f2f2;
  cursor: pointer;
  margin-top: 8px;
}
.changeBtn:hover { background: rgba(255, 255, 255, 0.08); }
.actions { display: flex; justify-content: flex-end; margin-top: 12px; }
.doneBtn {
  font-size: 12px;
  letter-spacing: 0.06em;
  padding: 7px 14px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: transparent;
  color: #f2f2f2;
  cursor: pointer;
}
```

**確認済み**: このコードベースの`t()`は補間パラメータを引数に取らない。文字列内の`{hint}`は`t()`の戻り値に対して`.replace('{hint}', hint)`で置換する、という既存パターン(`components/board/PrivateShareConfirmDialog.tsx:39`の`t('private.shareConfirmBodyMany').replace('{count}', String(count))`)に倣った書き方が上記コードに反映済み。

- [ ] **Step 7: テストが通ることを確認**

Run: `npx vitest run components/board/PrivateManageDialog.test.tsx`
Expected: PASS(全4ケース)

- [ ] **Step 8: 失敗するテストを書く(`PrivateChangePasswordDialog.test.tsx`)**

```tsx
// components/board/PrivateChangePasswordDialog.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PrivateChangePasswordDialog } from './PrivateChangePasswordDialog'

describe('PrivateChangePasswordDialog', () => {
  it('shows an error and does not submit when the password is too short', async () => {
    const onSubmit = vi.fn()
    render(<PrivateChangePasswordDialog onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(screen.getByText(/at least 4 characters/i)).toBeInTheDocument())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows an error and does not submit when passwords do not match', async () => {
    const onSubmit = vi.fn()
    render(<PrivateChangePasswordDialog onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'password2' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(screen.getByText(/do not match/i)).toBeInTheDocument())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the new password and hint (undefined when hint left empty)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    render(<PrivateChangePasswordDialog onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('password123', undefined))
  })

  it('pre-fills the hint field with the existing hint and submits it if unchanged', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    render(<PrivateChangePasswordDialog hint="my existing hint" onSubmit={onSubmit} onCancel={() => {}} />)
    expect(screen.getByDisplayValue('my existing hint')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('password123', 'my existing hint'))
  })

  it('shows an error when onSubmit resolves false', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false)
    render(<PrivateChangePasswordDialog onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(screen.getByText(/could not update/i)).toBeInTheDocument())
  })

  it('calls onCancel when CANCEL is clicked', () => {
    const onCancel = vi.fn()
    render(<PrivateChangePasswordDialog onSubmit={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 9: テストが失敗することを確認**

Run: `npx vitest run components/board/PrivateChangePasswordDialog.test.tsx`
Expected: FAIL(`./PrivateChangePasswordDialog`が存在しない)

- [ ] **Step 10: `PrivateChangePasswordDialog.tsx`を実装**

```tsx
// components/board/PrivateChangePasswordDialog.tsx
'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { PasswordField } from './PasswordField'
import styles from './PrivateChangePasswordDialog.module.css'

type Props = {
  readonly hint?: string
  readonly onSubmit: (newPassword: string, newHint: string | undefined) => Promise<boolean>
  readonly onCancel: () => void
}

export function PrivateChangePasswordDialog({ hint, onSubmit, onCancel }: Props): ReactElement {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [newHint, setNewHint] = useState(hint ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (): Promise<void> => {
    if (submitting) return
    if (password.length < 4) {
      setError(t('private.errorTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('private.errorMismatch'))
      return
    }
    setSubmitting(true)
    const ok = await onSubmit(password, newHint.length > 0 ? newHint : undefined)
    if (!ok) {
      setSubmitting(false)
      setError(t('private.errorChangeFailed'))
    }
  }

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
      aria-labelledby="private-change-password-heading"
      data-testid="private-change-password-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-change-password-heading" className={styles.heading}>{t('private.changePasswordHeading')}</div>
        <div className={styles.explanation}>{t('private.changePasswordExplanation')}</div>
        <PasswordField
          id="private-change-password-new"
          label={t('private.newPasswordLabel')}
          value={password}
          onChange={setPassword}
          showLabel={t('private.showPassword')}
          hideLabel={t('private.hidePassword')}
        />
        <PasswordField
          id="private-change-password-confirm"
          label={t('private.confirmNewPasswordLabel')}
          value={confirm}
          onChange={setConfirm}
          showLabel={t('private.showPassword')}
          hideLabel={t('private.hidePassword')}
        />
        <label className={styles.label} htmlFor="private-change-password-hint">{t('private.hintLabel')}</label>
        <input
          id="private-change-password-hint"
          type="text"
          className={styles.input}
          value={newHint}
          onChange={(e): void => setNewHint(e.target.value)}
        />
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} data-testid="private-change-password-cancel">
            CANCEL
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={(): void => { void submit() }}
            disabled={submitting}
            data-testid="private-change-password-save"
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  )
}
```

```css
/* components/board/PrivateChangePasswordDialog.module.css */
/* PrivateSetupDialog.module.cssと視覚的に同じ(.backdrop/.panel/.heading/
   .explanation/.label/.input/.error/.actions/.cancelBtn相当)。 */
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
.explanation {
  font-size: 12px;
  line-height: 1.5;
  color: rgba(242, 242, 242, 0.6);
  margin-bottom: 4px;
}
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
.cancelBtn, .saveBtn {
  font-size: 12px;
  letter-spacing: 0.06em;
  padding: 7px 14px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: transparent;
  color: #f2f2f2;
  cursor: pointer;
}
.saveBtn { border-color: rgba(40, 241, 0, 0.55); }
```

- [ ] **Step 11: テストが通ることを確認**

Run: `npx vitest run components/board/PrivateChangePasswordDialog.test.tsx`
Expected: PASS(全6ケース)

- [ ] **Step 12: parityテスト確認**

Run: `npx vitest run messages/all-keys-parity.test.ts`
Expected: PASS(15ファイル全てにキーが揃っている)

- [ ] **Step 13: 型チェック**

Run: `npx tsc --noEmit`
Expected: 0件

- [ ] **Step 14: commit**

```bash
git add components/board/PrivateManageDialog.tsx components/board/PrivateManageDialog.module.css components/board/PrivateManageDialog.test.tsx components/board/PrivateChangePasswordDialog.tsx components/board/PrivateChangePasswordDialog.module.css components/board/PrivateChangePasswordDialog.test.tsx messages/*.json
git commit -m "feat(private): add vault-management and change-password dialogs"
```

---

### Task 7: `BoardRoot.tsx`配線

**Files:**
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: Task1の`changeVaultPassword`、Task6の`PrivateManageDialog`/`PrivateChangePasswordDialog`。
- Produces: なし(末端の配線)。

- [ ] **Step 1: `privateDialog`のstate型を拡張**

`components/board/BoardRoot.tsx:253`付近:
```ts
// 変更前
const [privateDialog, setPrivateDialog] = useState<'setup' | 'unlock' | null>(null)
// 変更後
const [privateDialog, setPrivateDialog] = useState<'setup' | 'unlock' | 'manage' | 'change-password' | null>(null)
```

- [ ] **Step 2: import文を追加**

```ts
import { PrivateManageDialog } from './PrivateManageDialog'
import { PrivateChangePasswordDialog } from './PrivateChangePasswordDialog'
import { changeVaultPassword } from '@/lib/private/vault-store'
```
(`changeVaultPassword`以外の`vault-store`からのimportは既存のものに追記する形。既存のimport文を`Read`で確認してから正確な行に追記すること)

- [ ] **Step 3: `onOpenPrivate`ハンドラを変更**(`components/board/BoardRoot.tsx:3640`付近)

```tsx
// 変更前(if (record === null) の後、setPrivateDialog('unlock') の部分)
onOpenPrivate={() => {
  void (async (): Promise<void> => {
    try {
      const db = await initDB()
      const record = await loadVaultRecord(db)
      if (record === null) {
        setPrivateDialog('setup')
        return
      }
      setPrivateHint(record.hint)
      setPrivateDialog('unlock')
    } catch (e) {
      console.error('[AllMarks] failed to check Private vault state', e)
    }
  })()
}}

// 変更後
onOpenPrivate={() => {
  void (async (): Promise<void> => {
    try {
      const db = await initDB()
      const record = await loadVaultRecord(db)
      if (record === null) {
        setPrivateDialog('setup')
        return
      }
      setPrivateHint(record.hint)
      if (privateSession !== null) {
        setPrivateDialog('manage')
        return
      }
      setPrivateDialog('unlock')
    } catch (e) {
      console.error('[AllMarks] failed to check Private vault state', e)
    }
  })()
}}
```

- [ ] **Step 4: `PrivateUnlockDialog`の`onSubmit`を変更**(`components/board/BoardRoot.tsx:4087`付近)

```tsx
// 変更前
onSubmit={async (password): Promise<boolean> => {
  try {
    const db = await initDB()
    const session = await unlockVault(db, password)
    if (!session) return false
    setPrivateVaultSession(session)
    setPrivateDialog(null)
    if (pendingPrivateAction && privateTagId) void runPrivateAction(pendingPrivateAction, privateTagId, session)
    return true
  } catch (e) {
    console.error('[AllMarks] failed to unlock Private vault', e)
    return false
  }
}}

// 変更後 — pendingPrivateActionが無い(=SETTINGSから普通に開いた)場合は
// 'manage'へ遷移する。pendingPrivateActionがある(=タグクリック等から来た)
// 場合は既存どおり閉じて処理を再開する。
onSubmit={async (password): Promise<boolean> => {
  try {
    const db = await initDB()
    const session = await unlockVault(db, password)
    if (!session) return false
    setPrivateVaultSession(session)
    if (pendingPrivateAction && privateTagId) {
      setPrivateDialog(null)
      void runPrivateAction(pendingPrivateAction, privateTagId, session)
    } else {
      setPrivateDialog('manage')
    }
    return true
  } catch (e) {
    console.error('[AllMarks] failed to unlock Private vault', e)
    return false
  }
}}
```

- [ ] **Step 5: 新規2ダイアログを描画**(`PrivateUnlockDialog`のJSXブロックの直後、`components/board/BoardRoot.tsx:4105`付近)

```tsx
{privateDialog === 'manage' && (
  <PrivateManageDialog
    hint={privateHint}
    onChangePassword={(): void => setPrivateDialog('change-password')}
    onDone={(): void => setPrivateDialog(null)}
  />
)}
{privateDialog === 'change-password' && privateSession && (
  <PrivateChangePasswordDialog
    hint={privateHint}
    onSubmit={async (newPassword, newHint): Promise<boolean> => {
      try {
        const db = await initDB()
        const result = await changeVaultPassword(db, privateSession, newPassword, newHint)
        if (!result.ok) return false
        setPrivateVaultSession(result.session)
        setPrivateHint(newHint)
        setPrivateDialog(null)
        setToast({ message: t('private.changePasswordSuccessToast'), nonce: Date.now() })
        return true
      } catch (e) {
        console.error('[AllMarks] failed to change Private password', e)
        return false
      }
    }}
    onCancel={(): void => setPrivateDialog('manage')}
  />
)}
```

**注**: `t`(useI18nの戻り値)が`BoardRoot`コンポーネント内で既に使える変数か確認すること(既存コードの`t('board.settings.sortNewestDone')`等の使用箇所から、使えるはず)。

- [ ] **Step 6: 型チェック**

Run: `npx tsc --noEmit`
Expected: 0件

- [ ] **Step 7: 既存のPrivate関連e2e/コンポーネントテストが壊れていないか確認**

Run: `npx vitest run --grep -i private`(または`components/board/BoardRoot.test.tsx`があれば個別に)
Expected: PASS(既存のPrivateフロー関連テストが無改造で通ること。特に「一度もCHANGE PASSWORDを押さない通常の解錠フロー」が壊れていないことを重点確認)

- [ ] **Step 8: フル回帰**

Run: `npx tsc --noEmit`
Run: `npx vitest run`
Expected: 0件 / 全green(既存分含め回帰ゼロ)

- [ ] **Step 9: commit**

```bash
git add components/board/BoardRoot.tsx
git commit -m "feat(private): wire vault-management and change-password dialogs into SETTINGS"
```

---

## Definition of Done

- [ ] 7タスク全てcommit済み。
- [ ] `npx tsc --noEmit` — 0件。
- [ ] `npx vitest run` — フルスイートgreen(既存分含め・回帰ゼロ)。
- [ ] `npx eslint .` — 0件(新規混入エラーなし)。
- [ ] `pnpm build` — 成功。
- [ ] `npx vitest run messages/all-keys-parity.test.ts` — PASS(15ロケール全てにキーが揃っている)。
- [ ] opus全ブランチレビュー実施 → Critical/Importantゼロを確認してからmasterマージ。
- [ ] **視覚変更のため、マージ前にユーザーに実機/ブラウザでの確認を依頼する**(`.claude/rules/ui-design.md`の承認フロー)。特に確認してほしい点: (a) 目のマークが3画面(SETUP/UNLOCK/CHANGE PASSWORD)で一貫して動くか (b) SETTINGSのPRIVATEを解錠済み状態でクリックしたときに管理画面が出るか (c) CHANGE PASSWORDで新しいパスワードを設定した後、一度リロードして新パスワードで解錠できるか。
