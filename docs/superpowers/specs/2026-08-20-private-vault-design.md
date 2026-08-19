# Design — Private（合言葉/生体認証つきの秘密ブックマーク）

日付: 2026-08-20 / セッション 201
種別: **architectural spec**（新規サブシステム。データモデル・暗号化・ボード表示/検索/共有すべてに横断）。
関連: この会話で先に直した [functions/og/[id].ts](../../../functions/og/[id].ts) 系の SHARE 自動撮影バグ（`data-no-capture` 抜け）とは別件だが、本 spec の確認ダイアログ類も同じ `data-no-capture` 規約に従う。

---

## 1. 背景・目的

- ユーザー要望（原文要約）: 「Private」という特別なタグを1つだけ作れて、そのタグを開くには自分で決めたパスワード（対応端末なら指紋/顔も）が要る。ロック中は AllMarks の通常のブラウジングでは一切表示されない。シェアには基本乗らない（解錠中に選んだ時だけ、確認つきで許可）。
- 目的 = 「本当に人に見られたくないブックマーク」を、サーバーを一切使わず、この端末のブラウザ内だけで守れるようにする。既存の「サーバーに個人情報を持たない」方針・¥0設計と完全に両立する。
- 収益化はこの後の別 spec（`docs/private/IDEAS.md` に前提あり）。本 spec はその土台となる無料機能そのものの設計。

### 会話で確定した決定（背骨）

1. **鍵付きにできるのはタグ1つだけ**（「Private」という名の専用タグ。表示名は変更可、役割は `TagRecord.isPrivateVault` で固定）。汎用の「どのタグでも鍵をかけられる」機能は**採らない**（UIが複雑になるだけで暗号化エンジン側の難度は変わらないため）。
2. **本当に暗号化する**（見た目を隠すだけの UI ガードではない）。パスワードから鍵を作り、Private タグの付いたブックマークの中身（URL・タイトル・説明・サムネイル）を AES-GCM で暗号化して保存。認証を通らない限り復号できない。
3. **認証はパスワードが基本、生体認証（WebAuthn）は近道**。生体認証が使えない/壊れても、パスワードで必ず開ける。業界標準の Web Crypto API（PBKDF2 + AES-GCM）と WebAuthn をそのまま使う。自作の暗号は書かない。
4. **Private タグ＋普通のタグの併用可**（例: Private + 旅行）。ただし **Private タグ自体が絞り込みに含まれていない限り、旅行タグ単体では出てこない**（解錠中でも）。Private を明示的に踏んで初めて中身が見える設計を、普通のタグ（all/inbox/archive/dead 含む）にも一貫して適用する。
5. **共有(SHARE)は、ロック中は絶対に乗らない**（そもそも選べない）。**解錠中に選択に含まれていた場合だけ、確認ダイアログを挟んで許可**（「重複URLは確認してから許可」と同じ考え方）。
6. **EXPORT(端末バックアップ)には暗号化されたまま含める**。復元後も同じパスワードで開ける。生体認証の近道（端末専用の鍵）は端末に紐づくので引き継がれない＝新端末では最初はパスワードで開ける。
7. **再ロックはリロード/タブを閉じたら自動**。パスワードは実行中のメモリにしか置かない設計の自然な帰結（追加のタイマー実装が要らない）。
8. **入り口は SETTINGS の常設ボタン**。Private タグ自体は通常のタグ一覧・絞り込みUIには出ない（ロック中はもちろん、解錠前の一覧にも出ない）。
9. **忘れたときの救済は、本人が任意で設定する「ヒント文」のみ**。バックドアは作らない（サーバーに何も預けない方針と矛盾するため）。

---

## 2. スコープ全体像

**フェーズ1（今回作る）**: パスワードでのロック・本当の暗号化・共有からの確認つき除外・EXPORT/IMPORT対応。
**フェーズ2（公開後 fast-follow）**: WebAuthn 生体認証の近道。

| # | ピース | 種別 | 主なファイル |
|---|---|---|---|
| A | 暗号化コアモジュール（PBKDF2鍵導出 + AES-GCM暗号化/復号） | 新規 | `lib/private/crypto.ts` |
| B | Vault 設定の読み書き（settings ストア） | 新規 | `lib/private/vault-store.ts` |
| C | `TagRecord.isPrivateVault` / `BookmarkRecord.encryptedPayload` 追加 | スキーマ追加（バージョン変更なし） | `lib/storage/indexeddb.ts` |
| D | ボード読み込み時のロック除外＋解錠時の復号マージ | 変更 | `lib/storage/use-board-data.ts` |
| E | `applyFilter` の Private 封じ込めルール | 変更 | `lib/board/filter.ts` |
| F | SETTINGS の入り口ボタン + セットアップ/解錠ダイアログ | 新規 | `components/board/PrivateEntry.tsx`・`PrivateSetupDialog.tsx`・`PrivateUnlockDialog.tsx` |
| G | 新規ブックマーク保存時の暗号化フック（Private タグが付いていたら） | 変更 | 保存パス（`indexeddb.ts` の追加/更新系関数） |
| H | SHARE 経路の確認ダイアログ | 新規/変更 | `components/board/PrivateShareConfirmDialog.tsx` + `BoardRoot.tsx` の `handleCreateHostedShare`/`buildArrangeShare` 系 |
| I | EXPORT/IMPORT の Vault 設定行の含有確認 | 確認/微調整 | EXPORT/IMPORT パス |
| J | テスト一式 | 新規 | 各モジュールの `.test.ts`/`.test.tsx` + e2e |
| K（フェーズ2） | WebAuthn 登録・端末鍵ラップ・生体解錠 | 新規 | `lib/private/webauthn.ts` |

---

## 3. データモデル

### 3.1 `TagRecord` 追加フィールド（[indexeddb.ts:103](../../../lib/storage/indexeddb.ts#L103)）

```ts
export interface TagRecord {
  // ...既存フィールドはそのまま...
  /** v16+: true な行はアプリ内で常に高々1つ（Private タグ）。作成 UI は
   *  既存の行があれば新規作成の代わりに解錠フローへ誘導する（DB制約ではなく
   *  アプリ側の不変条件）。名前(name)は自由に変更可能 — 役割はこのフラグで
   *  決まる。 */
  isPrivateVault?: boolean
}
```

追加フィールドは optional なので **DB_VERSION（現在 16、[constants.ts:30](../../../lib/constants.ts#L30)）のバンプは不要**。既存行は単に未設定のまま読み書きできる（`dominantColor`/`onboardingDemo` と同じ増分パターン）。

### 3.2 `BookmarkRecord` 追加フィールド（[indexeddb.ts:17](../../../lib/storage/indexeddb.ts#L17)）

```ts
export interface BookmarkRecord {
  // ...既存フィールドはそのまま...
  /** v16+: Private タグが付いたブックマークだけが持つ。存在する間、
   *  title/url/description/thumbnail/favicon/siteName は空文字列で保存し、
   *  本当の値はここにしか存在しない。iv は暗号化ごとに新しい乱数（再利用禁止）。 */
  encryptedPayload?: {
    readonly iv: string          // base64、12 bytes（AES-GCM 推奨長）
    readonly ciphertext: string  // base64、AES-GCM 出力（認証タグ込み）
  }
}
```

平文カラムを空文字列で埋める理由: 型を `string | undefined` に緩めず既存コードの前提（`title: string` 等が常に文字列）を壊さない。IndexedDB を直接覗いても空文字列しか見えない。

### 3.3 Vault 設定行（`settings` ストア、[indexeddb.ts:357](../../../lib/storage/indexeddb.ts#L357) の既存ストアを再利用）

`loadBoardConfig`/`saveBoardConfig`（[board-config.ts](../../../lib/storage/board-config.ts)）と同じパターンで新規ファイル `lib/private/vault-store.ts` を作る。

```ts
const VAULT_KEY = 'private-vault'

export type PrivateVaultRecord = {
  readonly key: 'private-vault'
  readonly tagId: string            // Private タグの TagRecord.id
  readonly salt: string             // base64、PBKDF2 用（16 bytes 乱数）
  readonly iterations: number       // 作成時点の OWASP 推奨値を記録（将来の反復回数引き上げに追従できる）
  readonly checkIv: string          // base64
  readonly checkCiphertext: string  // 既知の平文（例 "ok"）を暗号化した確認用ブロブ。
                                     // 復号できれば = パスワード正解（GCM の認証タグが検証を兼ねる）
  readonly hint?: string            // 本人が任意設定。平文のまま保存（そもそも秘密にする対象ではない）
  // フェーズ2で追加:
  readonly webauthnCredentialId?: string
  readonly webauthnPublicKey?: string
  readonly wrappedKeyIv?: string
  readonly wrappedKeyCiphertext?: string
}
```

こちらも既存ストアの再利用のみで **スキーマ変更なし**。

---

## 4. 暗号化コア（`lib/private/crypto.ts`）— 自作暗号なしの Web Crypto 標準呼び出しだけ

```ts
// PBKDF2-SHA256 でパスワード→鍵。反復回数は OWASP Password Storage Cheat Sheet
// (2023) の PBKDF2-SHA256 推奨値 600,000 に合わせる。
export async function deriveKey(password: string, saltB64: string, iterations: number): Promise<CryptoKey>

// AES-256-GCM で任意の文字列(JSON化済み)を暗号化。IV は毎回 crypto.getRandomValues で生成。
export async function encryptJson(key: CryptoKey, data: unknown): Promise<{ iv: string; ciphertext: string }>

// 復号。GCM の認証タグ検証に失敗する(=パスワード違い/改ざん)と例外を投げる —
// 呼び出し側は try/catch で「パスワードが違います」に丸める。復号「成功したのに中身がおかしい」は起きない
// (GCM は認証付き暗号なので改ざん検知込み)。
export async function decryptJson<T>(key: CryptoKey, iv: string, ciphertext: string): Promise<T>
```

- 依存ライブラリ追加なし（ブラウザ内蔵 `crypto.subtle` のみ）。バンドルサイズ・実行コストへの影響は実質ゼロ。
- パスワード自体はどこにも保存しない。検証は「確認用ブロブが復号(=GCM認証)できるか」だけで行う。

---

## 5. ロック/解錠のライフサイクル

### 5.1 セットアップ（初回、Private タグがまだ存在しない）

1. SETTINGS の「🔒 PRIVATE」ボタン → `PrivateSetupDialog`
2. パスワード（+確認入力）＋任意のヒント文を入力
3. `salt` を乱数生成 → `deriveKey` → 既知平文を暗号化して `checkIv`/`checkCiphertext` を作る
4. `TagRecord`（`isPrivateVault: true`, `name: 'Private'`）を作成 → `PrivateVaultRecord` を保存
5. 導出した鍵はその場でメモリ（React state, BoardRoot 内）に保持 = このセッションはもう解錠済み

### 5.2 解錠（2回目以降）

1. SETTINGS の「🔒 PRIVATE」→ 既に Vault 行があるので `PrivateUnlockDialog`
2. パスワード入力 → `deriveKey` → `checkCiphertext` の復号を試す
3. 成功 = 鍵をメモリに保持、失敗 = 「パスワードが違います」+ ヒント文があれば表示
4. 解錠したら、Private タグの付いた各 `BookmarkRecord` の `encryptedPayload` をこの鍵で復号し、`use-board-data.ts` の `items` にマージ（下記 §6）

### 5.3 再ロック

- 明示的な「ロックし直す」操作は作らない（§1 決定7）。**ページのリロード/タブを閉じる = 鍵がメモリから消える = 自動的に再ロック**。実装としては「鍵は React state 以外のどこにも書かない」を守るだけで自然に成立する。

---

## 6. ボード表示・検索からの封じ込め

### 6.1 読み込み時の除外（[use-board-data.ts:282](../../../lib/storage/use-board-data.ts#L282)）

`getAllBookmarks` の結果から `BoardItem[]` を組み立てる箇所で:
- Private タグ未作成 or ロック中 → Private タグの `id` を含む `tags` のブックマークは `items` に一切含めない（配列除外。存在しないのと同じ扱い）
- 解錠中 → 該当ブックマークも含めるが、`title`/`url`/`description`/`thumbnail` は `encryptedPayload` を復号した値で上書きしてから `items` に入れる

**Private タグ自体（行そのもの）もロック中は非表示**。対象は絞り込み用の `FilterPill` 一覧だけでなく、ブックマークにタグを付ける `TagPicker` や、タグの管理・並び替え画面など、タグを列挙する UI 全て。実装的には「タグ一覧を組み立てる箇所すべてで `isPrivateVault: true` の行をロック中は除外する」共通ヘルパーを1つ作り、各画面がそれを通す（除外漏れを1箇所のバグで防ぐ）。

### 6.2 絞り込みロジックの封じ込めルール（[filter.ts:4](../../../lib/board/filter.ts#L4)）

`applyFilter` に「Private タグを積んだアイテムは、アクティブな絞り込みが明示的に Private タグ id を含んでいない限り結果に出さない」ガードを追加する。対象は `'tags'` ケースだけでなく **`'all'`/`'inbox'`/`'archive'`/`'dead'` も含む全ケース**（解錠中でも、Private を踏まない限り普段のブラウジングには一切混ざらない、という一貫した挙動にするため）。

```ts
function isPrivateGated(it: BoardItem, privateTagId: string | null, filter: BoardFilter): boolean {
  if (privateTagId === null) return false
  if (!it.tags.includes(privateTagId)) return false
  return !(filter.kind === 'tags' && filter.tagIds.includes(privateTagId))
}
```

`applyFilter` の呼び出し側（`BoardRoot.tsx`）が `privateTagId` を渡すシグネチャ変更が必要（既存呼び出し元は全て洗い出して更新）。

---

## 7. 保存時の暗号化フック

新規ブックマーク保存時、またはタグ付け操作で Private タグが付与された時に、平文フィールドを暗号化して `encryptedPayload` に移す（逆に Private タグを外したら復号して平文に戻す）処理を追加する。対象:
- `lib/storage/indexeddb.ts` の追加・更新系関数（`addBookmark` 系、タグ付け更新の関数 — 実装時に既存呼び出し箇所を洗い出す）
- ロック中は Private タグを新規に付与する操作自体ができない（そもそも解錠していないと Private タグが選択肢に出ない = §6.1 の除外と表裏一体）

---

## 8. SHARE 経路: ロック中は不可能、解錠中は確認つきで許可

- **ロック中**: §6.1 の除外により Private アイテムはそもそも `items` に存在しない → `handleCreateHostedShare`／`buildArrangeShare`（[BoardRoot.tsx:2551](../../../components/board/BoardRoot.tsx#L2551), [:2599](../../../components/board/BoardRoot.tsx#L2599)）が触れる選択候補に混ざりようがない。追加コード不要、既存の除外だけで保証される。
- **解錠中に選択に含まれていた場合**: `handleCreateHostedShare` の冒頭で `selectedInBoardOrder(items, selectedIds).some(it => it.tags.includes(privateTagId))` を確認 → true なら `PrivateShareConfirmDialog`（[TrashConfirmDialog.tsx](../../../components/board/TrashConfirmDialog.tsx) と同じ backdrop+panel+role="dialog" 構成、ホールド不要の単純 CANCEL/SHARE）を先に出し、SHARE を押されるまで実際の撮影・アップロードには進まない。
- この確認ダイアログ自身も `data-no-capture` を付ける（今回のバグ修正と同じ理由 — 万一表示順が前後しても撮影に写り込ませない、defense-in-depth）。

---

## 9. EXPORT / IMPORT

- EXPORT は既存の「IDB を丸ごとシリアライズ」方式のはずなので、`bookmarks`（`encryptedPayload` 込み）と `tags`（`isPrivateVault` 込み）、`settings` の `private-vault` 行がそのまま含まれることを実装時に確認する（除外ロジックを足す必要はない — 中身が既に暗号化済みだから安全に含めてよい、が§1決定6）。
- IMPORT 後、同じパスワードで `PrivateVaultRecord` の `checkCiphertext` が復号できることを確認する回帰テストを書く。
- `webauthnCredentialId`/`wrappedKey*`（フェーズ2）は **意図的に「持ち越しても無意味」**（端末のセキュアな鍵に紐づくため）。新端末では初回は必ずパスワード解錠になる — この制約を実装時にコメントとして明記する。

---

## 10. フェーズ2: WebAuthn 生体認証の近道（設計のみ、実装は fast-follow）

1. 初回パスワード解錠に成功した後、「この端末の指紋/顔認証を使えるようにする」を任意で提示
2. 端末専用の AES 鍵を `crypto.subtle.generateKey({ extractable: false })` で作り、`IndexedDB` に直接保存（非 extractable な `CryptoKey` はブラウザが structured-clone で保存できる）
3. `navigator.credentials.create()` で WebAuthn のプラットフォーム認証（`authenticatorAttachment: 'platform'`, `userVerification: 'required'`）を登録。relying party はこのアプリ自身のドメイン、サーバー往復なし
4. パスワードから導出した Vault 鍵を、上記の端末専用鍵で「包んで」(wrap) 保存
5. 解錠時、`navigator.credentials.get()` の返す署名を保存済み公開鍵で `crypto.subtle.verify` を使い**アプリ側で検証**（ここを飛ばすと「生体認証成功したフリ」を悪意あるスクリプトに偽装され得るため必須）。検証成功したら端末鍵で Vault 鍵を unwrap。
6. 生体認証が使えない/失敗した場合は常にパスワード入力にフォールバック。データ消失は起きない。
7. iPhone は Face ID・Touch ID どちらも WebAuthn 経由で同じ実装で動く（iOS 14+ Safari）。ホーム画面追加(PWA)状態での挙動は実機確認が必要（フェーズ2着手時に実機で確認）。

---

## 11. テスト方針

- **単体**: `crypto.ts` の暗号化→復号ラウンドトリップ／誤ったパスワードでの復号失敗が例外として捕捉されクラッシュしないこと
- **単体**: `applyFilter` — Private タグ付きアイテムが `'all'`/他タグ単体/`'inbox'` 等では出ず、Private タグを含む絞り込みでのみ出ること
- **単体**: `use-board-data.ts` のロード — ロック中は Private アイテムが `items` に一切現れないこと（配列 length で確認）
- **単体**: SHARE 確認ロジック — 選択に Private アイテムを含む/含まないでダイアログ要否が切り替わること。ロック中は選択肢自体に現れないので確認不要ケースも回帰カバー
- **単体**: `PrivateSetupDialog`/`PrivateUnlockDialog`/`PrivateShareConfirmDialog` が `data-no-capture` を持つこと（今回の `BackupReminder`/`DataHomeCard` 回帰テストと同じパターン）
- **単体**: EXPORT→IMPORT 後も同じパスワードで解錠できること
- **e2e (Playwright)**: Private 作成 → ブックマーク追加 → リロードで消える → パスワードで解錠 → Private 絞り込みでのみ現れる → SHARE 選択に含めると確認ダイアログが出る → キャンセルで共有に含まれないこと
- **実機（非自動化・フェーズ2）**: 実際の iPhone で Face ID/Touch ID 解錠を確認（ユーザー自身が実施、[feedback_user_self_verifies_visuals] の方針どおり）

---

## 12. 未確定の小さな点（実装時にその場で決めてよいレベル）

- SETTINGS ボタンの正式な英語ラベル文言（暫定 "PRIVATE"、既存の TUNE/SHARE/SETTINGS と同じ全大文字英語の慣習に合わせる）
- Vault 鍵のメモリ保持場所（BoardRoot の React state か、専用の小さな context か）— 実装時にコード構造を見て決める
- PBKDF2 反復回数の具体的な初期値（600,000 を軸に、実機での体感待ち時間を見て微調整）

---

## 13. 影響を受けないもの（変更なし）

- 既存のタグ・ブックマークのスキーマ・IDB バージョン（追加フィールドのみ、マイグレーション不要）
- 既存の共有(SHARE)の通常フロー（Private が絡まない限り一切変更なし）
- コスト構造（新規サーバー・有料サービス・追加ライブラリなし、Web Crypto/WebAuthn ともにブラウザ内蔵で¥0）
