# バックアップの法的守り — 設計 (session 161, 2026-07-04)

> **注意（法的免責）**: 本 spec の利用規約文面はあくまで **Claude が用意したたたき台**。
> Claude は法助言者ではない。**本番反映前に弁護士等の専門家確認を推奨**する。
> UI 文言（初回カード・リマインド等）は法的助言ではなく、体験としての正直な説明。

---

## 1. 目的

AllMarks はデータを IndexedDB（端末内）のみに保存し、サーバーにユーザーデータを持たない。
その設計ゆえ「端末を変えた／壊れた／ブラウザデータを消した」ときにデータが失われる。
本作業は、その現実に対する **法的・体験的な安全網** を整えることが目的。ユーザーは非エンジニア＝平易に。

**「両方（法的＋体験）」がユーザーの明示要望。** ただし調査の結果、法的免責は既にかなり揃っている（§2 参照）ため、
今回の伸びしろの主眼は「**正直に伝える／失わせない体験**」＋「規約に自己バックアップ責任の一文を足す」。

---

## 2. 現状の事実（実ファイル根拠・推測でなく確認済み）

### 2.1 利用規約 — 法的免責は既に強い
`app/(marketing)/terms/page.tsx` → `components/marketing/pages/TermsContent.tsx`、本文は `messages/*.json` の `pages.terms.*`。
準拠法＝日本/東京（`TermsContent.tsx` コメント）。共有＝KV に一時アップロード＋30日削除の事実を反映済み。

- §2 service: 「All data is stored locally in your browser, and no account or registration is required.」
- §3 responsibilities: 「your data is stored locally — clearing your browser data permanently deletes your AllMarks content.」
- §6 warranty: 「"as is"/"as available" ... **not responsible for data loss from browser data clearing, device failure, or any other cause.**」
- §7 liability: 間接・付随・特別・結果的・懲罰的損害を負わない（法の許す最大限）。

→ **免責はほぼ揃っている**。欠けているのは「**自分で控えを取る責任がユーザーにある**（だから EXPORT を使う）」という積極的な一文。

### 2.2 EXPORT/IMPORT — 既に配線済み・堅牢
`components/board/BackupButton.tsx`（SETTINGS ドロワー内 `ExtensionEntry.tsx:342`、`SAVING` グループ）。
`lib/storage/backup.ts` の `exportAllStores`/`importAllStores` は rank3 対策済み：
- IMPORT は `window.confirm` で確認 → 部分/破損ファイルを clear() 前に拒否（version-too-new / no-bookmarks / corrupt-rows）
- 全ストア置換を1トランザクションで all-or-nothing（失敗時 abort でロールバック）＝「復元で全消し」事故を防ぐ。

→ **撤去禁止**（B5/session124 で正式バックアップ機能として配線）。今回は「導線強化」であって作り直しではない。

### 2.3 自動退避対策 — 稼働中
`lib/storage/persist.ts`：`requestPersistentStorage()` を起動時 best-effort 呼び出し済み（`lib/storage/use-board-data.ts:240`）。
`getStorageStatus()`（永続状態＋使用量）は**あるが SETTINGS に未表示**（follow-up 予定だった）。

### 2.4 オンボーディング — 初回に必ず通る
`lib/onboarding/steps.ts` の `ONBOARDING_SCENES`（enter→paste→tag→motion→extDemo→install→popout→manage→share→**finale**）。
`lib/onboarding/onboarding-state.ts` の `shouldAutoStartOnboarding` = `itemCount === 0 && !isOnboardingComplete`。
→ **新規ユーザーは空の盤面で必ずオンボを体験してから finale に至る**。初回安全カードは「オンボ後」に置けば、価値を感じ切った後に見せられる＝離脱を避けられる。

### 2.5 無いもの（＝本作業で作る）
- 初回の正直な説明カード（一度きり）
- 定期リマインド
- 規約の「自己バックアップ責任」の一文
- SETTINGS の「最終バックアップ：N日前／まだ」表示

---

## 3. スコープ

### 今回やる（A〜D）
- **A. 利用規約に自己バックアップ責任の一文を追加**（15言語）
- **B. 初回「データの住処」カード**（一度きり・前向き文言・「Got it」で了解時刻を記録）
- **C. SETTINGS 常駐インジケータ**（最終バックアップ N日前／まだ ＋ 任意で永続状態）
- **D. 定期リマインド**（新規たまり＋期間経過が揃った時だけ・うるさくない）

### 今回やらない（明示的 non-goal）
- **E. DBバージョン上げ前の EXPORT 促し** → **別セッションで必ずやる**（技術負荷が高く、混ぜると全体の完成度が落ちる。memory `project_backup_before_idb_migration` / `project_idb_irreversibility` と接続）。TODO / CURRENT_GOAL に残す。
- **複数端末同期（案B＝ユーザー自身のクラウド）** → `docs/private/IDEAS.md` の `(SYNC)` 節。専用セッションで brainstorm。ただし本作業（EXPORT/IMPORT 強化）は同期の第一歩＝土台になる。
- 準拠法・免責構造の変更（既存維持）。default 盤面の見た目変更（byte-identical を維持）。

---

## 4. 設計

### A. 利用規約：自己バックアップ責任の一文

**方針（具体化）**：**§3（Your responsibilities）の本文に追記**する。理由＝`TermsContent.tsx` の `SECTIONS` 配列は固定（`acceptance/service/responsibilities/ip/sharing/warranty/liability/modifications/law/contact`）で、新節を足すと id＋heading＋body を15言語すべてに新設する必要があり重い。§3 の body 文字列を延ばすのが低リスク。既存の §2/§6/§7 は維持。15言語同時更新（parity テスト `messages/all-keys-parity.test.ts` が緑を要求）。
※ 弁護士が「独立した節にしたい」と判断したら新節化はいつでも可能（別対応）。

**語り口の合わせ方（現物確認済み）**：既存 ja 規約は **「当方」を使わない**。主語は AllMarks か受け身（§6「…責任を負いません」／§7「AllMarks は…責任を負いません」）、利用者側は §3 で **「利用者」**。→ 追記も「当方」を排し、AllMarks 主語＋受け身＋「利用者」で統一する。

**たたき台（英語ソース）**：§3 本文の末尾に以下を追記：

> Your AllMarks data is stored only in your browser on this device, and no copy is kept on a server. Keeping your own backups of anything important is therefore your responsibility: use EXPORT in Settings to save a copy regularly — especially before you change devices, clear your browser data, or reset AllMarks. Data lost through browser data clearing, device loss or failure, software updates, or any other cause cannot be recovered.

**日本語（参考訳・既存規約の register に合わせる）**：
> AllMarks のデータはこの端末のブラウザ内にのみ保存され、サーバーには保存されません。そのため、大切なデータの控えを保つ責任は利用者が負います。設定内の EXPORT 機能で定期的に控えを保存してください（特に端末を変えるとき、ブラウザのデータを消すとき、AllMarks をリセットするとき）。ブラウザのデータ消去・端末の紛失や故障・ソフトウェア更新・その他の原因で失われたデータは復元できません。

※ §6 と重複気味だが、§6 は「無保証・責任を負わない」（免責）、§3 追記は「利用者に控えを取る責任がある」（積極的義務）＝役割が違うので両方あってよい。**最終文面は弁護士確認**。

### B. 初回「データの住処」カード

**トリガー**：`data-home-ack` が未記録 かつ オンボが表示中でない。
- 新規（オンボ経由）：オンボ finale 完了直後に表示。
- 既存ユーザー / オンボ skip：初回マウント時に一度だけ表示（オンボと同時には出さない）。

**振る舞い**：一度きり。ボタンは1つ「Got it」。押すと `data-home-ack = { at: ISO }` を settings に記録（＝説明と了解の証跡）→ 二度と出ない。

**文言（淡々・事実のみ・チュートリアル調。ポエム禁止）**：オンボ captions（例「AllMarks はリンクをビジュアルボードに変えます。」「準備完了です。SETTINGS からいつでも再生できます。」）と同じ、です/ます・AllMarks 主語・事実の説明のみ。感情的/詩的表現（"nobody watching", "your collages are private and yours" 等）は使わない。
- 見出し（英語ソース）: `Your data is saved on this device only.`
- 本文（英語ソース）: `All your AllMarks data is stored in this browser, on this device. There is no account, and nothing is saved on a server. To keep a copy, use EXPORT in Settings — do this before you change devices or clear your browser data.`
- ボタン: `GOT IT`（オンボの `NEXT` と同じ英語 chrome。localize しない）
- （任意の副リンク）: `Learn more` は入れない（摩擦を増やさない）。

**日本語（参考訳・オンボと同じ淡々調）**：
- 見出し「データはこの端末の中だけに保存されます。」
- 本文「AllMarks のデータはすべて、この端末のブラウザ内に保存されます。アカウントは不要で、サーバーには保存されません。控えを取るには、SETTINGS の EXPORT を使ってください。端末を変えるときや、ブラウザのデータを消す前に、控えを取ってください。」
- ボタン「GOT IT」

**見た目**：AllMarks の静かな世界観（黒/白＋音波モチーフ、ガラス質、盤面が後ろに透ける小カード）。システム警告っぽくしない。`Z_INDEX` は定数管理（魔法数値禁止）。frontend-design の水準で、既存オンボ/SETTINGS の視覚言語に合わせる。

**離脱回避の要**：淡々とした事実説明のみ（詩的表現なし）／短く1画面／一度きり／ボタン1つ／怖い言葉・チェックボックス・「責任を負う」はUIに出さない（それは規約が担う）。離脱回避はポエムでなく「短く・明快・一度きり・オンボの延長に見える」ことで担保する。

### C. SETTINGS 常駐インジケータ

**場所**：SETTINGS ドロワーの `SAVING` グループ、既存 `backupSection`（`ExtensionEntry.tsx:339`）の近く。
**表示**：
- `Last backup: 3 days ago` / まだの場合 `Last backup: never`（`last-backup-at` から算出。相対表記は既存の i18n 慣習に合わせる）。
- （任意）永続状態：`getStorageStatus()` の `persisted` を小さなドット＋文言で。ON=「Storage: protected」、未=「Storage: best-effort」程度。**任意**（クラッタを避けるなら最初は Last backup のみ）。

**役割**：普段は静かに事実を提示するだけ。ナグらない。EXPORT ボタンは既存のものを流用（導線の「格上げ」＝キャプション文言とインジケータの併設で気づきやすく）。

### D. 定期リマインド

**humane trigger（全て満たした時だけ、1セッション最大1回）**：
1. 前回 EXPORT 後に保存された**表示中アイテム数 ≥ N**（初期値 **15**）。数え方＝`items`（useBoardData の表示中＝ゴミ箱除外済み）のうち `savedAt > last-backup-at.at` の件数。一度も控えが無い場合は `items.length`（全件）。※ EXPORT は soft-delete 済みも含むため件数の単純差分は不正確 → `savedAt` 比較で正確な「新規保存数」を得る。
2. 前回 EXPORT から **≥ D 日経過**（初期値 **30**）。一度も控えが無い場合は「初回説明了解から ≥ D 日」。
3. 前回このリマインドを×で消してから **≥ D 日経過**（`backup-nudge-dismissed-at`）。
4. このセッションでまだ出していない。

**振る舞い**：EXPORT した瞬間に `last-backup-at` 更新＝差分0＝自然に静かになる。×（Later）で `backup-nudge-dismissed-at` 更新＝また条件が揃うまで出ない。
→ **まめに EXPORT する人には二度と出ない／貯めて忘れる人にだけ、たまに（定期的に）**。

**文言（淡々・チュートリアル調。英語ソース）**：
- 本文: `You've added {n} bookmarks since your last backup. Save a copy with EXPORT.`（一度も無い場合: `You've saved {n} bookmarks. Save a copy with EXPORT to keep them.`）
- ボタン: `EXPORT` / `LATER`
- 日本語（参考訳）「前回のバックアップから {n} 件増えました。EXPORT で控えを保存しておきましょう。」（一度も無い場合「{n} 件たまりました。EXPORT で控えを保存しておきましょう。」）／ボタン「EXPORT」「LATER」

**見た目**：初回カードより軽い（画面下の小さな帯 or 小カード）。オンボ/Lightbox 表示中は出さない。`Z_INDEX` 定数管理。

**数値（N=15, D=30）は定数ファイルに置き、後で調整可能に。**

---

## 5. データモデル（IndexedDB `settings` ストア）

既存の onboarding/quick-tag と同じ「settings に自分のキーで put」パターン（`onboarding-state.ts` 準拠）。新規純関数モジュールに集約（例 `lib/storage/backup-reminder.ts` 等・命名は実装時に確定）：

| キー | 形 | 更新契機 |
|---|---|---|
| `data-home-ack` | `{ key, at: ISO }` | 初回カードで「Got it」 |
| `last-backup-at` | `{ key, at: ISO }` | EXPORT 成功時（共有ヘルパ `exportBackupFile` 内で記録。at=EXPORT 時刻。新規数は `savedAt > at` で算出するので count は保存不要） |
| `backup-nudge-dismissed-at` | `{ key, at: ISO }` | 定期リマインドを「Later」で閉じた時 |

- 判定は**決定論の純関数**に切り出し（現在時刻・現件数・上記3値 → 「初回カード出す？」「リマインド出す？」を返す）＝単体テストしやすく。時刻は引数注入（`Date.now()` を関数内で呼ばない）。
- `getAll`/`get` は `initDB()` 経由。SSR 安全（`typeof window` ガードは既存パターン踏襲）。

---

## 6. i18n

- 新規キー：`pages.terms.*`（A の規約文）、初回カード・SETTINGS インジケータ・リマインドの UI 文言。
- **15言語すべてに同時追加**（`messages/all-keys-parity.test.ts` / `messages/board-onboarding-parity.test.ts` が緑を要求）。
- UI 文言は globally-clear な英語をソースに（memory `feedback_globally_clear_english` / `feedback_ui_vocabulary`）。翻訳はソース確定後にサブエージェントで一括。

---

## 7. テスト

- **純関数**（初回カード判定・リマインド判定・相対日数表記）＝ vitest 単体（時刻/件数を注入して境界を検証：N-1件/N件、D-1日/D日、未バックアップ、dismiss後）。
- **`last-backup-at` の副作用**：EXPORT 成功で count/at が記録されること。
- **BackupButton 既存テスト**（`BackupButton.test.tsx`）を壊さない。
- i18n parity テスト緑。
- **実機検証**（memory `feedback_verify_before_claiming` / s159 教訓）：
  - 初回カードがオンボ後に1回だけ出て、Got it で消え再表示されないこと（Playwright は board card click 制約に注意＝memory `reference_board_card_click_pointer_capture`。オンボ/カードのクリックが必要な箇所は手動確認併用）。
  - default 盤面 byte-identical（既存ユーザーの ack 済み状態では何も足されない）。
- tsc0 / vitest 緑 / `pnpm build`（`out/` 確認）→ deploy（memory `reference_pnpm_build_required`）。

---

## 8. 非機能・ガードレール

- default 盤面の見た目は byte-identical（ack 済みユーザーには一切の追加描画なし）。
- Tailwind 不使用・Vanilla CSS + Custom Properties・`.module.css`・`Z_INDEX` 定数（CLAUDE.md 規約）。
- `any` 禁止／Return type 明示／`console.log` 残さない。
- 機微情報なし（本 spec は tracked で可。E の詳細・同期・課金は `docs/private/`）。
- **法的文面は最終的に専門家確認を推奨**（本 spec 冒頭の免責を UI/引き継ぎでも明言）。

---

## 9. 実装順（writing-plans で詳細化）

1. データモデル純関数＋テスト（`data-home-ack` / `last-backup-at` / `backup-nudge-dismissed-at` の read/write ＋判定純関数）。
2. EXPORT に `last-backup-at` 記録の副作用（`BackupButton`）。
3. C: SETTINGS インジケータ（最終バックアップ表示、任意で永続状態）。
4. B: 初回「データの住処」カード（オンボ後トリガー・Got it 記録・視覚）。
5. D: 定期リマインド（humane trigger・帯/カード・Later 記録）。
6. A: 規約 §3 本文に追記（英語ソース）→ 15言語翻訳。
7. i18n parity・tsc・vitest・build → 実機検証 → deploy。

各タスクはサブエージェント駆動＋2段レビュー＋opus 全ブランチレビューを想定（memory `feedback_follow_plan`）。
