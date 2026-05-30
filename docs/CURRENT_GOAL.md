# 次セッションのゴール (= セッション 94)

## 今のゴール (1 行)

**session 93 で 4 件本番 ship (タグ名 全小文字 / 共有のタグ小文字 + 共有がフィルター絞り込みを反映するバグ修正 / タグ名リネーム(右クリック→モーダル) / タグ並び替え(掴み手ハンドル、 フィルター + triage))。 session 94 は user フィードバックで ②③④ を作り直す: リネームをインライン化 / 並び替えを掴み手廃止 → 直接ドラッグ + 自動スクロール + 右方向バグ修正 / デフォルト名前順 + 昇順降順ボタン。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態」を読む
2. ドメインは催促しない (session 91 で棚上げ確定)
3. 下の rework タスクを順に。各段階で **実機(Playwright)検証 → コミット → 本番**(デプロイ前に `npx wrangler whoami`、 切れてたら `npx wrangler login` でブラウザ Allow)

## 🔴 session 94 の作り直し (= user フィードバック確定済み、 本番を見た上での要望)

### ② リネームを「その場で編集(インライン)」に
- 今: 右クリック「Rename」→ RenameTagDialog (モーダル)。
- 変更: **モーダル廃止**。右クリック「Rename」(かダブルクリック)で、その行/チップの **タグ名がその場で入力欄に変わる**。Enter 確定 / Esc 取消 / blur で確定。重複ガード(大文字小文字無視)は維持して優しく弾く。表示は小文字のまま、保存値はそのまま。
- 対象: フィルターのドロップダウン行 ([FilterPill.tsx](../components/board/FilterPill.tsx)) + triage チップ ([TagPicker.tsx](../components/triage/TagPicker.tsx))。
- [RenameTagDialog.tsx](../components/triage/RenameTagDialog.tsx) + .module.css + test は削除 or 流用判断。

### ③ 並び替えを「掴んで動かすだけ」に作り直す
- **掴み手ハンドル(⠿)を全廃** (FilterPill の `.grip`、 TagPicker の `.chipGrip` 撤去)。
- 操作: **行/チップを直接 press → 数 px 動かしたらドラッグ開始(並び替え)、 ちょんと押すだけなら今まで通りクリック(絞り込み / arm)**。 movement threshold ~6px。 **長押し待ちは無し**(user 確定: 掴んで動かすだけ。 desktop の発見性が最優先)。
- **自動スクロール**: ドラッグ中、 ポインタが scroll コンテナの端に来たら自動スクロール(フィルター = 上下端、 triage = 左右端)。
- **🐛 右方向バグ修正**: triage で右へ並び替えできない。 原因推定 = タグ列が横スクロール(overflow)で画面外位置に運べない + ドラッグ中チップが overflow で clip。 自動スクロール + 必要なら dragging chip を clip させない(elevate)。 **systematic-debugging で root cause 確認してから直す**。
- 流用: `computeReorder` ([lib/board/reorder.ts](../lib/board/reorder.ts)) + `useTags().reorder` (検証済み)、 window pointer listener 方式。 FilterPill(縦) と TagPicker(横) の drag 実装は重複しているので **共通フック `useDragReorder(axis)` に抽出**して両方で使うのが綺麗。

### ④ デフォルト名前順 + 昇順降順ボタン
- **デフォルト = 名前順(自動)**。 日本語も `localeCompare` で あいうえお順。 自動モードでは常に名前順なので **タグ追加時に自動で正しい位置に入る**。
- **手で 1 回ドラッグ並べ替えしたら「手動モード」に切替**。 以後は手動順を保持、 追加タグは末尾。
- **昇順 / 降順ボタン**: いつでも押せば名前順(A→Z / Z→A)に整頓し直す。 **押したら自動モードに戻る**(= また揃う + 新タグも正しい位置に入る)。 置き場所案: フィルターのドロップダウンの `TAGS` セクションヘッダー横に小さな A↕ トグル(monospace、 editorial)。
- 実装: 設定 store にフラグ (例 `tagOrderMode: 'auto-asc' | 'auto-desc' | 'manual'`)。 `useTags` / 表示の並びをモードで分岐。 drag で `manual`、 sort ボタンで `auto-asc`/`auto-desc`。
- 既存 user のタグは現状 `order` を持つ → 初回から名前順表示でよい(migration 不要、 表示時 sort で対応可)。 要小確認: 初回を auto にするか manual のままにするか。

## 守ること
- インライン編集・直接ドラッグは **Playwright で実機検証してから報告**(setPointerCapture は使わない = window listener)。
- 見た目 / 余白 / 配置変更は実機確認。 **横文字を日本語応答に混ぜない**。 推奨を先に。 AskUserQuestion ボックス禁止(平文で 1 個ずつ)。

## 別タスク (記録済み backlog、 ③④ と混ぜない)
- **ページ名の不一致整理**: ボタン「MANAGE TAGS」↔ URL / 内部名 `/triage` のズレ。 他の(ボタン名 ↔ 内部名)ズレも洗い出して提案する独立タスク。 **URL 変更は共有リンクに影響するので慎重に**。
- **共有ミラーの再現精度**(角丸・背景タイポ未描画) / **カードが左詰めされないことがある** → TODO §未対応バグ 参照。

## session 93 で本番ライブ済 (おさらい)
- タグ名 全小文字表示 / 共有のタグ小文字 + 共有がフィルター絞り込み反映 / リネーム(モーダル、 ②で作り直す) / 並び替え(掴み手、 ③で作り直す)。 全部 `booklage.pages.dev` 反映済。
