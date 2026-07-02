# N-19: 盤面レイアウトを default に戻す — 設計

- **日付**: 2026-07-02（セッション152）
- **状態**: 設計確定（ユーザー承認済 / 実装計画へ移行前）
- **対象**: SETTINGS ドロワーに「サイズ一括リセット」「並び順を新しい順に戻す」の2操作を追加

---

## 1. 背景・目的

600件規模で長く使っていると、下の方のカードを手でリサイズしたまま忘れてしまう。
「盤面を既定状態に戻す」手段が欲しい、というユーザー要望（N-19）。

要望は独立した2つの「default に戻す」操作に分解された:

- **A) サイズを default に戻す** — 全カードの手動リサイズを解除し、ヘッダー/TUNE の既定サイズに揃える。
- **B) 並び順を新しい順に戻す** — `savedAt`（保存日時）の新しい順に並び直す。

## 2. 既存の状態（実コードで確認済）

**中核ロジックは A・B とも既に存在する。残りは UI 配線と、B の「常時実行可能」化のみ。**

- **個別サイズリセット（存置）**: カード隅の ↺ ボタン。`hasCustomWidth===true` のカードにホバー時のみ表示
  [CardCornerActions.tsx:103](../../../components/board/CardCornerActions.tsx#L103) → `resetCustomWidth`
  [use-board-data.ts:670](../../../lib/storage/use-board-data.ts#L670) → `clearCustomCardWidth`
  [indexeddb.ts:1239](../../../lib/storage/indexeddb.ts#L1239)。
- **一括サイズリセット（ロジック実装済・UI 未配線）**: `resetAllCustomWidths`
  [use-board-data.ts:687](../../../lib/storage/use-board-data.ts#L687) → `clearAllCustomCardWidths`
  [indexeddb.ts:1255](../../../lib/storage/indexeddb.ts#L1255)。`customCardWidth` フラグを false にするだけ（保存済み `cardWidth` 数値は無害なので残す）。
  - **経緯（重要）**: このボタン（当時 "ResetAll"）はセッション41でユーザーが明示的に「廃止（Ctrl+Z で代替）」を選択して UI を外した経緯がある
    [TODO_COMPLETED.md:2139](../../TODO_COMPLETED.md#L2139)。今回は「Ctrl+Z では跨セッションで戻せない」ため再導入する、という判断。
- **並び順の振り直しロジック（一度きり実行に限定されている）**: `repairOrderIndexIfNeeded`
  [indexeddb.ts:779](../../../lib/storage/indexeddb.ts#L779)。`savedAt` DESC（新しい順、同時刻は id ASC）で orderIndex を N-1..0 に振る
  [indexeddb.ts:804-823](../../../lib/storage/indexeddb.ts#L804)。今は `migrationFlags.orderIndexRepairV2/V3` で **初回一度だけ** に制限（毎回動くと手動ドラッグ並べ替えを上書きするため）。
- **位置は保存しない**: 常に skyline 自動レイアウト [skyline-layout.ts:94](../../../lib/board/skyline-layout.ts#L94)。並び順のみ `orderIndex`（DESC=新しい順）で保持。→ 「位置を default に戻す」= 実質「並び順を新しい順に戻す」以外の意味を持たない。
- **既存の一時トースト機構**: `UndoToast` / `setToast` [BoardRoot.tsx:291](../../../components/board/BoardRoot.tsx#L291), [:1650](../../../components/board/BoardRoot.tsx#L1650)。
- **既存の undo エントリ（カード単位）**: 個別リサイズは `pushUndo({ kind:'resize', prevWidth, prevCustom })` を積む [BoardRoot.tsx:554](../../../components/board/BoardRoot.tsx#L554)。

## 3. スコープ

### やること
1. SETTINGS ドロワーに新グループ **「LAYOUT」** を追加。
2. **A) RESET CARD SIZES** ボタン — 既存 `resetAllCustomWidths` を配線。
3. **B) SORT: NEWEST FIRST** ボタン — 新関数 `resortByNewestFirst(db)`（フラグ非依存）を追加して配線。
4. どちらも押し間違い防止の **その場2タップ確認**。
5. 実行後の一時フィードバック（既存トースト）。
6. i18n 15言語のキー追加。

### やらないこと（不変条件）
- 個別 ↺（[CardCornerActions.tsx:103](../../../components/board/CardCornerActions.tsx#L103)）は変更しない。
- TUNE の ↺（＝幅/間隔スライダーのリセット `handleResetWidthGap` [BoardRoot.tsx:449](../../../components/board/BoardRoot.tsx#L449)）は変更しない。
- default テーマ盤面は **byte-identical**（新 UI は全テーマ共通の純追加。default 盤面の見た目・DOM に影響を与えない）。
- `repairOrderIndexIfNeeded` の既存フラグガードや起動時マイグレーションは変更しない（新関数を別に足す）。
- 「位置」保存の導入はしない（自動レイアウトのまま）。

## 4. UI 設計

### 4.1 配置
`ExtensionEntry.tsx`（= SETTINGS ドロワーの実体）の SAVING グループ直下に新 `<section className={styles.group}>` を追加。
グループラベル: `LAYOUT`。既存グループ（SAVING/THEME/HOW TO USE/EXTENSION）と同じ `styles.group` / `styles.groupLabel` / ボタン系クラスを流用し、見た目の一貫性を保つ。

```
SETTINGS
 ├ SAVING        （QUICK-TAG ON SAVE / EXPORT・IMPORT）
 ├ LAYOUT   ★新規
 │   ├ [ RESET CARD SIZES ]      ← A（リサイズ済み枚数を表示・0枚で無効）
 │   └ [ SORT: NEWEST FIRST ]    ← B
 ├ THEME
 ├ HOW TO USE
 └ EXTENSION
```

### 4.2 A) RESET CARD SIZES
- **表示**: リサイズ済みカード数を併記（例 `RESET CARD SIZES (12)`）。0枚のときは **無効（薄く）** 表示にし、押下不可＝「全部すでに既定サイズ」が一目で分かる。
  - 枚数は `items` の `customCardWidth===true` を数える（[BoardRoot.tsx:491](../../../components/board/BoardRoot.tsx#L491) と同じ判定）。`BoardRoot` で算出して `ExtensionEntry` に prop で渡す。
- **動作**: 2タップ確認 → `resetAllCustomWidths()` を呼ぶ → in-memory `items` の `customCardWidth` が false になり skyline が再計算され盤面が即揃う。
- **フィードバック**: 成功トースト（例「Reset N cards to default size」）。

### 4.3 B) SORT: NEWEST FIRST
- **表示**: 常時有効（「並び順が既に新しい順か」を安価に判定できないため）。
- **動作**: 2タップ確認 → `resortByNewestFirst(db)` を呼ぶ → in-memory `items` も savedAt DESC（同時刻 id ASC）で並べ替え → 盤面が即反映。
- **注意表示**: 手動ドラッグ並べ替えは失われる旨を、確認ラベルまたはキャプションで一言伝える。
- **フィードバック**: 成功トースト（例「Sorted newest first」）。

### 4.4 その場2タップ確認（共通挙動）
- 1回目の押下: ボタンラベルが確認文言（例 `TAP AGAIN TO CONFIRM`）に変化し、約3秒のタイムアウトを開始。危険度を示す軽い強調（色 or 太字）。
- タイムアウト内に2回目の押下: 実行 → ラベルを元に戻す。
- タイムアウト経過・ドロワーを閉じる・もう片方のボタンを押す: 確認状態をキャンセルして元ラベルへ。
- 2つのボタンの確認状態は排他（片方を確認中にもう片方を押したら、前者はキャンセル）。
- モーダルは使わない（ドロワーのミニマルな雰囲気を維持）。EXPORT バックアップが同ドロワー内にある＝最終保険。

### 4.5 フィードバック
既存の `UndoToast`/`setToast` 経路を再利用して一時メッセージを表示（新規トースト機構は作らない）。
文言は i18n キー経由（§6）。

## 5. データ層・状態フロー

### 5.1 新関数 `resortByNewestFirst(db)`（indexeddb.ts）
`repairOrderIndexIfNeeded` の並び替え中核（[indexeddb.ts:804-823](../../../lib/storage/indexeddb.ts#L804)）を **共有ヘルパに抽出して両者から呼ぶ**（重複を避ける）形で、**フラグ判定なし・migrationFlags 非更新** の版を新設。既存 `repairOrderIndexIfNeeded` の外部挙動は不変（内部で同ヘルパを使うだけ）。

- 全 bookmarks を取得 → savedAt DESC（同時刻 id ASC）→ orderIndex を N-1..0 に振り直し（差分のあるレコードのみ put）。
- 戻り値: 更新件数（呼び出し側の表示・テスト用）。
- 起動時マイグレーション（既存の flag ガード付き呼び出し）とは別経路＝互いに干渉しない。

### 5.2 use-board-data フック
- A: 既存 `resetAllCustomWidths`（[use-board-data.ts:687](../../../lib/storage/use-board-data.ts#L687)）をそのまま使う（現状 `items` の `customCardWidth` を false 更新済＝再描画される）。
- B: 新フック関数 `resortNewestFirst()` を追加 — `resortByNewestFirst(db)` を呼び、**in-memory `items` も同じ順序で並べ替えて** `setItems` する（DB とメモリの整合＝盤面即反映）。並び順は DESC 表示なので orderIndex DESC で持つ既存表現に合わせる。

### 5.3 BoardRoot 配線
- `customWidthCount`（`items.filter(customCardWidth).length`）を算出し `ExtensionEntry` に渡す。
- A/B 実行ハンドラ（確認後に呼ばれる）を `ExtensionEntry` に渡す。ハンドラ内で成功トーストを出す。

## 6. i18n（15言語）

新規キー（`board.settings.*` 系に追加、UI 文言は世界共通で分かる英語＝翻訳は説明文のみ）:

| キー | 用途 | 例（英） |
|---|---|---|
| `board.settings.layoutGroup` | グループ見出し | `LAYOUT` |
| `board.settings.resetCardSizes` | A ボタン | `RESET CARD SIZES` |
| `board.settings.sortNewestFirst` | B ボタン | `SORT: NEWEST FIRST` |
| `board.settings.tapAgainToConfirm` | 2タップ確認ラベル | `TAP AGAIN TO CONFIRM` |
| `board.settings.sortNewestNote` | B の注意（手動並びが消える） | （各言語訳） |
| `board.settings.resetSizesDone` | A 成功トースト | `Reset {n} cards to default size` |
| `board.settings.sortNewestDone` | B 成功トースト | `Sorted newest first` |

- グループ見出し・ボタン英字はメニュー既存語彙と同じく英語 verbatim、注意文/トーストは各言語訳（既存の `board.settings.*` 追加時の方針を踏襲）。

## 7. 不変条件（実装後に検証する）

- **default 盤面 byte-identical**: 新 UI は SETTINGS ドロワー内のみ。盤面 DOM・default テーマ CSS に影響なし。
- **tsc 0 / vitest 全緑 / build OK**。
- 個別 ↺・TUNE ↺・既存マイグレーションの挙動不変。
- A は bookmarks の `cardWidth` 数値を破壊しない（フラグのみ）。B は savedAt/タグ/その他フィールドを破壊しない（orderIndex のみ）。

## 8. テスト戦略

- **単体（indexeddb）**: `resortByNewestFirst` — 乱れた orderIndex → savedAt DESC に振り直す / 同時刻は id ASC / 空ボードで no-op / 既に整列済みなら updated=0。既存 `idb-v11-custom-card-width.test.ts` / `repairOrderIndex` テストの隣に追加。
- **単体（use-board-data）**: `resortNewestFirst()` 後に in-memory `items` が DESC 整列すること。`resetAllCustomWidths()` で全 `customCardWidth` が false になること（既存テストで一部カバー済なら差分のみ）。
- **コンポーネント（ExtensionEntry）**: LAYOUT グループが描画される / A は count 0 で disabled・>0 で enabled / 2タップ確認（1回目でラベル変化・2回目でハンドラ発火・タイムアウトで復帰・排他）。
- **回帰**: default テーマの SETTINGS 以外に DOM 変化がないこと（既存の byte-identical 検証手法を踏襲）。

## 9. エッジケース

- **A: リサイズ済み0枚** → ボタン無効（押下不可）。
- **B: 空ボード** → no-op（updated=0）。成功トースト「Sorted newest first」は常に表示（無害・挙動を一定に保つ）。
- **B: 既に新しい順** → updated=0 だが害なし。成功トーストは常に表示。
- **確認中にドロワーが閉じる** → 確認状態リセット。
- **両ボタン**: 片方確認中にもう片方を押す → 前者キャンセル・後者が確認開始。

## 10. 補足（将来の任意拡張・今回スコープ外）

- **UNDO 提供**: undo スタックは既にカード単位で width 変化を捕捉（`kind:'resize'`）、`UndoToast` も存在するため、A の一括リセットに「まとめて UNDO」を成功トーストから提供する拡張は比較的低コスト（新 undo kind で clear した {id, prevWidth, prevCustom} 群を保持）。B の UNDO は全 orderIndex 保持が必要でやや重い。今回は「2タップ確認＋EXPORT バックアップ」を安全策とし、UNDO は入れない。ユーザーが望めば別途。
