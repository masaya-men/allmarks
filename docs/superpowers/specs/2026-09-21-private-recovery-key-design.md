# Design — Private の復旧キー(パスワードを忘れた場合の復旧手段)

日付: 2026-09-21 / セッション 216
種別: **architectural spec**(既存のPrivate機能の暗号モデルに、新しい「解錠手段」を1つ追加する。データモデル・暗号設計・複数画面に横断)。
関連: `docs/superpowers/specs/2026-08-20-private-vault-design.md`(Private本体)、`docs/superpowers/plans/2026-09-16-device-sync-bundle-6c-vault-conflict.md`(vault食い違い解決フロー — 本設計と同じ`PrivateChangePasswordDialog`の`variant`機構を再利用する)。

---

## 1. 背景・目的

端末間同期の束6③の最終レビューで発見された「I-5」の一部(`docs/CURRENT_GOAL.md`参照)。まとめ先のパスワードが本当に失われていた場合、両端末のPrivateが永久に読めなくなるという弱点があり、ユーザーから「パスワード復旧手段は必ず必要」と明示的な指示を受けて着手する。

**この問題はvault食い違い機能固有ではない**: Private機能自体が最初から持っている前提で、vault食い違いが無くても今日から既に真(パスワードを忘れて、どの端末も解錠済みでない場合、復旧手段はヒント文だけ)。今回の設計は、Private機能全体に対して恒久的な復旧手段を追加する。

**Private機能は既に本番で使われている** — 既存のvaultを持つユーザーがいる。新しい仕組みは、新規に作るvaultだけでなく、既存vaultにも後から追加できる必要がある(ユーザー承認済み)。

## 2. 会話で確定した決定

1. **復旧キー方式**(ユーザー承認済み)。セットアップ時に一度だけ表示されるランダムな文字列を、ユーザー自身が紙やパスワードマネージャーに保存する。1Passwordの「Emergency Kit」に近い形。このアプリはサーバーにユーザーデータを持たないため、サーバー経由の再発行のような方式は採らない。
2. **既存vaultにも導入する**(ユーザー承認済み)。新規作成時は自動で発行、既存vaultは解錠済みの状態から後付けで発行できる。
3. **新しい暗号方式は増やさない**。既存の`lib/private/crypto.ts`の`deriveKey`/`wrapPrivateKey`/`unwrapPrivateKey`(PBKDF2-SHA256 600,000回 → AES-256-GCM)をそのまま再利用する。復旧キーは「もう一つのパスワード」として同じ関数に通すだけ。
4. **復旧キーは使い切りにしない**。1Passwordの Account Key と同様、一度発行したら(明示的に再発行しない限り)使い回せる。秘密鍵の実体そのものは変わらないため、パスワード変更後も復旧キーは有効なまま。
5. **文言(実際の日本語・英語の文面)は実装前に必ず提示して確認を取る**(このプロジェクトの既存ルール)。本specでは文言そのものは決めず、必要なi18nキーの一覧とその意味だけを定義する。

### 触れるファイル一覧

| # | ファイル | 種別 |
|---|---|---|
| A | `lib/private/crypto.ts` | 変更(`generateRecoveryKey`/`normalizeRecoveryKey`追加) |
| B | `lib/private/vault-store.ts` | 変更(`PrivateVaultRecord`に2項目追加・`resolveOwnPkcs8`新設・`changeVaultPassword`変更・`setUpRecoveryKey`/`unlockVaultWithRecoveryKey`新設。`createVault`は無変更) |
| C | `components/board/PrivateRecoveryKeyDialog.tsx`(+css+test) | 新規 |
| D | `components/board/PrivateRecoverDialog.tsx`(+css+test) | 新規 |
| E | `components/board/PrivateUnlockDialog.tsx`(+test) | 変更(「パスワードを忘れた場合」リンク追加) |
| F | `components/board/PrivateManageDialog.tsx`(+test) | 変更(復旧キー設定/再発行ボタン追加) |
| G | `components/board/PrivateChangePasswordDialog.tsx`(+test) | 変更(`variant`に`'recovered'`追加) |
| H | `components/board/BoardRoot.tsx` | 変更(状態・配線) |
| I | `messages/*.json`(15言語) | 変更(新規i18nキー、文言は実装前に確認) |
| J | `lib/private/crypto.test.ts`/`vault-store.test.ts`/`tests/e2e/private-vault.spec.ts` | 変更(テスト追加) |

## 3. データモデル変更

`lib/private/vault-store.ts`の`PrivateVaultRecord`([lib/private/vault-store.ts:13](../../../lib/private/vault-store.ts#L13))に、**任意項目**(optional)を2つ追加する:

```ts
export type PrivateVaultRecord = {
  readonly key: 'private-vault'
  readonly tagId: string
  readonly salt: string
  readonly iterations: number
  readonly publicKey: string
  readonly wrappedPrivateKey: { readonly iv: string; readonly ciphertext: string }
  readonly hint?: string
  readonly updatedAt?: number
  // ↓ 今回追加(任意項目 — 既存レコードには存在しない = 「復旧キー未設定」の意味)
  /** 復旧キー用のPBKDF2 salt。wrappedPrivateKeyByRecoveryKeyと対で存在する。 */
  readonly recoverySalt?: string
  /** ECDH秘密鍵(pkcs8)の、復旧キー由来の鍵で暗号化したコピー。password用の
   *  wrappedPrivateKeyとは完全に独立した、もう一つの暗号化コピー。 */
  readonly wrappedPrivateKeyByRecoveryKey?: { readonly iv: string; readonly ciphertext: string }
}
```

任意項目なので、既存の(復旧キーを持たない)vaultレコードは無傷。`lib/sync/merge.ts`の`mergeVault`([lib/sync/merge.ts:236](../../../lib/sync/merge.ts#L236))はレコード全体をLWW(最終更新時刻が新しい方を採用)で扱うため、この2項目も既存の`hint`/`wrappedPrivateKey`と同じように、通常の同期でそのまま端末間に伝わる。**同期のための新しいコードは不要**。

## 4. 復旧キーの生成・エンコード方式(`lib/private/crypto.ts`への追加)

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

**なぜこの形か**: 復旧キーは「もう一つのパスワード」として`deriveKey`にそのまま渡す(新しい暗号処理は書かない)。ただし人間が紙に書いて後で正確に打ち直せる必要があるため、①読み間違えやすい文字を除く、②ハイフンで区切って視認性を上げる、③再入力時の表記ゆれ(大文字/小文字・ハイフンの有無・余分な空白)を吸収する正規化関数を用意する。

## 5. `lib/private/vault-store.ts`の変更・新設

### 5.1 内部ヘルパー(新設・非公開)

```ts
/** session.wrappingKeyが実際にどちらの暗号化コピーを開けるかを気にせず、
 *  生のpkcs8バイト列を復元する。session.privateKey自体は
 *  extractable:falseでインポートされているため再書き出し不可能
 *  ([lib/private/crypto.ts:112](../../../lib/private/crypto.ts#L112)の
 *  unwrapPrivateKeyの4番目の引数)— 保存済みの暗号化コピーを再度復号する
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

### 5.2 `createVault`は**変更しない**(重要な設計判断)

`createVault`の呼び出し箇所は現在リポジトリ全体で23箇所ある(`components/board/BoardRoot.tsx`1箇所+テストファイル4本・22箇所)。シグネチャや戻り値を変えると全箇所に影響するため、**`createVault`自体には復旧キー生成を組み込まない**。代わりに、下記5.3の`setUpRecoveryKey`を「新規vault作成の直後」と「既存vaultへの後付け」の両方で同じように呼ぶ設計にする(5.4参照)。これにより既存の23箇所は無傷。

### 5.3 `setUpRecoveryKey`(新設・公開)

```ts
/** すでに解錠済みのsessionから、新しい復旧キーを1つ生成して保存する。
 *  既存の復旧キーがあれば無条件に上書きする(=再発行)ため、「初めて
 *  設定する」と「前のキーを失くしたので作り直す」の両方をこの1つの
 *  関数でカバーする。呼び出し元は新規vault作成の直後、または既存vaultの
 *  管理画面から呼ぶ。返り値は表示用の復旧キー文字列そのもの — この関数の
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
```

### 5.4 `unlockVaultWithRecoveryKey`(新設・公開)

```ts
/** 復旧キーでの解錠を試みる。unlockVault([lib/private/vault-store.ts:73]
 *  (../../../lib/private/vault-store.ts#L73))のパスワード版と対になる —
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

返ってきた`session.wrappingKey`は「復旧キー由来の包み鍵」になる。これは既存の`PrivateVaultSession`型([lib/private/vault-session.ts:18](../../../lib/private/vault-session.ts#L18))をそのまま使う — 型に変更は不要(パスワード由来か復旧キー由来かをsession自体は区別しない。区別が必要な唯一の箇所は5.5の`resolveOwnPkcs8`で、それも「まずパスワード用を試す」だけで自然に吸収される)。

### 5.5 `changeVaultPassword`の変更

現在の実装([lib/private/vault-store.ts:104](../../../lib/private/vault-store.ts#L104))は`session.wrappingKey`で`record.wrappedPrivateKey`を直接復号している。これを5.1の`resolveOwnPkcs8`呼び出しに置き換える(呼び出し元・返り値の型・パスワード変更の挙動そのものは無変更):

```ts
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
    pkcs8 = await resolveOwnPkcs8(record, session)
  } catch {
    return { ok: false }
  }
  // ここから下(newSalt生成・再ラップ・db.put)は変更なし
  ...
}
```

この変更により、「復旧キーで解錠 → 新しいパスワードを1つ決める」という流れが、既存の`changeVaultPassword`をそのまま(無変更で)使えるようになる。束6③の「vault-conflict-resolved」画面が全く同じ関数を再利用しているのと同じ考え方。

## 6. UI設計

### 6.1 新規: `PrivateRecoveryKeyDialog.tsx`(復旧キーを1回だけ表示する画面)

`PrivateShareConfirmDialog.tsx`と同じbackdrop/panel/heading/body/actionsの型を踏襲。

```ts
type Props = {
  readonly recoveryKey: string
  readonly onDone: () => void
}
```

- 見出し・本文(文言は7章で後日確定)
- 復旧キーそのものを、等幅フォントで読みやすく表示(読み取り専用)
- 「コピー」ボタン — `navigator.clipboard.writeText`(既存パターン、[components/board/BoardRoot.tsx:3064](../../../components/board/BoardRoot.tsx#L3064)と同じtry/catch)
- 「わかった」的な単一ボタンで閉じる(再確認の入力は求めない — このアプリの「最小の手間」原則に合わせる)
- Escapeキー・背景クリックでも同じ`onDone`で閉じる(他のPrivate系ダイアログと同じ挙動に揃える — 「見た」ことの確認は単純な既読扱いであり、閉じ方を制限しても保存を強制することにはならないため、例外を設けない)

### 6.2 新規: `PrivateRecoverDialog.tsx`(復旧キーを入力する画面)

```ts
type Props = {
  readonly onSubmit: (recoveryKeyInput: string) => Promise<boolean>
  readonly onCancel: () => void
}
```

- 復旧キーの入力欄は**マスクしない、通常のテキスト入力**(パスワード欄とは違い、長い文字列を正確に転記する場面なので視認性を優先する — `PrivateSetupDialog`のヒント欄と同じ`<input type="text">`パターン)
- 送信ボタン・キャンセルボタン(既存の他の画面と同じ配置)
- 失敗時のエラー表示(既存の「パスワードが違います」と同じパターン)

### 6.3 `PrivateUnlockDialog.tsx`の変更

新しいprop `onForgotPassword: () => void` を追加し、「パスワードを忘れた場合」的なリンクをアクション部に追加する。**このリンクは復旧キーが設定されている場合のみ表示**(新しいprop `hasRecoveryKey: boolean`で制御) — 復旧キー未設定の古いvaultで、押しても必ず失敗するリンクを見せないため。

### 6.4 `PrivateManageDialog.tsx`の変更

新しいprop `hasRecoveryKey: boolean` と `onSetUpRecoveryKey: () => void` を追加する。

- `hasRecoveryKey`が`false`の場合: 「復旧キーがまだありません。今すぐ作成」というボタン/案内を表示。
- `hasRecoveryKey`が`true`の場合: 「復旧キーを再発行」的な、控えめな(強制ではない)導線を表示。
- どちらも押すと`onSetUpRecoveryKey`を呼ぶ — `BoardRoot.tsx`側で`setUpRecoveryKey(db, session)`を呼び、結果を`PrivateRecoveryKeyDialog`で表示する(6.1と同じ画面を再利用)。

### 6.5 `PrivateChangePasswordDialog.tsx`の変更

`variant`の型を拡張: `'change' | 'vault-conflict-resolved' | 'recovered'`。`'recovered'`の場合の見出し・本文用に新しいi18nキーを2つ追加(7章)。既存の`'change'`/`'vault-conflict-resolved'`の挙動は無変更。

### 6.6 `BoardRoot.tsx`の状態遷移まとめ

`privateDialog`のunion型([components/board/BoardRoot.tsx:263](../../../components/board/BoardRoot.tsx#L263))に3つ追加:
```ts
'recovery-key' | 'recover' | 'recovered'
```

新しいstate:
```ts
const [privateHasRecoveryKey, setPrivateHasRecoveryKey] = useState(false)
const [pendingRecoveryKeyDisplay, setPendingRecoveryKeyDisplay] = useState<string | null>(null)
```

`privateHint`が読み込まれている既存の2箇所([components/board/BoardRoot.tsx:2180](../../../components/board/BoardRoot.tsx#L2180)と[:3666](../../../components/board/BoardRoot.tsx#L3666))で、同時に`setPrivateHasRecoveryKey(!!record.wrappedPrivateKeyByRecoveryKey)`も呼ぶ。

**新規vault作成フロー**([components/board/BoardRoot.tsx:4081](../../../components/board/BoardRoot.tsx#L4081)の`onCreate`)の変更: `createVault`成功直後、`setUpRecoveryKey(db, session)`を呼んで復旧キーを取得し、`setPendingRecoveryKeyDisplay(recoveryKey)` → `setPrivateDialog('recovery-key')`(従来の`setPrivateDialog(null)`の代わり)。`pendingPrivateAction`の再開処理(`runPrivateAction`)はこれまでと同じタイミングで即時実行する(復旧キー画面の表示とは並行、待たせない)。

**既存vaultへの後付け**(`PrivateManageDialog`の新ボタン): `setUpRecoveryKey(db, privateSession)` → 同じく`pendingRecoveryKeyDisplay`+`'recovery-key'`。

**`'recovery-key'`画面のonDone**: `setPendingRecoveryKeyDisplay(null)` → `setPrivateDialog(null)`。

**パスワードを忘れた場合**(`PrivateUnlockDialog`の`onForgotPassword`): `setPrivateDialog('recover')`。

**`'recover'`画面のonSubmit**: `unlockVaultWithRecoveryKey(db, input)` → 成功なら`setPrivateVaultSession(session)` → `setPrivateDialog('recovered')`。失敗なら`false`を返す(既存のエラー表示パターン)。

**`'recovered'`画面**(`PrivateChangePasswordDialog` variant="recovered"): `onSubmit`は`changeVaultPassword(db, privateSession, newPassword, newHint)`を呼ぶだけ — vault食い違い解決フローの`'vault-conflict-resolved'`画面([components/board/BoardRoot.tsx:4223](../../../components/board/BoardRoot.tsx#L4223)付近)とほぼ同じ配線だが、`loadVaultConflict`/`clearVaultConflict`の呼び出しは無い(無関係な機能のため)。

**既存コメントの更新が必要な箇所**: [components/board/BoardRoot.tsx:2173-2176](../../../components/board/BoardRoot.tsx#L2173-L2176)の「ヒントがこの機能の唯一の復旧手段」というコメントは、この設計の実装後は事実と異なるため、書き換えが必要。

## 7. 文言(i18n) — 未確定、実装前に必ず提示して確認

新しく必要なi18nキー一覧(意味だけ定義。実際の日本語・英語の文面はタスク着手時に提示):

- `private.recoveryKeyHeading` / `private.recoveryKeyBody` / `private.recoveryKeyCopyButton` / `private.recoveryKeyCopiedFeedback` / `private.recoveryKeyDoneButton`(6.1の画面)
- `private.recoverHeading` / `private.recoverExplanation` / `private.recoverInputLabel` / `private.errorWrongRecoveryKey`(6.2の画面)
- `private.forgotPasswordLink`(6.3のリンク文言)
- `private.setUpRecoveryKeyButton` / `private.regenerateRecoveryKeyButton` / `private.noRecoveryKeyYetNote`(6.4のボタン/案内文)
- `private.recoveredHeading` / `private.recoveredBody`(6.5の新variant)

15言語ぶんの追加は既存の確立済みパターン(en/jaは実文言、他13言語は英語のプレースホルダー)に従う。

## 8. 同期との関係

3章で述べた通り、新しい2フィールドは既存の`PrivateVaultRecord`の一部として、既存の同期の仕組み(vault.json経由)にそのまま乗る。新しい同期コードは不要。vault食い違い解決フロー(`lib/private/vault-conflict.ts`)への影響もない — `mergeIntoOtherVault`が最終的に採用する側の`otherRecord`に復旧キー関連フィールドが含まれていれば、そのまま引き継がれる(再暗号化の対象はブックマークのみで、vaultレコード自体はそのままコピーされるため)。

## 9. テスト方針

- `lib/private/crypto.test.ts`: `generateRecoveryKey`(文字種・長さ・ハイフン位置)、`normalizeRecoveryKey`(大文字化・ハイフン除去・冪等性)の単体テスト。
- `lib/private/vault-store.test.ts`: `setUpRecoveryKey`(新規発行・再発行での上書き)、`unlockVaultWithRecoveryKey`(正しい復旧キーで解錠・間違った復旧キーでnull・復旧キー未設定でnull)、`changeVaultPassword`が復旧キー由来のsessionでも動くこと(`resolveOwnPkcs8`のフォールバック経路)の単体テスト。
- 既存の23箇所の`createVault`呼び出しは無傷であることをフルスイートで確認(5.2の設計判断の検証)。
- コンポーネントテスト: `PrivateRecoveryKeyDialog`(コピー機能・onDoneの発火)、`PrivateRecoverDialog`(送信・エラー表示)。
- e2e(`tests/e2e/private-vault.spec.ts`に追加): 新規vault作成→復旧キー画面が出る→「パスワードを忘れた」→復旧キーで解錠→新しいパスワードを設定→リロード→新しいパスワードで解錠できる、という一連の流れ。既存vault(復旧キー未設定)への後付けフローも別途1本。

## 10. スコープ外(今回やらないこと)

- 生体認証(WebAuthn)経由の復旧 — フェーズ2として別途検討する話で、今回とは無関係。
- 復旧キーの有効期限・失効・単一使用制限 — 2章の決定通り、使い切りにしない。
- サーバー経由の再発行・メールでの送付 — このアプリはサーバーにユーザーデータを持たない方針のため、対象外。
- 3台以上の端末が絡む複雑なvault食い違いシナリオでの復旧キーの扱い — 既存のvault食い違い解決フロー自体が2台構成を前提にしている(`docs/CURRENT_GOAL.md`のI-3参照)ため、本specもそれに合わせて2台構成を前提とする。
