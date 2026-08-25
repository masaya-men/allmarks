# Design — Private Phase 2 ②クイック保存面対応 + 公開鍵暗号への移行

日付: 2026-08-25 / セッション 204
種別: **architectural spec**（`lib/private/`の暗号コアの方式変更＋それに依存する既存3表面〈FilterPill・カード＋ボタン・MANAGE TAGS〉の挙動遡及変更＋新規3表面〈拡張機能保存iframe・ブックマークレットpopup・PopOut〉への配線）。
前提: [Private vault Phase 1 design](2026-08-20-private-vault-design.md)（実装済）と [Private Phase 2 ①③ design](2026-08-24-private-phase2-discovery-and-batch-design.md)（実装済・`master`にmerge済）の上に乗る。両方のUI層（ダイアログの出し分け・常時表示の配置）はほぼそのまま再利用し、**暗号コアと「ロック中にタグ付けできるか」のルールだけを変更する**。
対象外（別セッション）: ④存在を隠すオプション。詳細は `docs/private/IDEAS.md`「s202 Private Phase 2構想まとめ」。

---

## 1. 背景・決定した方向性

s202で②(クイック保存面対応)は「鍵をpostMessage/BroadcastChannelで別ウィンドウに安全に転送する」案(IDEAS.mdの案B)を想定していた。s204のbrainstormingで以下が判明・確定した。

1. **前提の訂正**: PopOut(PiP)は`documentPictureInPicture`が返す別`Window`にDOMだけを`createPortal`で転送しているだけで、実装上はメインタブと**同一のReactツリー・同一のJSモジュールインスタンス**（[lib/board/pip-window.ts:61-65](../../../lib/board/pip-window.ts#L61-L65), [components/pip/PipPortal.tsx:13](../../../components/pip/PipPortal.tsx#L13)）。`lib/private/vault-session.ts`のモジュール変数はPopOut側からもそのまま同じ値が見える。鍵の転送は不要。
2. **より本質的な指摘**: ユーザーから「Privateタグを付けること自体にパスワードは要らないはず、見る時だけ要ればいい」という指摘。現状の実装（[BoardRoot.tsx:2120-2144](../../../components/board/BoardRoot.tsx#L2120-L2144) `handlePrivateEntry`）はロック中のタグ付けに解錠ダイアログを要求しており、これは今の**対称鍵暗号**（1本の鍵が暗号化・復号の両方に要る）の構造上の制約による。**公開鍵暗号(ECDH)に切り替えれば、暗号化(タグを付ける)は鍵ペアの公開鍵だけで、パスワードなしでどこからでも実行できる。復号(タグを外す/中身を見る)だけがパスワード派生の秘密鍵を要る**、という非対称な設計にできる。
3. これにより ②(3新規表面) が抱えていた「鍵をどう安全に別ウィンドウへ運ぶか」という設計課題自体が消える。公開鍵は秘密ではないので、そもそも安全に運ぶ必要がない。3新規表面はいずれもIndexedDBに直接アクセスできる（拡張機能の保存iframe・ブックマークレットpopupは実ナビゲーションだが同一オリジン`allmarks.app`、PopOutは同一JSレルム）ので、公開鍵をIndexedDBから直接読めばよい。
4. **既に本番稼働中の①③の挙動も遡及して変える**。「Privateタグを付ける」操作はメインボードの3箇所（FilterPill・カード＋ボタン・MANAGE TAGS）でも今後ロック中に即実行できるようになる。同じタグなのに置き場所によってパスワードの要不要が変わるのは一貫性を欠くため、ユーザー承認の上で統一する。
5. 移行対象データなし: 本番のPrivateタグ付きブックマークはユーザーが本セッション前に全てタグを外した。実データ移行コードは不要、レコード形式を作り直すだけでよい。
6. ついでに「🔒 Private」の表記統一（アイコンとラベルの間隔を詰める・アイコンを1箇所の定数にして差し替えやすくする）も本スコープに含める。

---

## 2. 鍵の構造の変更（`lib/private/crypto.ts` + `lib/private/vault-store.ts`）

### 2.1 `PrivateVaultRecord`の形状変更

| フィールド | Before (Phase 1) | After (本spec) |
|---|---|---|
| `salt` / `iterations` | PBKDF2用、変更なし | 変更なし（秘密鍵を"包む"鍵の導出に使う） |
| `checkIv` / `checkCiphertext` | パスワード確認用のダミー暗号文 | **削除**。秘密鍵の包みを開ける成否がそのままパスワード確認を兼ねる |
| `publicKey` | (なし) | **新規**。ECDH(P-256)公開鍵、raw/base64、平文保存（秘密でないため問題なし） |
| `wrappedPrivateKey` | (なし) | **新規**。ECDH秘密鍵(pkcs8/base64)を、PBKDF2派生鍵で`encryptJson`したもの＝`{iv, ciphertext}` |
| `tagId` / `hint` | 変更なし | 変更なし |

EXPORT/IMPORT（[lib/storage/backup.ts](../../../lib/storage/backup.ts)）は`settings`ストアを丸ごとダンプ/復元する汎用実装で、レコードの中身を個別に扱っていない（確認済み）ので、この形状変更に伴う追加対応は不要。

### 2.2 `crypto.ts`に追加する関数

- `generateEcdhKeyPair(): Promise<CryptoKeyPair>` — `crypto.subtle.generateKey({name:'ECDH', namedCurve:'P-256'}, true, ['deriveKey','deriveBits'])`。setup時のみ使い、export後は捨てる。
- `exportPublicKeyB64(key: CryptoKey): Promise<string>` / `importPublicKey(b64: string): Promise<CryptoKey>` — raw/spki形式。
- `wrapPrivateKey(key: CryptoKey, wrappingKey: CryptoKey): Promise<{iv, ciphertext}>` — 秘密鍵をpkcs8でexportし、既存の`encryptJson(wrappingKey, {pkcs8: base64})`で包む（新しい低レベル暗号コードを増やさず、既存のテスト済み関数を再利用）。
- `unwrapPrivateKey(wrapped: {iv, ciphertext}, wrappingKey: CryptoKey): Promise<CryptoKey>` — `decryptJson`で開封し、`crypto.subtle.importKey('pkcs8', bytes, {name:'ECDH', namedCurve:'P-256'}, false, ['deriveKey'])`で**非extractable**にimport。復号に失敗＝パスワード誤り（GCM認証タグが担う。§1の通り既存のcheck-blobと同じ役目）。
- `encryptWithPublicKey(publicKey: CryptoKey, data: unknown): Promise<{ephemeralPublicKey: string, iv: string, ciphertext: string}>` — 呼び出しごとに使い捨てのECDH鍵ペア(ephemeral)を生成 → `deriveBits({name:'ECDH', public: publicKey}, ephemeralPrivateKey, 256)`で共有シークレットを得る → **HKDF-SHA256**（`crypto.subtle.deriveKey({name:'HKDF', hash:'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode('allmarks-private-v1'), ...}, ..., {name:'AES-GCM', length:256}, false, ['encrypt'])`。saltは省略しゼロ長（HKDFの仕様上ゼロ埋め既定値と等価）— 入力の共有シークレット自体がephemeral鍵により毎回別の高エントロピー値になるためsaltで追加のランダム性を持たせる必要がなく、`info`だけで用途を固定すれば十分）で最終鍵に整える → 既存`encryptJson`ロジックと同じ形でAES-GCM暗号化 → ephemeral公開鍵(平文でOK)と一緒に返す。
- `decryptWithPrivateKey(privateKey: CryptoKey, envelope): Promise<T>` — 埋め込まれたephemeral公開鍵をimport → `deriveBits({name:'ECDH', public: ephemeralPublicKey}, privateKey, 256)`で**同じ**共有シークレットを再現（ECDHの対称性）→ 同じHKDFで同じ鍵を再現 → 復号。

新しい低レベルプリミティブはECDH/HKDFのみで、AES-GCM暗号化自体は既存の`encryptJson`/`decryptJson`をそのまま内部で使い回す設計とする（新規テスト対象を最小化）。

### 2.3 `vault-store.ts`の変更

- `createVault(db, tagId, password, hint?)`: PBKDF2派生鍵の生成に加え、ECDH鍵ペアを生成 → 公開鍵をそのまま保存 → 秘密鍵をPBKDF2派生鍵でwrap → `PrivateVaultRecord`に両方保存。返す`PrivateVaultSession`は`{tagId, privateKey}`（非extractableな秘密鍵を持つ）。
- `unlockVault(db, password)`: PBKDF2で"包みを開ける鍵"を導出 → `wrappedPrivateKey`を`unwrapPrivateKey`で開封（失敗＝wrong password、null返す。既存の「vault-not-found/wrong-passwordを区別しない」契約は維持）→ 秘密鍵を含む`PrivateVaultSession`を返す。

### 2.4 `vault-session.ts`の変更

`PrivateVaultSession`の`key`フィールドを`privateKey`にリネーム（意味の明確化）。モジュールシングルトンという設計自体（[vault-session.ts:11-17](../../../lib/private/vault-session.ts#L11-L17)のコメント通りPopOutとの共有に必要）は変更しない。

---

## 3. 「付ける」系の解錠不要化（`lib/private/apply-tag-change.ts`）

- **`addPrivateTag(db, bookmarkId, privateTagId)`**: `session`引数を削除。関数内部で`loadVaultRecord(db)`から`publicKey`を読み、`encryptWithPublicKey`で暗号化する。呼び出しに解錠は一切不要になる。vault未設定（レコードなし）の場合はno-op（既存の`session === null`ガードの代わりに、レコード自体の有無で判定）。
- **`addPrivateTagBatch(db, bookmarkIds, privateTagId)`**: 同様に`session`引数を削除。③まとめてPrivate化もロック中に即実行可能になる。
- **`removePrivateTag(db, bookmarkId, privateTagId, session)`**: **変更なし**。中身を平文に戻すには復号が要るため、引き続き`session`（秘密鍵）必須。
- **`resolvePrivateVisibility`**（[resolve-visibility.ts](../../../lib/private/resolve-visibility.ts)）: 変更なし。表示のための復号は引き続き解錠必須（見る＝復号、というルールそのまま）。`session.key`参照を`session.privateKey`に、`decryptJson`呼び出しを`decryptWithPrivateKey`に置き換えるのみ。

---

## 4. `handlePrivateEntry`のルーティング変更（`BoardRoot.tsx`）

新しい統一ルール: **「付ける」操作(暗号化)はvaultさえ存在すれば常に即実行。「外す・見る・絞り込む」操作(復号)だけ解錠ダイアログを要求する。**

`PendingPrivateAction`の各kindの扱い:

| kind | 操作の性質 | ロック中の挙動(After) | 変更点 |
|---|---|---|---|
| `toggle-tag`（`currentlyTagged: false`＝付ける） | 暗号化のみ | **即実行**（解錠ダイアログを経由しない） | Before: 解錠ダイアログ必須 |
| `toggle-tag`（`currentlyTagged: true`＝外す） | 復号が要る | 解錠ダイアログ（既存の通り。実際にはこの状態は現状も発生し得ない＝ロック中はPrivate済みカードが盤面に出ない不変条件を維持） | 変更なし |
| `filter`（絞り込み表示） | 復号して見る前提の操作 | 解錠ダイアログ（変更なし） | 変更なし |
| `batch-encrypt`（まとめて付ける） | 暗号化のみ | **即実行** | Before: 解錠ダイアログ必須 |

`handlePrivateEntry`は`privateTagId === null`（未設定）の分岐のみ維持し、「ロック中か」の分岐を「このactionは復号を要るか(`toggle-tag`かつ`currentlyTagged: true`、または`filter`)」の分岐に置き換える。暗号化のみのactionはvault未設定でない限りその場で`runPrivateAction`を呼ぶ。

---

## 5. クイック保存3面の配線

`TagAddPopover`（[TagAddPopover/index.tsx:37-49](../../../components/board/TagAddPopover/index.tsx#L37-L49)）は既に`privateEntry?: {status, isTagged, onClick}`という汎用propを持ち、コメントで「PopOut/拡張機能の quick-tag popoverは②未実装のため今は渡していない」と明記されている。本spec はこのpropを3面すべてに配線する。

| 表面 | 現在の呼び出し元 | 実ナビゲーションか | IDBパーティション |
|---|---|---|---|
| PopOut | `components/pip/PipCompanion.tsx`（`allTags`をPrivate除外して渡す実装、:103,117,202） | いいえ（同一JSレルム） | メインタブと同一（疑う余地なし） |
| 拡張機能保存iframe | `app/save-iframe/SaveIframeClient.tsx`（:67） | はい（`allmarks.app`への実ナビゲーション、拡張のOffscreen Document内） | 開発者コメントベースで同一パーティション前提（**実装時に実機で再検証**） |
| ブックマークレットpopup | `components/bookmarklet/SaveToast.tsx`（:119,192） | はい（`window.open`によるfirst-partyトップレベルタブ） | 同一パーティション（[lib/utils/bookmarklet.ts:52-58](../../../lib/utils/bookmarklet.ts#L52-L58)のコメントで明記、確度高い） |

3面共通の配線:
1. `initDB()`で得た`db`から`loadVaultRecord(db)`を呼び、`status: 'none' | 'locked' | 'unlocked'`相当を判定（`privateTagId`の有無＋`usePrivateVaultSession()`のセッション有無。PopOutは既存フックがそのまま使えるはず、拡張機能iframe/ブックマークレットpopupは`vault-session.ts`のモジュール変数が別レルムなので**常に`locked`扱い**＝正しい。復号不要な機能しか使わないため実害なし）。
2. `privateEntry.onClick`は`addPrivateTag(db, bookmarkId, privateTagId)`を直接呼ぶ（`session`不要になったため、quick-tag-apply.tsを経由しない新しい専用パス）。
3. `status === 'none'`（vault未設定）のときは、クリックしても暗号化を試みず「AllMarks本体で先にPrivateを設定してください」という案内のみ表示する（実装は各コンポーネントの都合に合わせる：トースト/インライン文言など。フルのセットアップダイアログはこの3面には出さない）。
4. `lib/tagger/quick-tag-apply.ts`の`isPrivateVaultTagId`による弾き（[quick-tag-apply.ts:21-24](../../../lib/tagger/quick-tag-apply.ts#L21-L24)）は**そのまま維持**（このガードは「新規タグ名がたまたまPrivateと同名になる簡易書き込み」を防ぐためのもので、③との役割分担は変わらない）。

**実装時の検証事項**（この spec の時点では未確認、writing-plansのタスクに含める）:
- PopOutで`usePrivateVaultSession()`を呼んで実際に非nullが返ること（メインタブ解錠中に確認）。
- 拡張機能の保存iframe経由で書き込んだ内容が、実際にメインタブのボードに（別パーティションに逃げずに）反映されること。

---

## 6. 表記統一（🔒 Private）

現状5箇所（`FilterPill.tsx:537-538`, `TagDropPanel.tsx:168-169`, `BoardMobileTagBar.tsx:152`, `ExtensionEntry.tsx:299`, `TagAddPopover/index.tsx:201`）がそれぞれ独立して「🔒」+「Private」をハードコードしており、アイコンとラベルの間隔もCSSの`gap`や文字列内スペースなど実装がバラバラ。

`lib/private/`配下に共通定数を新設（例: `PRIVATE_ICON = '🔒'`, `PRIVATE_UNLOCKED_ICON = '🔓'`）し、5箇所＋新規3箇所すべてがこれを参照する形に統一する。アイコンとラベルの間隔を詰める（現状の見た目より近づける）。将来アイコンを変える際はこの定数を1箇所直すだけで済むようにする。

---

## 7. テスト方針

- `lib/private/crypto.test.ts`: 新関数（鍵ペア生成・wrap/unwrap・公開鍵暗号化/秘密鍵復号のラウンドトリップ・不正な鍵での復号失敗）のユニットテストを追加。
- `lib/private/vault-store.test.ts`: `createVault`/`unlockVault`の新しいレコード形状・wrong password時にnullを返す挙動を更新。
- `lib/private/apply-tag-change.test.ts`: `addPrivateTag`/`addPrivateTagBatch`が`session`なしで呼べること、vault未設定時のno-op、`removePrivateTag`は引き続き`session`必須であることを検証。
- `tests/e2e/private-vault.spec.ts`: 「ロック中にタグ付けしようとすると解錠ダイアログが出る」という既存assertionを、「ロック中でも即座にタグが付く（解錠ダイアログは出ない）」に更新。「外す」「絞り込む」操作の解錠必須assertionは維持。
- 新規3面（拡張機能/ブックマークレット/PopOut）でのPrivateタグ付けのe2eまたは実機確認を追加。
- 実装完了後、`security-review`（暗号コード専用）を1回挟む。

---

## 8. スコープ外・既知の残

- ④(Privateの存在自体を隠すオプション)は引き続き対象外。
- `docs/CURRENT_GOAL.md`に記載の軽微な積み残し項目（aria-describedby未対応、命名不一致コメント等）はこのspecのスコープ外。
- ロック中に新規タグ入力欄へ「private」と入力すると平文タグが作れてしまう既存の穴（Phase 1由来）は、本specでも未対応（quick-tag-apply.tsの`isPrivateVaultTagId`ガードは既存タグ名の一致判定のみで、この経路とは別物）。
