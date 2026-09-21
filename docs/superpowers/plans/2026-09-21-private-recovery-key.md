# Private 復旧キー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** パスワードを忘れた場合でもPrivateを解錠できる、復旧キー(1Password Emergency Kit方式)を追加する。新規vaultには自動発行、既存vaultには後付けで発行できる。

**Architecture:** 既存の暗号プリミティブ(PBKDF2 → AES-GCM)をそのまま再利用し、秘密鍵(pkcs8)をパスワード用とは独立した2つ目の鍵で暗号化して`PrivateVaultRecord`に保存する。`createVault`のシグネチャは変更せず、既存23箇所の呼び出しを無傷に保つ。

**Tech Stack:** Web Crypto API(`crypto.subtle`)、React、既存のi18n(`useI18n`)、vitest、Playwright。

**Spec:** `docs/superpowers/specs/2026-09-21-private-recovery-key-design.md`(実行者はこのplanと合わせて必ず読むこと)。

## Global Constraints

- 新しい暗号方式・暗号ライブラリは増やさない。既存の`lib/private/crypto.ts`の`deriveKey`/`encryptJson`/`decryptJson`/`wrapPrivateKey`/`unwrapPrivateKey`のみを使う。
- `createVault`([lib/private/vault-store.ts:42](../../../lib/private/vault-store.ts#L42))のシグネチャ・戻り値・挙動は**一切変更しない**(既存23箇所の呼び出しに影響させないための設計判断)。
- 復旧キーは使い切りにしない。再発行は既存の復旧キー用フィールドを無条件に上書きする形。
- 文言は全てユーザー承認済み(このplan内に埋め込み済み)。15言語対応: en/jaは実文言、他13言語(ar/de/es/fr/it/ko/nl/pt/ru/th/tr/vi/zh)は英語をそのまま追加する(このリポジトリの既存パターン)。
- `rtk`前置は各タスクのコミット手順にのみ適用(このplanを実行するエージェントはBash実行時に`rtk`を先頭に付ける)。vitest/playwrightは素の`npx`(`rtk npx`は既知の不具合)。
- `session.privateKey`は`extractable: false`でインポートされているため再書き出し不可能。生のpkcs8バイト列が必要な場合は、必ず保存済みの暗号化コピー(`wrappedPrivateKey`または`wrappedPrivateKeyByRecoveryKey`)を`session.wrappingKey`で復号する経路を通す。

---

### Task 1: `lib/private/crypto.ts` — 復旧キーの生成・正規化

**Files:**
- Modify: `lib/private/crypto.ts`
- Test: `lib/private/crypto.test.ts`

**Interfaces:**
- Produces: `export function generateRecoveryKey(): string`、`export function normalizeRecoveryKey(input: string): string`
- Consumed by: Task 2(`lib/private/vault-store.ts`)

- [ ] **Step 1: 失敗するテストを書く**

`lib/private/crypto.test.ts`の既存の`describe('private/crypto', ...)`ブロック内に追加(既存のimport文の対象リストに`generateRecoveryKey, normalizeRecoveryKey`を追加すること):

```ts
  it('generateRecoveryKey returns 30 chars grouped into 6 hyphenated groups of 5, from a restricted alphabet', () => {
    const key = generateRecoveryKey()
    expect(key).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){5}$/)
    expect(key.replace(/-/g, '').length).toBe(30)
  })

  it('generateRecoveryKey never includes ambiguous characters (I, L, O, 0, 1)', () => {
    for (let i = 0; i < 20; i++) {
      const key = generateRecoveryKey()
      expect(key).not.toMatch(/[ILO01]/)
    }
  })

  it('generateRecoveryKey returns a different key each call', () => {
    const a = generateRecoveryKey()
    const b = generateRecoveryKey()
    expect(a).not.toBe(b)
  })

  it('normalizeRecoveryKey strips hyphens/whitespace and uppercases', () => {
    expect(normalizeRecoveryKey('abcde-fghjk-mn234-56789-abcde-fghjk')).toBe('ABCDEFGHJKMN23456789ABCDEFGHJK')
    expect(normalizeRecoveryKey('  ABCDE-FGHJK  ')).toBe('ABCDEFGHJK')
  })

  it('normalizeRecoveryKey is idempotent on an already-generated key', () => {
    const key = generateRecoveryKey()
    const normalized = normalizeRecoveryKey(key)
    expect(normalizeRecoveryKey(normalized)).toBe(normalized)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run lib/private/crypto.test.ts`
Expected: FAIL — `generateRecoveryKey`/`normalizeRecoveryKey` is not exported from `./crypto`。

- [ ] **Step 3: 実装**

`lib/private/crypto.ts`の末尾に追加:

```ts
// 読み間違えやすい文字(I, L, O, 0, 1)を除いた32文字のアルファベット。
// 32 = 2^5 なので、1バイト(0-255)を32で割った余りが完全に均一に分布する
// (256は32の倍数)— 特別な処理をせず crypto.getRandomValues の1バイトを
// そのまま1文字にマッピングできる。
const RECOVERY_KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** 30文字(150ビット相当)のランダムな復旧キーを生成し、5文字ごとに
 *  ハイフンで区切って返す(例: "ABCDE-FGHJK-MN234-56789-ABCDE-FGHJK")。
 *  ハイフンは表示・入力のしやすさのためだけで、鍵導出には使わない
 *  (normalizeRecoveryKeyで取り除く)。 */
export function generateRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(30))
  const chars = Array.from(bytes, (b) => RECOVERY_KEY_ALPHABET[b % 32])
  const groups: string[] = []
  for (let i = 0; i < chars.length; i += 5) groups.push(chars.slice(i, i + 5).join(''))
  return groups.join('-')
}

/** ユーザーが再入力した復旧キーを、鍵導出にそのまま使える正規形に直す
 *  (ハイフン・空白を除去し、大文字化)。生成直後の文字列に対しても
 *  冪等(no-op)。 */
export function normalizeRecoveryKey(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase()
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run lib/private/crypto.test.ts`
Expected: PASS(既存テスト + 新規5件)。

- [ ] **Step 5: コミット**

```bash
rtk git add lib/private/crypto.ts lib/private/crypto.test.ts
rtk git commit -m "feat(private): add recovery-key generation and normalization"
```

---

### Task 2: `lib/private/vault-store.ts` — データモデル・復旧キーの発行・復旧キーでの解錠

**Files:**
- Modify: `lib/private/vault-store.ts`
- Test: `lib/private/vault-store.test.ts`

**Interfaces:**
- Consumes: `generateRecoveryKey, normalizeRecoveryKey`(Task 1)
- Produces:
  - `PrivateVaultRecord`型に`recoverySalt?: string`と`wrappedPrivateKeyByRecoveryKey?: {iv, ciphertext}`を追加(任意項目)
  - `export async function setUpRecoveryKey(db: DbLike, session: NonNullable<PrivateVaultSession>): Promise<string | null>`
  - `export async function unlockVaultWithRecoveryKey(db: DbLike, recoveryKeyInput: string): Promise<PrivateVaultSession>`
  - `changeVaultPassword`は既存の公開シグネチャ・挙動を保ったまま内部実装のみ変更
- Consumed by: Task 8(`components/board/BoardRoot.tsx`)

- [ ] **Step 1: 失敗するテストを書く**

`lib/private/vault-store.test.ts`の既存のimport文に`setUpRecoveryKey, unlockVaultWithRecoveryKey`を追加し、既存の`describe('private/vault-store', ...)`ブロック内(既存の`describe('changeVaultPassword', ...)`の後)に追加:

```ts
  describe('setUpRecoveryKey', () => {
    it('generates a recovery key and stores recoverySalt + wrappedPrivateKeyByRecoveryKey', async () => {
      const session = await createVault(db, 'tag-abc', 'hunter2')
      const recoveryKey = await setUpRecoveryKey(db, session)
      expect(typeof recoveryKey).toBe('string')
      expect(recoveryKey!.length).toBeGreaterThan(0)
      const record = await loadVaultRecord(db)
      expect(record?.recoverySalt?.length).toBeGreaterThan(0)
      expect(record?.wrappedPrivateKeyByRecoveryKey?.iv.length).toBeGreaterThan(0)
      expect(record?.wrappedPrivateKeyByRecoveryKey?.ciphertext.length).toBeGreaterThan(0)
    })

    it('the returned recovery key can unlock via unlockVaultWithRecoveryKey', async () => {
      const session = await createVault(db, 'tag-abc', 'hunter2')
      const recoveryKey = await setUpRecoveryKey(db, session)
      const recovered = await unlockVaultWithRecoveryKey(db, recoveryKey!)
      expect(recovered?.tagId).toBe('tag-abc')
    })

    it('re-running it overwrites the previous recovery key (old one stops working)', async () => {
      const session = await createVault(db, 'tag-abc', 'hunter2')
      const first = await setUpRecoveryKey(db, session)
      const second = await setUpRecoveryKey(db, session)
      expect(second).not.toBe(first)
      expect(await unlockVaultWithRecoveryKey(db, first!)).toBeNull()
      expect(await unlockVaultWithRecoveryKey(db, second!)).not.toBeNull()
    })

    it('returns null when no vault record exists', async () => {
      await createVault(db, 'tag-abc', 'hunter2')
      const session = await unlockVault(db, 'hunter2')
      await db.delete('settings', 'private-vault')
      expect(await setUpRecoveryKey(db, session!)).toBeNull()
    })

    it('works even when session came from a recovery-key unlock (resolveOwnPkcs8 fallback)', async () => {
      const session = await createVault(db, 'tag-abc', 'hunter2')
      const firstRecoveryKey = await setUpRecoveryKey(db, session)
      const recoveredSession = await unlockVaultWithRecoveryKey(db, firstRecoveryKey!)
      const secondRecoveryKey = await setUpRecoveryKey(db, recoveredSession!)
      expect(secondRecoveryKey).not.toBeNull()
      expect(await unlockVaultWithRecoveryKey(db, secondRecoveryKey!)).not.toBeNull()
    })
  })

  describe('unlockVaultWithRecoveryKey', () => {
    it('returns null when no vault exists', async () => {
      expect(await unlockVaultWithRecoveryKey(db, 'ABCDE-FGHJK-MN234-56789-ABCDE-FGHJK')).toBeNull()
    })

    it('returns null when the vault exists but has no recovery key set up yet', async () => {
      await createVault(db, 'tag-abc', 'hunter2')
      expect(await unlockVaultWithRecoveryKey(db, 'ABCDE-FGHJK-MN234-56789-ABCDE-FGHJK')).toBeNull()
    })

    it('returns null (not a thrown error) for a wrong recovery key', async () => {
      const session = await createVault(db, 'tag-abc', 'hunter2')
      await setUpRecoveryKey(db, session)
      expect(await unlockVaultWithRecoveryKey(db, 'ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ')).toBeNull()
    })

    it('is tolerant of lowercase / missing hyphens on re-entry (normalizeRecoveryKey)', async () => {
      const session = await createVault(db, 'tag-abc', 'hunter2')
      const recoveryKey = await setUpRecoveryKey(db, session)
      const messy = recoveryKey!.toLowerCase().replace(/-/g, ' ')
      expect(await unlockVaultWithRecoveryKey(db, messy)).not.toBeNull()
    })

    it("the recovered session's public key still decrypts data encrypted before recovery", async () => {
      const session = await createVault(db, 'tag-abc', 'hunter2')
      const record = await loadVaultRecord(db)
      const publicKey = await importPublicKey(record!.publicKey)
      const envelope = await encryptWithPublicKey(publicKey, { secret: 'hello' })
      const recoveryKey = await setUpRecoveryKey(db, session)
      const recovered = await unlockVaultWithRecoveryKey(db, recoveryKey!)
      await expect(decryptWithPrivateKey(recovered!.privateKey, envelope)).resolves.toEqual({ secret: 'hello' })
    })
  })

  describe('changeVaultPassword after recovery', () => {
    it('changing the password works when the session came from unlockVaultWithRecoveryKey', async () => {
      const session = await createVault(db, 'tag-abc', 'old-password123')
      const recoveryKey = await setUpRecoveryKey(db, session)
      const recoveredSession = await unlockVaultWithRecoveryKey(db, recoveryKey!)
      const result = await changeVaultPassword(db, recoveredSession!, 'brand-new-password789', undefined)
      expect(result.ok).toBe(true)
      expect(await unlockVault(db, 'old-password123')).toBeNull()
      expect(await unlockVault(db, 'brand-new-password789')).not.toBeNull()
    })
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run lib/private/vault-store.test.ts`
Expected: FAIL — `setUpRecoveryKey`/`unlockVaultWithRecoveryKey`が`./vault-store`からexportされていない。

- [ ] **Step 3: 実装**

`lib/private/vault-store.ts`の先頭のimportを次のように変更(`generateRecoveryKey, normalizeRecoveryKey`を追加):

```ts
import {
  PBKDF2_ITERATIONS, deriveKey, generateSalt, decryptJson, encryptJson,
  generateEcdhKeyPair, exportPublicKeyB64, wrapPrivateKey, unwrapPrivateKey,
  generateRecoveryKey, normalizeRecoveryKey,
} from './crypto'
```

`PrivateVaultRecord`型([lib/private/vault-store.ts:13-29](../../../lib/private/vault-store.ts#L13-L29))はこのまま変更せず、`readonly updatedAt?: number`の行の直後、型を閉じる`}`の直前に、2項目を追加する(既存のフィールド・コメントは一切変更しない):

```ts
  /** 復旧キー用のPBKDF2 salt。wrappedPrivateKeyByRecoveryKeyと対で存在する。
   *  無ければ「この端末は復旧キーを未設定」を意味する(既存レコードには
   *  存在しない — 後付け発行のための任意項目)。 */
  readonly recoverySalt?: string
  /** ECDH秘密鍵(pkcs8)の、復旧キー由来の鍵で暗号化したコピー。password用の
   *  wrappedPrivateKeyとは完全に独立した、もう一つの暗号化コピー。 */
  readonly wrappedPrivateKeyByRecoveryKey?: { readonly iv: string; readonly ciphertext: string }
```

`changeVaultPassword`を説明する既存のJSDocコメントブロック(`/**\n * Changes the vault's password WITHOUT requiring the old one...`で始まる、[lib/private/vault-store.ts:89](../../../lib/private/vault-store.ts#L89)の直前 — つまりJSDocより前、`export async function changeVaultPassword`の行(104行目)より前ではない)に、新しい非公開ヘルパーを追加:

```ts
/** session.wrappingKeyが実際にどちらの暗号化コピーを開けるかを気にせず、
 *  生のpkcs8バイト列を復元する。session.privateKey自体は
 *  extractable:falseでインポートされているため再書き出し不可能
 *  (unwrapPrivateKeyの4番目の引数)— 保存済みの暗号化コピーを再度復号する
 *  のが唯一の経路。まずパスワード用のコピー(既存の唯一の経路)を試し、
 *  それが失敗したら(= このsessionが復旧キー経由で解錠されたケース)
 *  復旧キー用のコピーにフォールバックする。 */
async function resolveOwnPkcs8(
  record: PrivateVaultRecord,
  session: NonNullable<PrivateVaultSession>,
): Promise<string> {
  try {
    const { pkcs8 } = await decryptJson<{ pkcs8: string }>(
      session.wrappingKey, record.wrappedPrivateKey.iv, record.wrappedPrivateKey.ciphertext,
    )
    return pkcs8
  } catch {
    if (!record.wrappedPrivateKeyByRecoveryKey) throw new Error('no recovery-key wrap to fall back to')
    const { pkcs8 } = await decryptJson<{ pkcs8: string }>(
      session.wrappingKey, record.wrappedPrivateKeyByRecoveryKey.iv, record.wrappedPrivateKeyByRecoveryKey.ciphertext,
    )
    return pkcs8
  }
}
```

`changeVaultPassword`関数本体のうち、pkcs8を取り出す部分だけを変更する(関数の外側のJSDocコメント・シグネチャ・`newSalt`生成以降の行は一切変更しない)。変更前([lib/private/vault-store.ts:113-121](../../../lib/private/vault-store.ts#L113-L121)):

```ts
  let pkcs8: string
  try {
    const decrypted = await decryptJson<{ pkcs8: string }>(
      session.wrappingKey, record.wrappedPrivateKey.iv, record.wrappedPrivateKey.ciphertext,
    )
    pkcs8 = decrypted.pkcs8
  } catch {
    return { ok: false }
  }
```

変更後:

```ts
  let pkcs8: string
  try {
    pkcs8 = await resolveOwnPkcs8(record, session)
  } catch {
    return { ok: false }
  }
```

ファイル末尾(`retireVault`の後)に2つの新規関数を追加:

```ts
/** すでに解錠済みのsessionから、新しい復旧キーを1つ生成して保存する。
 *  既存の復旧キーがあれば無条件に上書きする(=再発行)ため、「初めて
 *  設定する」と「前のキーを失くしたので作り直す」の両方をこの1つの
 *  関数でカバーする。返り値は表示用の復旧キー文字列そのもの — この関数の
 *  戻り値以外のどこにも平文の復旧キーは残らない。 */
export async function setUpRecoveryKey(
  db: DbLike,
  session: NonNullable<PrivateVaultSession>,
): Promise<string | null> {
  const record = await loadVaultRecord(db)
  if (!record) return null
  let pkcs8: string
  try {
    pkcs8 = await resolveOwnPkcs8(record, session)
  } catch {
    return null
  }
  const recoveryKey = generateRecoveryKey()
  const recoverySalt = generateSalt()
  const recoveryWrappingKey = await deriveKey(normalizeRecoveryKey(recoveryKey), recoverySalt, PBKDF2_ITERATIONS)
  const wrappedPrivateKeyByRecoveryKey = await encryptJson(recoveryWrappingKey, { pkcs8 })
  const newRecord: PrivateVaultRecord = {
    ...record, recoverySalt, wrappedPrivateKeyByRecoveryKey, updatedAt: Date.now(),
  }
  await db.put('settings', newRecord)
  return recoveryKey
}

/** 復旧キーでの解錠を試みる。unlockVaultのパスワード版と対になる —
 *  「復旧キーが無い/間違っている」は同じくnullを返す(例外を投げない)。 */
export async function unlockVaultWithRecoveryKey(
  db: DbLike,
  recoveryKeyInput: string,
): Promise<PrivateVaultSession> {
  const record = await loadVaultRecord(db)
  if (!record || !record.wrappedPrivateKeyByRecoveryKey || !record.recoverySalt) return null
  const wrappingKey = await deriveKey(normalizeRecoveryKey(recoveryKeyInput), record.recoverySalt, record.iterations)
  try {
    const privateKey = await unwrapPrivateKey(record.wrappedPrivateKeyByRecoveryKey, wrappingKey)
    return { tagId: record.tagId, privateKey, wrappingKey }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run lib/private/vault-store.test.ts`
Expected: PASS(既存テスト + 新規11件)。

- [ ] **Step 5: 全体テスト(既存23箇所の`createVault`呼び出しに影響がないことを確認)**

Run: `npx vitest run`
Expected: PASS、失敗0件(`createVault`のシグネチャは無変更のため、`lib/private/vault-conflict.test.ts`・`lib/sync/engine.test.ts`・`tests/lib/backup.test.ts`の既存呼び出しは無傷のはず)。

Run: `npx tsc --noEmit`
Expected: 0エラー。

- [ ] **Step 6: コミット**

```bash
rtk git add lib/private/vault-store.ts lib/private/vault-store.test.ts
rtk git commit -m "feat(private): add recovery-key setup and recovery-key unlock to vault-store"
```

---

### Task 3: `components/board/PrivateRecoveryKeyDialog.tsx` — 復旧キーを1回だけ表示する画面

**Files:**
- Create: `components/board/PrivateRecoveryKeyDialog.tsx`
- Create: `components/board/PrivateRecoveryKeyDialog.module.css`
- Create: `components/board/PrivateRecoveryKeyDialog.test.tsx`
- Modify: `messages/en.json`, `messages/ja.json`, および他13言語ファイル

**Interfaces:**
- Produces: `export function PrivateRecoveryKeyDialog({ recoveryKey, onDone }: { readonly recoveryKey: string; readonly onDone: () => void }): ReactElement`
- Consumed by: Task 8(`BoardRoot.tsx`)

- [ ] **Step 1: 失敗するテストを書く**

`components/board/PrivateRecoveryKeyDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivateRecoveryKeyDialog } from './PrivateRecoveryKeyDialog'

const RECOVERY_KEY = 'ABCDE-FGHJK-MN234-56789-ABCDE-FGHJK'

describe('PrivateRecoveryKeyDialog', () => {
  it('displays the recovery key', () => {
    render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={vi.fn()} />)
    expect(screen.getByTestId('private-recovery-key-value')).toHaveTextContent(RECOVERY_KEY)
  })

  it('copies the recovery key to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={vi.fn()} />)
    fireEvent.click(screen.getByTestId('private-recovery-key-copy'))
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(RECOVERY_KEY))
  })

  it('DONE fires onDone', () => {
    const onDone = vi.fn()
    render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={onDone} />)
    fireEvent.click(screen.getByTestId('private-recovery-key-done'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('backdrop click fires onDone', () => {
    const onDone = vi.fn()
    render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={onDone} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('Escape key fires onDone', () => {
    const onDone = vi.fn()
    render(<PrivateRecoveryKeyDialog recoveryKey={RECOVERY_KEY} onDone={onDone} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run components/board/PrivateRecoveryKeyDialog.test.tsx`
Expected: FAIL — モジュールが存在しない。

- [ ] **Step 3: 実装**

`components/board/PrivateRecoveryKeyDialog.tsx`:

```tsx
'use client'

import { useEffect, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './PrivateRecoveryKeyDialog.module.css'

type Props = {
  readonly recoveryKey: string
  readonly onDone: () => void
}

/** セットアップ直後(新規vault作成時)、または既存vaultへの後付け発行時に
 *  一度だけ表示する。この画面を閉じたら、この復旧キーの文字列自体は
 *  どこにも平文で残らない(vault-store.tsのsetUpRecoveryKeyの戻り値以外
 *  に保存先が無い)。 */
export function PrivateRecoveryKeyDialog({ recoveryKey, onDone }: Props): ReactElement {
  const { t } = useI18n()

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onDone() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onDone])

  const copy = (): void => {
    void navigator.clipboard.writeText(recoveryKey)
  }

  return (
    <div
      className={styles.backdrop}
      onClick={onDone}
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-recovery-key-heading"
      data-testid="private-recovery-key-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-recovery-key-heading" className={styles.heading}>{t('private.recoveryKeyHeading')}</div>
        <div className={styles.body}>{t('private.recoveryKeyBody')}</div>
        <div className={styles.keyBox} data-testid="private-recovery-key-value">{recoveryKey}</div>
        <div className={styles.actions}>
          <button type="button" className={styles.copyBtn} onClick={copy} data-testid="private-recovery-key-copy">
            {t('private.recoveryKeyCopyButton')}
          </button>
          <button type="button" className={styles.doneBtn} onClick={onDone} data-testid="private-recovery-key-done">
            {t('private.recoveryKeyDoneButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

`components/board/PrivateRecoveryKeyDialog.module.css`(`PrivateSetupDialog.module.css`と同じ型を踏襲、`.keyBox`は新規):

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
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.heading { font-size: 13px; letter-spacing: 0.08em; color: #f2f2f2; margin-bottom: 8px; }
.body { font-size: 12px; line-height: 1.5; color: rgba(242, 242, 242, 0.6); margin-bottom: 4px; }
.keyBox {
  font-family: monospace;
  font-size: 14px;
  letter-spacing: 0.04em;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #f2f2f2;
  text-align: center;
  word-break: break-all;
  margin: 4px 0;
}
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.copyBtn, .doneBtn {
  font-size: 12px;
  letter-spacing: 0.06em;
  padding: 7px 14px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: transparent;
  color: #f2f2f2;
  cursor: pointer;
}
.doneBtn { border-color: rgba(40, 241, 0, 0.55); }
```

`messages/en.json`と`messages/ja.json`の`"private"`セクション内(既存の最後のキーの後、例えば`vaultConflictMergeFailed`の後)に追加(承認済み文言):

```json
    "recoveryKeyHeading": "RECOVERY KEY",
    "recoveryKeyBody": "This key can unlock Private even if you forget your password. It's shown only once — save it somewhere safe. If you lose this too, Private can never be unlocked again.",
    "recoveryKeyCopyButton": "COPY",
    "recoveryKeyDoneButton": "Got it"
```

ja.json版:

```json
    "recoveryKeyHeading": "復旧キー",
    "recoveryKeyBody": "このキーがあれば、パスワードを忘れてもPrivateを開けます。今しか表示されません。安全な場所に保存してください。このキーも失うと、二度と開けなくなります。",
    "recoveryKeyCopyButton": "コピー",
    "recoveryKeyDoneButton": "わかった"
```

他13言語ファイル(`ar.json`/`de.json`/`es.json`/`fr.json`/`it.json`/`ko.json`/`nl.json`/`pt.json`/`ru.json`/`th.json`/`tr.json`/`vi.json`/`zh.json`)には、上記の英語版と同じ4キーを、同じ場所に追加する(既存パターン: en/jaのみ実文言、他13言語は英語プレースホルダー)。スクリプトで機械的に追加してよい(`docs/superpowers/plans`の過去のタスクと同じ手法 — scratchpad配下に小さなNode script を書いて実行→`git diff --stat -- messages/`で確認→scriptは削除→JSONファイルのみコミット)。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run components/board/PrivateRecoveryKeyDialog.test.tsx`
Expected: PASS(5件)。

- [ ] **Step 5: コミット**

```bash
rtk git add components/board/PrivateRecoveryKeyDialog.tsx components/board/PrivateRecoveryKeyDialog.module.css components/board/PrivateRecoveryKeyDialog.test.tsx messages/
rtk git commit -m "feat(private): add the one-time recovery-key display dialog"
```

---

### Task 4: `components/board/PrivateRecoverDialog.tsx` — 復旧キーを入力する画面

**Files:**
- Create: `components/board/PrivateRecoverDialog.tsx`
- Create: `components/board/PrivateRecoverDialog.module.css`
- Create: `components/board/PrivateRecoverDialog.test.tsx`
- Modify: `messages/en.json`, `messages/ja.json`, および他13言語ファイル

**Interfaces:**
- Produces: `export function PrivateRecoverDialog({ onSubmit, onCancel }: { readonly onSubmit: (recoveryKeyInput: string) => Promise<boolean>; readonly onCancel: () => void }): ReactElement`
- Consumed by: Task 8(`BoardRoot.tsx`)

- [ ] **Step 1: 失敗するテストを書く**

`components/board/PrivateRecoverDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivateRecoverDialog } from './PrivateRecoverDialog'

describe('PrivateRecoverDialog', () => {
  it('submits the entered recovery key', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    render(<PrivateRecoverDialog onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/./), { target: { value: 'ABCDE-FGHJK-MN234-56789-ABCDE-FGHJK' } })
    fireEvent.click(screen.getByTestId('private-recover-submit'))
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith('ABCDE-FGHJK-MN234-56789-ABCDE-FGHJK'))
  })

  it('shows an error when onSubmit resolves false', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false)
    render(<PrivateRecoverDialog onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByTestId('private-recover-submit'))
    await vi.waitFor(() => expect(screen.getByTestId('private-recover-error')).toBeInTheDocument())
  })

  it('CANCEL fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateRecoverDialog onSubmit={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('private-recover-cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Escape key fires onCancel', () => {
    const onCancel = vi.fn()
    render(<PrivateRecoverDialog onSubmit={vi.fn()} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run components/board/PrivateRecoverDialog.test.tsx`
Expected: FAIL — モジュールが存在しない。

- [ ] **Step 3: 実装**

`components/board/PrivateRecoverDialog.tsx`:

```tsx
'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './PrivateRecoverDialog.module.css'

type Props = {
  readonly onSubmit: (recoveryKeyInput: string) => Promise<boolean>
  readonly onCancel: () => void
}

/** 「パスワードを忘れた場合」導線から開く、復旧キー入力画面。パスワード欄と
 *  違い、長い文字列を正確に転記する場面なのでマスクしない通常のテキスト
 *  入力にする(PrivateSetupDialogのヒント欄と同じ<input type="text">)。 */
export function PrivateRecoverDialog({ onSubmit, onCancel }: Props): ReactElement {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (): Promise<void> => {
    if (submitting) return
    setSubmitting(true)
    const ok = await onSubmit(value)
    setSubmitting(false)
    if (!ok) setError(t('private.errorWrongRecoveryKey'))
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
      aria-labelledby="private-recover-heading"
      data-testid="private-recover-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="private-recover-heading" className={styles.heading}>{t('private.recoverHeading')}</div>
        <div className={styles.explanation}>{t('private.recoverExplanation')}</div>
        <label className={styles.label} htmlFor="private-recover-input">{t('private.recoverInputLabel')}</label>
        <input
          id="private-recover-input"
          type="text"
          className={styles.input}
          value={value}
          onChange={(e): void => setValue(e.target.value)}
        />
        {error && <div className={styles.error} data-testid="private-recover-error">{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} data-testid="private-recover-cancel">
            CANCEL
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={(): void => { void submit() }}
            disabled={submitting}
            data-testid="private-recover-submit"
          >
            UNLOCK
          </button>
        </div>
      </div>
    </div>
  )
}
```

`components/board/PrivateRecoverDialog.module.css`(`PrivateSetupDialog.module.css`と同じ型を踏襲):

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
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.heading { font-size: 13px; letter-spacing: 0.08em; color: #f2f2f2; margin-bottom: 8px; }
.explanation { font-size: 12px; line-height: 1.5; color: rgba(242, 242, 242, 0.6); margin-bottom: 4px; }
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
.cancelBtn, .submitBtn {
  font-size: 12px;
  letter-spacing: 0.06em;
  padding: 7px 14px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: transparent;
  color: #f2f2f2;
  cursor: pointer;
}
.submitBtn { border-color: rgba(40, 241, 0, 0.55); }
.submitBtn:disabled { opacity: 0.5; cursor: default; }
```

`messages/en.json`/`messages/ja.json`の`"private"`セクションに追加(承認済み文言):

```json
    "recoverHeading": "UNLOCK WITH RECOVERY KEY",
    "recoverExplanation": "Enter the recovery key you saved when you set up Private.",
    "recoverInputLabel": "Recovery key",
    "errorWrongRecoveryKey": "Wrong recovery key."
```

ja.json版:

```json
    "recoverHeading": "復旧キーで開ける",
    "recoverExplanation": "セットアップ時に保存した復旧キーを入力してください。",
    "recoverInputLabel": "復旧キー",
    "errorWrongRecoveryKey": "復旧キーが違います。"
```

他13言語ファイルには英語版と同じ4キーを同じ場所に追加(Task 3と同じ手法)。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run components/board/PrivateRecoverDialog.test.tsx`
Expected: PASS(4件)。

- [ ] **Step 5: コミット**

```bash
rtk git add components/board/PrivateRecoverDialog.tsx components/board/PrivateRecoverDialog.module.css components/board/PrivateRecoverDialog.test.tsx messages/
rtk git commit -m "feat(private): add the recovery-key entry dialog"
```

---

### Task 5: `PrivateUnlockDialog.tsx` — 「パスワードを忘れた場合」リンク追加

**Files:**
- Modify: `components/board/PrivateUnlockDialog.tsx`
- Modify: `components/board/PrivateUnlockDialog.module.css`
- Test: `components/board/PrivateUnlockDialog.test.tsx`(既存ファイルがあれば追記、無ければ新規作成 — 実行前に`ls components/board/PrivateUnlockDialog.test.tsx`で確認すること)
- Modify: `messages/en.json`, `messages/ja.json`, および他13言語ファイル

**Interfaces:**
- Consumes: なし(このタスク単体で完結)
- Produces: `PrivateUnlockDialog`のPropsに`hasRecoveryKey: boolean`と`onForgotPassword: () => void`を追加(既存のprops・挙動は無変更)
- Consumed by: Task 8(`BoardRoot.tsx`)

- [ ] **Step 1: 失敗するテストを書く**

`components/board/PrivateUnlockDialog.test.tsx`に追加(既存テストがどのパターンでレンダーしているか先に確認し、それに合わせること。無ければ以下を新規ファイルとして作成し、既存の`PrivateUnlockDialog`の必須propsを全て渡すこと — 例: `hint`は省略可、`onSubmit`/`onCancel`は必須):

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivateUnlockDialog } from './PrivateUnlockDialog'

describe('PrivateUnlockDialog forgot-password link', () => {
  it('shows the link when hasRecoveryKey is true, and clicking it fires onForgotPassword', () => {
    const onForgotPassword = vi.fn()
    render(
      <PrivateUnlockDialog
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        hasRecoveryKey={true}
        onForgotPassword={onForgotPassword}
      />,
    )
    fireEvent.click(screen.getByTestId('private-unlock-forgot-password'))
    expect(onForgotPassword).toHaveBeenCalledTimes(1)
  })

  it('does not show the link when hasRecoveryKey is false', () => {
    render(
      <PrivateUnlockDialog
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        hasRecoveryKey={false}
        onForgotPassword={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('private-unlock-forgot-password')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run components/board/PrivateUnlockDialog.test.tsx`
Expected: FAIL — `hasRecoveryKey`/`onForgotPassword`propが無い、または`private-unlock-forgot-password`のtestidが存在しない。

- [ ] **Step 3: 実装**

`components/board/PrivateUnlockDialog.tsx`のProps型([components/board/PrivateUnlockDialog.tsx:8](../../../components/board/PrivateUnlockDialog.tsx#L8))を変更:

```tsx
type Props = {
  readonly hint?: string
  readonly onSubmit: (password: string) => Promise<boolean>
  readonly onCancel: () => void
  readonly hasRecoveryKey: boolean
  readonly onForgotPassword: () => void
}

export function PrivateUnlockDialog({ hint, onSubmit, onCancel, hasRecoveryKey, onForgotPassword }: Props): ReactElement {
```

`{error && <div className={styles.error}>{error}</div>}`の直後、`<div className={styles.actions}>`の直前に追加:

```tsx
        {hasRecoveryKey && (
          <button
            type="button"
            className={styles.forgotPasswordLink}
            onClick={onForgotPassword}
            data-testid="private-unlock-forgot-password"
          >
            {t('private.forgotPasswordLink')}
          </button>
        )}
```

`components/board/PrivateUnlockDialog.module.css`に追加:

```css
.forgotPasswordLink {
  align-self: flex-start;
  font-size: 11px;
  color: rgba(242, 242, 242, 0.5);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  margin-top: 2px;
}
```

`messages/en.json`/`messages/ja.json`の`"private"`セクションに追加(承認済み文言):

```json
    "forgotPasswordLink": "Forgot password?"
```

ja.json版:

```json
    "forgotPasswordLink": "パスワードを忘れた場合"
```

他13言語ファイルには英語版と同じキーを同じ場所に追加。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run components/board/PrivateUnlockDialog.test.tsx`
Expected: PASS(既存テスト + 新規2件)。

- [ ] **Step 5: コミット**

```bash
rtk git add components/board/PrivateUnlockDialog.tsx components/board/PrivateUnlockDialog.module.css components/board/PrivateUnlockDialog.test.tsx messages/
rtk git commit -m "feat(private): add a forgot-password link to the unlock dialog"
```

---

### Task 6: `PrivateManageDialog.tsx` — 復旧キーの設定・再発行ボタン追加

**Files:**
- Modify: `components/board/PrivateManageDialog.tsx`
- Modify: `components/board/PrivateManageDialog.module.css`
- Test: `components/board/PrivateManageDialog.test.tsx`(既存ファイルがあれば追記、無ければ新規作成 — Task 5と同じ確認手順)
- Modify: `messages/en.json`, `messages/ja.json`, および他13言語ファイル

**Interfaces:**
- Produces: `PrivateManageDialog`のPropsに`hasRecoveryKey: boolean`と`onSetUpRecoveryKey: () => void`を追加(既存のprops・挙動は無変更)
- Consumed by: Task 8(`BoardRoot.tsx`)

- [ ] **Step 1: 失敗するテストを書く**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivateManageDialog } from './PrivateManageDialog'

describe('PrivateManageDialog recovery-key button', () => {
  it('shows "set up" wording when hasRecoveryKey is false, and clicking fires onSetUpRecoveryKey', () => {
    const onSetUpRecoveryKey = vi.fn()
    render(
      <PrivateManageDialog
        onChangePassword={vi.fn()}
        onDone={vi.fn()}
        hasRecoveryKey={false}
        onSetUpRecoveryKey={onSetUpRecoveryKey}
      />,
    )
    expect(screen.getByTestId('private-manage-recovery-key')).toHaveTextContent(/set up/i)
    fireEvent.click(screen.getByTestId('private-manage-recovery-key'))
    expect(onSetUpRecoveryKey).toHaveBeenCalledTimes(1)
  })

  it('shows "regenerate" wording when hasRecoveryKey is true', () => {
    render(
      <PrivateManageDialog
        onChangePassword={vi.fn()}
        onDone={vi.fn()}
        hasRecoveryKey={true}
        onSetUpRecoveryKey={vi.fn()}
      />,
    )
    expect(screen.getByTestId('private-manage-recovery-key')).toHaveTextContent(/regenerate/i)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run components/board/PrivateManageDialog.test.tsx`
Expected: FAIL — propが無い/testidが存在しない。

- [ ] **Step 3: 実装**

`components/board/PrivateManageDialog.tsx`のProps型([components/board/PrivateManageDialog.tsx:7](../../../components/board/PrivateManageDialog.tsx#L7))を変更:

```tsx
type Props = {
  readonly hint?: string
  readonly onChangePassword: () => void
  readonly onDone: () => void
  readonly hasRecoveryKey: boolean
  readonly onSetUpRecoveryKey: () => void
}

export function PrivateManageDialog({ hint, onChangePassword, onDone, hasRecoveryKey, onSetUpRecoveryKey }: Props): ReactElement {
```

既存の`changeBtn`ボタンの直後に追加:

```tsx
        <button type="button" className={styles.changeBtn} onClick={onSetUpRecoveryKey} data-testid="private-manage-recovery-key">
          {t(hasRecoveryKey ? 'private.regenerateRecoveryKeyButton' : 'private.setUpRecoveryKeyButton')}
        </button>
```

CSSは既存の`.changeBtn`クラスを再利用するため、`PrivateManageDialog.module.css`への変更は不要。

`messages/en.json`/`messages/ja.json`の`"private"`セクションに追加(承認済み文言):

```json
    "setUpRecoveryKeyButton": "SET UP RECOVERY KEY",
    "regenerateRecoveryKeyButton": "REGENERATE RECOVERY KEY",
    "recoveryKeySetupFailedToast": "Couldn't set up a recovery key. You can try again from the manage screen."
```

ja.json版:

```json
    "setUpRecoveryKeyButton": "復旧キーを作成",
    "regenerateRecoveryKeyButton": "復旧キーを再発行",
    "recoveryKeySetupFailedToast": "復旧キーを作成できませんでした。あとで設定画面から作成できます。"
```

他13言語ファイルには英語版と同じ3キーを同じ場所に追加。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run components/board/PrivateManageDialog.test.tsx`
Expected: PASS(既存テスト + 新規2件)。

- [ ] **Step 5: コミット**

```bash
rtk git add components/board/PrivateManageDialog.tsx components/board/PrivateManageDialog.test.tsx messages/
rtk git commit -m "feat(private): add a recovery-key setup/regenerate button to the manage dialog"
```

---

### Task 7: `PrivateChangePasswordDialog.tsx` — `'recovered'` variant追加

**Files:**
- Modify: `components/board/PrivateChangePasswordDialog.tsx`
- Test: `components/board/PrivateChangePasswordDialog.test.tsx`
- Modify: `messages/en.json`, `messages/ja.json`, および他13言語ファイル

**Interfaces:**
- Produces: `PrivateChangePasswordDialog`の`variant`型を`'change' | 'vault-conflict-resolved' | 'recovered'`に拡張(既存2 variantの挙動は無変更)
- Consumed by: Task 8(`BoardRoot.tsx`)

- [ ] **Step 1: 失敗するテストを書く**

既存の`components/board/PrivateChangePasswordDialog.test.tsx`に追加:

```tsx
  it('shows the recovered heading/explanation when variant="recovered"', () => {
    render(<PrivateChangePasswordDialog onSubmit={vi.fn()} onCancel={vi.fn()} variant="recovered" />)
    expect(screen.getByTestId('private-change-password-dialog').textContent).toMatch(/new password/i)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run components/board/PrivateChangePasswordDialog.test.tsx`
Expected: FAIL — `variant="recovered"`が型エラーになる、または見出しが変わらない。

- [ ] **Step 3: 実装**

`components/board/PrivateChangePasswordDialog.tsx`のProps型([components/board/PrivateChangePasswordDialog.tsx:8-19](../../../components/board/PrivateChangePasswordDialog.tsx#L8-L19))を変更前:

```tsx
type Props = {
  readonly hint?: string
  readonly onSubmit: (newPassword: string, newHint: string | undefined) => Promise<boolean>
  readonly onCancel: () => void
  /** 'vault-conflict-resolved': shown once, on the winning device, right
   *  after lib/private/vault-conflict.ts's isVaultConflictResolved first
   *  returns true — the two independently-created vaults have now
   *  converged on this one, and the user picks a single fresh password to
   *  use everywhere from now on (see this plan's copy table). Default
   *  'change' is the pre-existing, unchanged password-change flow. */
  readonly variant?: 'change' | 'vault-conflict-resolved'
}
```

変更後:

```tsx
type Props = {
  readonly hint?: string
  readonly onSubmit: (newPassword: string, newHint: string | undefined) => Promise<boolean>
  readonly onCancel: () => void
  /** 'vault-conflict-resolved': shown once, on the winning device, right
   *  after lib/private/vault-conflict.ts's isVaultConflictResolved first
   *  returns true — the two independently-created vaults have now
   *  converged on this one, and the user picks a single fresh password to
   *  use everywhere from now on (see this plan's copy table).
   *  'recovered': shown right after a successful unlockVaultWithRecoveryKey
   *  — the user must pick a new password before continuing. Default
   *  'change' is the pre-existing, unchanged password-change flow. */
  readonly variant?: 'change' | 'vault-conflict-resolved' | 'recovered'
}
```

見出し・本文のJSX([components/board/PrivateChangePasswordDialog.tsx:66-71](../../../components/board/PrivateChangePasswordDialog.tsx#L66-L71))を変更前:

```tsx
        <div id="private-change-password-heading" className={styles.heading}>
          {t(variant === 'vault-conflict-resolved' ? 'private.vaultConflictResolvedHeading' : 'private.changePasswordHeading')}
        </div>
        <div className={styles.explanation}>
          {t(variant === 'vault-conflict-resolved' ? 'private.vaultConflictResolvedBody' : 'private.changePasswordExplanation')}
        </div>
```

変更後:

```tsx
        <div id="private-change-password-heading" className={styles.heading}>
          {t(
            variant === 'vault-conflict-resolved' ? 'private.vaultConflictResolvedHeading'
              : variant === 'recovered' ? 'private.recoveredHeading'
              : 'private.changePasswordHeading',
          )}
        </div>
        <div className={styles.explanation}>
          {t(
            variant === 'vault-conflict-resolved' ? 'private.vaultConflictResolvedBody'
              : variant === 'recovered' ? 'private.recoveredBody'
              : 'private.changePasswordExplanation',
          )}
        </div>
```

他の全ての行(両方のPasswordField・ヒント入力・エラー表示・CANCEL/SAVEボタン)は無変更。

`messages/en.json`/`messages/ja.json`の`"private"`セクションに追加(承認済み文言):

```json
    "recoveredHeading": "Set a new password",
    "recoveredBody": "Unlocked with your recovery key. Set a new password to use from now on."
```

ja.json版:

```json
    "recoveredHeading": "新しいパスワードを決めてください",
    "recoveredBody": "復旧キーで開けました。これから使う、新しいパスワードを1つ決めてください。"
```

他13言語ファイルには英語版と同じ2キーを同じ場所に追加。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run components/board/PrivateChangePasswordDialog.test.tsx`
Expected: PASS(既存テスト + 新規1件)。

- [ ] **Step 5: コミット**

```bash
rtk git add components/board/PrivateChangePasswordDialog.tsx components/board/PrivateChangePasswordDialog.test.tsx messages/
rtk git commit -m "feat(private): add the recovered variant to the change-password dialog"
```

---

### Task 8: `components/board/BoardRoot.tsx` — 全体の配線 + SETUP画面の既存文言更新

**Files:**
- Modify: `components/board/BoardRoot.tsx`
- Modify: `messages/en.json`, `messages/ja.json`(`setupExplanation`の既存文言更新のみ — 他13言語は今回変更しない。英語プレースホルダーは元の英文のままで実害はなく、この変更は範囲外とする)

**Interfaces:**
- Consumes: Task 1-7の全ての新規export
- Produces: なし(新規exportは無し。既存の`privateDialog`状態機械の拡張のみ)

- [ ] **Step 1: 現在の実際のファイル内容を確認する**

このタスクは既存の大きなファイル(`BoardRoot.tsx`)への複数箇所の変更を含む。実行前に以下を`grep`で確認し、下記の「変更前」コードが実際の行と一致することを確認すること(前のタスクのコミットで行番号がずれている可能性がある):

```bash
grep -n "useState<'setup'\|setPrivateHint(record.hint)\|onCreate={async (password, hint)\|privateDialog === 'unlock'\|privateDialog === 'manage'\|createVault, unlockVault, loadVaultRecord, changeVaultPassword" components/board/BoardRoot.tsx
```

- [ ] **Step 2: importの追加**

既存のvault-store importの行([components/board/BoardRoot.tsx:67](../../../components/board/BoardRoot.tsx#L67)、実際の行番号は上記grepで確認)を変更:

```tsx
import { createVault, unlockVault, loadVaultRecord, changeVaultPassword, setUpRecoveryKey, unlockVaultWithRecoveryKey } from '@/lib/private/vault-store'
```

新規ダイアログのimportを、既存の`PrivateChangePasswordDialog`のimportの近くに追加:

```tsx
import { PrivateRecoveryKeyDialog } from './PrivateRecoveryKeyDialog'
import { PrivateRecoverDialog } from './PrivateRecoverDialog'
```

- [ ] **Step 3: `privateDialog`状態unionの拡張**

```tsx
const [privateDialog, setPrivateDialog] = useState<'setup' | 'unlock' | 'manage' | 'change-password' | 'vault-conflict-notice' | 'vault-conflict-merge' | 'vault-conflict-resolved' | 'recovery-key' | 'recover' | 'recovered' | null>(null)
```

- [ ] **Step 4: 新規stateの追加**

既存の`const [privateHint, setPrivateHint] = useState<string | undefined>(undefined)`の直後に追加:

```tsx
const [privateHasRecoveryKey, setPrivateHasRecoveryKey] = useState(false)
const [pendingRecoveryKeyDisplay, setPendingRecoveryKeyDisplay] = useState<string | null>(null)
```

- [ ] **Step 5: `privateHint`が読み込まれている既存2箇所に、`privateHasRecoveryKey`の読み込みも追加**

1箇所目(`setPendingPrivateAction(action)`の直後、`void (async (): Promise<void> => { const record = await loadVaultRecord(await initDB()); if (record) setPrivateHint(record.hint) ... })()`ブロック内)を変更前:

```tsx
        void (async (): Promise<void> => {
          const record = await loadVaultRecord(await initDB())
          if (record) setPrivateHint(record.hint)
```

変更後:

```tsx
        void (async (): Promise<void> => {
          const record = await loadVaultRecord(await initDB())
          if (record) {
            setPrivateHint(record.hint)
            setPrivateHasRecoveryKey(!!record.wrappedPrivateKeyByRecoveryKey)
          }
```

2箇所目(`onOpenPrivate={() => { void (async (): Promise<void> => { ... if (record === null) { setPrivateDialog('setup'); return } setPrivateHint(record.hint) ... } })() }`ブロック内)を変更前:

```tsx
                      setPrivateHint(record.hint)
                      if (privateSession !== null) {
                        setPrivateDialog('manage')
                        return
                      }
                      setPrivateDialog('unlock')
```

変更後:

```tsx
                      setPrivateHint(record.hint)
                      setPrivateHasRecoveryKey(!!record.wrappedPrivateKeyByRecoveryKey)
                      if (privateSession !== null) {
                        setPrivateDialog('manage')
                        return
                      }
                      setPrivateDialog('unlock')
```

- [ ] **Step 6: 既存コメントの更新**

1箇所目の直前にある、次のコメント(「hint is the only recovery mechanism this feature has (no backdoor, by design)」という古い前提を書いている箇所)を変更前:

```tsx
        // Mirrors onOpenPrivate's SETTINGS-path hint load below — the hint is
        // the only recovery mechanism this feature has (no backdoor, by
        // design), so it must appear on these entry points too, not just
        // the pre-existing SETTINGS entry (final whole-branch review
        // finding).
```

変更後(「唯一の」という、復旧キー実装後は誤りになる前提を取り除く):

```tsx
        // Mirrors onOpenPrivate's SETTINGS-path hint/recovery-key-status
        // load below — both must appear on these entry points too, not
        // just the pre-existing SETTINGS entry (final whole-branch review
        // finding for the hint; recovery-key status follows the same
        // pattern).
```

- [ ] **Step 7: SETUPフロー(`onCreate`)の変更**

`privateDialog === 'setup'`ブロック内の`onCreate`ハンドラを変更する。変更前(`await reloadTags()`より前の行、コメントを含め一切変更しない):

```tsx
              await reloadTags()
              setPrivateDialog(null)
              if (pendingPrivateAction) void runPrivateAction(pendingPrivateAction, tag.id, session)
              return true
```

変更後:

```tsx
              await reloadTags()
              const recoveryKey = await setUpRecoveryKey(db, session)
              if (pendingPrivateAction) void runPrivateAction(pendingPrivateAction, tag.id, session)
              if (recoveryKey) {
                setPrivateHasRecoveryKey(true)
                setPendingRecoveryKeyDisplay(recoveryKey)
                setPrivateDialog('recovery-key')
              } else {
                setToast({ message: t('private.recoveryKeySetupFailedToast'), nonce: Date.now() })
                setPrivateDialog(null)
              }
              return true
```

(`try`/`catch`/`onCancel`など、他の行は無変更のまま残す。)

- [ ] **Step 8: `PrivateUnlockDialog`の呼び出しにpropを追加**

`<PrivateUnlockDialog`の呼び出し(`privateDialog === 'unlock'`ブロック内)に、既存の`hint={privateHint}`の下に2行追加:

```tsx
          hint={privateHint}
          hasRecoveryKey={privateHasRecoveryKey}
          onForgotPassword={(): void => setPrivateDialog('recover')}
```

- [ ] **Step 9: `PrivateManageDialog`の呼び出しにpropを追加**

`<PrivateManageDialog`の呼び出しに、既存の`hint={privateHint}`の下に2行追加:

```tsx
          hint={privateHint}
          hasRecoveryKey={privateHasRecoveryKey}
          onSetUpRecoveryKey={(): void => { void handleSetUpRecoveryKey() }}
```

- [ ] **Step 10: `handleSetUpRecoveryKey`の新規追加**

`onOpenPrivate`や他の`useCallback`の近く(Private関連のハンドラがまとまっている箇所)に追加:

```tsx
  const handleSetUpRecoveryKey = useCallback(async (): Promise<void> => {
    if (!privateSession) return
    const db = await initDB()
    const recoveryKey = await setUpRecoveryKey(db, privateSession)
    if (!recoveryKey) {
      setToast({ message: t('private.recoveryKeySetupFailedToast'), nonce: Date.now() })
      return
    }
    setPrivateHasRecoveryKey(true)
    setPendingRecoveryKeyDisplay(recoveryKey)
    setPrivateDialog('recovery-key')
  }, [privateSession, t])
```

- [ ] **Step 11: 3つの新規ダイアログ状態のレンダーを追加**

既存の`{privateDialog === 'manage' && (...)}`ブロックの直後に追加:

```tsx
      {privateDialog === 'recovery-key' && pendingRecoveryKeyDisplay && (
        <PrivateRecoveryKeyDialog
          recoveryKey={pendingRecoveryKeyDisplay}
          onDone={(): void => { setPendingRecoveryKeyDisplay(null); setPrivateDialog(null) }}
        />
      )}
      {privateDialog === 'recover' && (
        <PrivateRecoverDialog
          onSubmit={async (recoveryKeyInput): Promise<boolean> => {
            try {
              const db = await initDB()
              const session = await unlockVaultWithRecoveryKey(db, recoveryKeyInput)
              if (!session) return false
              setPrivateVaultSession(session)
              setPrivateDialog('recovered')
              return true
            } catch (e) {
              console.error('[AllMarks] failed to unlock Private with a recovery key', e)
              return false
            }
          }}
          onCancel={(): void => setPrivateDialog('unlock')}
        />
      )}
      {privateDialog === 'recovered' && privateSession && (
        <PrivateChangePasswordDialog
          variant="recovered"
          onSubmit={async (newPassword, newHint): Promise<boolean> => {
            if (!privateSession) return false
            try {
              const db = await initDB()
              const result = await changeVaultPassword(db, privateSession, newPassword, newHint)
              if (!result.ok) return false
              setPrivateVaultSession(result.session)
              setPrivateHint(newHint)
              setPrivateDialog(null)
              setToast({ message: t('private.recoveredHeading'), nonce: Date.now() })
              return true
            } catch (e) {
              console.error('[AllMarks] failed to set the recovered Private password', e)
              return false
            }
          }}
          onCancel={(): void => setPrivateDialog(null)}
        />
      )}
```

- [ ] **Step 12: SETUP画面の既存説明文を更新(承認済み文言)**

`messages/en.json`の`"private.setupExplanation"`を次のように変更:

```json
    "setupExplanation": "Encrypts the title, URL, thumbnail and photos of anything tagged Private with this password — the real content is never stored in plain text. You can change the password anytime from a device that's already unlocked. A recovery key will also be shown after creation — save that somewhere safe too. It's your only way back in if you forget your password.",
```

`messages/ja.json`の同キーを次のように変更:

```json
    "setupExplanation": "このパスワードで、Privateタグを付けたものすべてのタイトル・URL・サムネイル・画像を暗号化します。実際の中身は平文では一切保存されません。既に解錠済みの端末からは、いつでもパスワードを変更できます。作成後に表示される復旧キーも、必ず安全な場所に保存してください — パスワードを忘れた場合の唯一の手がかりです。",
```

他13言語ファイルの`setupExplanation`は今回変更しない(既存の英語プレースホルダーのまま — Global Constraints参照)。

- [ ] **Step 13: 型検査・テスト**

Run: `npx tsc --noEmit`
Expected: 0エラー。

Run: `npx vitest run`
Expected: PASS、失敗0件。

- [ ] **Step 14: コミット**

```bash
rtk git add components/board/BoardRoot.tsx messages/en.json messages/ja.json
rtk git commit -m "feat(private): wire the recovery-key setup/entry/recovered flows into BoardRoot"
```

---

### Task 9: e2eテスト — 一連の流れを実機相当で検証

**Files:**
- Modify: `tests/e2e/private-vault.spec.ts`

**Interfaces:**
- Consumes: Task 1-8の全ての成果物
- Produces: なし

- [ ] **Step 1: 失敗するテストを書く**

`tests/e2e/private-vault.spec.ts`の末尾に追加(既存の`PASSWORD`/`BOOKMARK_ID`定数・`seedOneBookmark`/`openSettings`ヘルパーをそのまま使う):

```ts
test('recovery key: new vault shows a recovery key once, and it can unlock after forgetting the password', async ({ page }) => {
  // 1. 新規vault作成
  await seedDb(page, [...firstRunSuppressors(), ...seedOneBookmark()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const setupDialog = page.getByTestId('private-setup-dialog')
  await expect(setupDialog).toBeVisible()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()
  await expect(setupDialog).toHaveCount(0)

  // 2. 復旧キー画面が自動的に出る。値を読み取って保存。
  const recoveryDialog = page.getByTestId('private-recovery-key-dialog')
  await expect(recoveryDialog).toBeVisible()
  const recoveryKey = (await page.getByTestId('private-recovery-key-value').textContent())!.trim()
  expect(recoveryKey.length).toBeGreaterThan(0)
  await page.getByTestId('private-recovery-key-done').click()
  await expect(recoveryDialog).toHaveCount(0)

  // 3. リロードしてロック状態にし、UNLOCK画面から「パスワードを忘れた場合」へ。
  await page.reload()
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const unlockDialog = page.getByTestId('private-unlock-dialog')
  await expect(unlockDialog).toBeVisible()
  await page.getByTestId('private-unlock-forgot-password').click()
  await expect(unlockDialog).toHaveCount(0)

  // 4. 復旧キーを入力して解錠。
  const recoverDialog = page.getByTestId('private-recover-dialog')
  await expect(recoverDialog).toBeVisible()
  await page.locator('#private-recover-input').fill(recoveryKey)
  await page.getByTestId('private-recover-submit').click()
  await expect(recoverDialog).toHaveCount(0)

  // 5. 新しいパスワードを決める画面が出る。
  const changePasswordDialog = page.getByTestId('private-change-password-dialog')
  await expect(changePasswordDialog).toBeVisible()
  const NEW_PASSWORD = 'brand-new-password-456'
  await page.locator('#private-change-password-new').fill(NEW_PASSWORD)
  await page.locator('#private-change-password-confirm').fill(NEW_PASSWORD)
  await page.getByTestId('private-change-password-save').click()
  await expect(changePasswordDialog).toHaveCount(0)

  // 6. リロードして、新しいパスワードで解錠できることを確認。
  await page.reload()
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const unlockDialog2 = page.getByTestId('private-unlock-dialog')
  await expect(unlockDialog2).toBeVisible()
  await page.locator('#private-unlock-password').fill(NEW_PASSWORD)
  await page.getByTestId('private-unlock-submit').click()
  await expect(unlockDialog2).toHaveCount(0)
  // 既存の挙動(Task 7 private-password-change、既存e2e private-vault.spec.ts
  // 229-236行で確認済み): 保留中アクションが無い単純なUNLOCKは、閉じずに
  // MANAGE画面へ遷移する。ここではその画面が出ること自体が「新しいパスワード
  // で解錠できた」ことの証明であり、閉じるところまでは追わない。
  await expect(page.getByTestId('private-manage-dialog')).toBeVisible()
})

test('recovery key: an existing vault (created before this feature) can set one up retroactively', async ({ page }) => {
  await seedDb(page, [...firstRunSuppressors(), ...seedOneBookmark()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const setupDialog = page.getByTestId('private-setup-dialog')
  await expect(setupDialog).toBeVisible()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()
  await expect(setupDialog).toHaveCount(0)
  // 自動生成された復旧キー画面を閉じる(既に検証済みなのでここでは深追いしない)。
  await expect(page.getByTestId('private-recovery-key-dialog')).toBeVisible()
  await page.getByTestId('private-recovery-key-done').click()

  // MANAGE画面を開き、「再発行」ボタンから新しい復旧キーを取得できることを確認。
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const manageDialog = page.getByTestId('private-manage-dialog')
  await expect(manageDialog).toBeVisible()
  await page.getByTestId('private-manage-recovery-key').click()
  const secondRecoveryDialog = page.getByTestId('private-recovery-key-dialog')
  await expect(secondRecoveryDialog).toBeVisible()
  const secondRecoveryKey = (await page.getByTestId('private-recovery-key-value').textContent())!.trim()
  expect(secondRecoveryKey.length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: テストを実行して成功を確認**(このタスクは新規テストのみで、実装は既に完了しているため「先に失敗を確認」は省略してよい — 全タスク完了後の統合検証という位置づけ)

Run: `npx playwright test tests/e2e/private-vault.spec.ts`
Expected: PASS(既存の全テスト + 新規2件)。

- [ ] **Step 3: 全体最終検証**

Run: `npx vitest run`
Expected: PASS、失敗0件。

Run: `npx tsc --noEmit`
Expected: 0エラー。

Run: `rtk pnpm build`
Expected: exit code 0。

- [ ] **Step 4: コミット**

```bash
rtk git add tests/e2e/private-vault.spec.ts
rtk git commit -m "test(private): add e2e coverage for the recovery-key setup and recovery flows"
```

---

## 完了後

全9タスク完了後、`superpowers:subagent-driven-development`スケルトンに従い、最終ブランチレビュー(最も高性能なモデル)を実施し、その後`superpowers:finishing-a-development-branch`でマージ/PR/保留の判断をユーザーに委ねる。
