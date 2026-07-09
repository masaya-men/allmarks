# スマホのタグ付け — 画面下部の横スクロールタグ帯（設計）

2026-07-09 / session 182 続き。ユーザー承認済み（plain-JP consult）。

## ゴール
スマホでカードにタグを付けられるようにする。デスクトップは「カードをタグ行へ**ドラッグ**」だが、スマホはドラッグ＝ボードスクロールなので touch に合わない。→ **カードをタップで選択 → 画面下部の横スクロールタグ帯からタグをタップして付与**（ドラッグ不要）。Triage の「tag chip 下部並べ」決定＋「タグ直接 multi 選択が最速」結論（IDEAS.md）と整合。

## 操作フロー（モバイル）
1. ボトムナビの **TAG** → タグモード（既存 `handleEnterTagMode`）。
2. カードを**タップで複数選択**。**ドラッグはボードスクロール**（他カードに届く）。選択済みは既存のリング等の視覚で示す（SHARE 選択と同じ `selectedIds`）。
3. 画面最下部に **横スクロールのタグ帯**（`BoardMobileTagBar`）が出る（タグモード中はボトムナビを隠し、その位置に帯を出す＝集中モード）。
   - 上段: `N SELECTED`（左）＋ `DONE`（右, → `handleExitTagMode`）。
   - 下段: **タグチップを横一列**（左右スワイプでスクロール）。各チップ＝ FilterPill 語彙（中空ドット＋小文字名＋3桁カウント, memory `reference_allmarks_chrome_vocab_filterpill`）。
   - 先頭に **`+ NEW TAG`** チップ。
4. **タグチップをタップ → 選択中のカード全部にそのタグを付与**（既存 `assignTagToCards(tagId, selectedIds)`・additive・既付与はスキップ）。**選択は残す**＝連続で別タグも付けられる。付与時にチップを一瞬パルス＋カウント更新でフィードバック。
5. **`+ NEW TAG` タップ → その場で名前入力 → 作成＋選択カードに付与**（既存 `handleStartNewTag`/`handleCommitNewTag`/`tagDraft`）。
6. 選択ゼロのときタグチップは薄く無効（先にカードを選ぶ、を暗示）。DONE / Esc / 空タップで終了（既存の退出経路）。

## コンポーネント境界
- **新規 `BoardMobileTagBar`**（mobile-only・presentational）。props: `tags`, `tagCounts`, `selectedCount`, `creating`, `onAssignTag(tagId)`, `onStartNewTag`, `onCommitNewTag`, `onCancelNewTag`, `onDone`。TagDropPanel のロジックは持たず、横帯レイアウト＋タップ付与だけ。
- **CardsLayer**: モバイルのタグモードだけ **pointer capture を使わない**。`isMobile && isTagMode`（`isTagMode = onTagDrop != null`）のとき: `onPointerDown` は bail（ネイティブスクロール温存）、`onClick`（native）で `selectionToggle(bookmarkId)`。デスクトップのタグドラッグと SHARE 選択は不変。
- **BoardRoot**: `tagMode && !isMobile` → 既存 `TagDropPanel`（右端ドラッグ版）／`tagMode && isMobile` → `BoardMobileTagBar`。モバイルは `tagMode` 中 `BoardMobileNav` を非表示。新ハンドラ `handleAssignTagToSelection(tagId) = assignTagToCards(tagId, [...selectedIds])`（選択ゼロなら no-op）。

## 再利用（新規ロジックは最小）
- 選択: `selectedIds` / `selectionToggle`（既存）。付与: `assignTagToCards`（既存・additive）。新規タグ: `handleStartNewTag`/`handleCommitNewTag`/`tagDraft`（既存）。退出: `handleExitTagMode`（既存）。タグ一覧/カウント: `tags`/`tagCounts`（既存, TagDropPanel に渡しているもの）。

## 非対象（YAGNI）
- デスクトップの挙動は一切変えない。Triage の数字キー速選/方向スワイプは別機能（今回対象外）。タグの並べ替え・リネーム・削除はモバイル帯からは出さない（既存の管理 UI のまま）。

## 検証
- tsc / vitest。Playwright(390px): タグモードで帯が出る・チップ数=タグ数・タップで対象カードの `tags` に付与（IDB 反映）・DONE で退出・ナビが隠れて帯が出る。※カードのタップ選択（native click）は Playwright 可、pointer-capture 経路は使わないので合成ポインタ問題を回避。実機で横スクロールの感触＋スクロール共存を最終確認。
