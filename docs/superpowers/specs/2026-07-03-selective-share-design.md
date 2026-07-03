# 選択的シェア（SELECT CARDS）設計 — 2026-07-03 セッション157

## 背景・目的

現状の共有は「いまの絞り込み結果の新しい順 100 枚固定」（`SHARE_LIMITS_V2.MAX_CARDS = 100`）。
545 枚持つユーザーは古いカードを共有に含める手段がなく、共有したいカードを意図して選べない。

**ゴール**: 共有モーダルから「選択モード」に入り、盤面でカードを 1 枚ずつ選んで、
選んだカードだけを共有できるようにする。既存の「押したらすぐ 100 枚共有」体験は無変更で残す。

ユーザー確定事項（セッション157 相談）:

- 入り口は SHARE モーダル内の SELECT CARDS ボタン（案1）。ヘッダー常設ボタンは作らない
- 選択モードは**空っぽから足す**（案A）。現行 100 枚のプリセット選択はしない
- 100 枚上限は維持（撤廃は別件）

## 1. 全体フロー

1. SHARE 押下 → 従来どおり共有モーダルが開く（いまの絞り込み・新しい順 100 枚）
2. モーダル内の **SELECT CARDS** 押下 → モーダルが閉じ、盤面が**選択モード**になる
3. カードをクリックして選ぶ（0 枚スタート）→ 画面下部の固定バーの **SHARE (n)** で確定
4. 共有モーダルが**選択ペイロード**で再度開く。以降（SHARE NOW → リンク / SAVE IMAGE / POST TO X）は既存と同一
5. CANCEL または Esc で選択モード終了＝選択破棄。共有フロー完了・モーダルクローズ時も破棄（永続化しない）

## 2. 選択モード中の盤面挙動

- **クリック＝選択トグルのみ**。Lightbox 開閉・並べ替えドラッグ・リサイズ・カードのホバー操作（削除等）は選択モード中すべて無効（誤操作防止）
- 選択済みの見た目: **角に緑チェックバッジ（#28F100）＋細い緑アウトライン**。未選択カードの見た目は変えない（既存 pill 視覚言語 ✓green と同系統）
- **タグ絞り込みは選択モード中も使用可**。絞り込みを切り替えても選択済み集合は維持（タグAから3枚＋タグBから5枚、が可能）
- 下部固定バー（選択モード中のみ mount）:
  - カウンター `n / 100 SELECTED`
  - **SELECT ALL** — いま見えている絞り込み結果を盤面順で上限まで一括追加（既選択はそのまま、未選択分を 100 に達するまで追加）
  - **SHARE (n)** — 0 枚時は disabled
  - **CANCEL**
- **101 枚目のクリック**: 追加せず、琥珀色 ⚠ フィードバック「100 MAX」（「Already saved」と同じ優しいトーン。エラー調にしない）
- ラベルは既存モーダル同様の**英語直書き**（SELECT CARDS / SELECTED / SELECT ALL / SHARE / CANCEL / 100 MAX）＝ i18n 15言語作業なし

## 3. 確定後のペイロードとプレビュー

- ペイロードは既存 `buildShareDataFromBoard`（[lib/share/board-to-share.ts](../../../lib/share/board-to-share.ts)）を流用。
  `items` に**選択カードを盤面順（新しい順）**で渡すだけ（クリック順ではない）
- `filter` は `null`（手動選択はタグ絞り込みと独立した集合のため）。ミラー上部のタグ帯も出さない（`activeTagNames: []`）
- カードごとの `tg`（タグ）と tag dict は従来どおり載る。テーマ・`gap`・`w`（既定カード幅）・`custom` も従来どおり
- **受け取り側（/s/ = SharedBoard / ReceiverTriage）は一切変更なし**（ペイロード形は既存 v2 のまま）
- **プレビュー（ShareMirror）**: 選択共有のときは「選ばれたカードだけを詰め直したレイアウト」を表示する。
  `computeSkylineLayout`（[lib/board/skyline-layout.ts](../../../lib/board/skyline-layout.ts)）＋既存の高さ関数で選択部分集合のレイアウトを計算し、
  `items` / `positions` として渡す（＝受け取り手が再構築する形と一致）
- 選択共有時のプレビュースクロールは**モーダル内ローカル**で完結させる（既存の `onPanY` → 背後盤面パン同期は使わない。
  背後の盤面は選択集合と並びが違うため同期の意味がない）

## 4. 実装の配線ポイント（現状の実測アンカー）

| 箇所 | 現状 | 変更 |
|------|------|------|
| [BoardRoot.tsx:366](../../../components/board/BoardRoot.tsx#L366) | `shareModalOpen` state | 選択モード state（`selectMode: boolean` + `selectedIds: Set<string>`）を追加 |
| [BoardRoot.tsx:1828](../../../components/board/BoardRoot.tsx#L1828) | `buildShareData` = `lightboxNavItems` 全量 | 選択確定時は `selectedIds` でフィルタした盤面順集合を渡す分岐 |
| [SenderShareModal.tsx](../../../components/share/SenderShareModal.tsx) | SHARE NOW / CLOSE ボタン | SELECT CARDS ボタン追加（idle 状態時のみ）。選択共有時は `onPanY` をローカルスクロールに差し替え |
| CardsLayer / CardNode | クリック→Lightbox、pointer capture ドラッグ | 選択モード中は toggle のみに切替（既存ハンドラの入口で分岐）＋チェックバッジ描画 |
| 下部固定バー | なし | 新規コンポーネント（選択モード中のみ mount）。z-index は定数ファイルに追加 |

選択ロジック（toggle / 100 上限 / SELECT ALL / 盤面順への写像）は**純関数**に切り出して単体テストする
（例: `lib/share/selection.ts`）。

## 5. やらないこと（non-goals）

- 選択の永続化（IDB 保存・次回復元）
- 100 枚上限の撤廃・引き上げ
- ヘッダー常設の選択モード入口（将来「一括タグ付け/一括削除」をやるときに再検討）
- 受け取り画面の変更
- スマホ対応（盤面自体が未対応プラットフォーム）

## 6. エッジケース

- **選択モード中にタグ絞り込みで選択済みカードが非表示になった** → 選択は維持。カウンターは選択総数を表示（見えている数ではない）
- **SELECT ALL で可視集合が残り枠より大きい** → 盤面順で 100 に達するまで追加し、⚠「100 MAX」を出す
- **0 枚で SHARE** → ボタン disabled で到達不能
- **選択モード中の Esc** → CANCEL と同じ（破棄して通常盤面へ）
- **default 盤面 byte-identical**: 選択モード UI は選択モード中のみ mount。通常表示の DOM / CSS は不変

## 7. テスト・検証

- 純関数 `lib/share/selection.ts` の単体テスト（toggle / 上限 / SELECT ALL / 盤面順写像）
- `buildShareDataFromBoard` は無変更（既存テストで担保）
- tsc / vitest / build 全green → デプロイ → 本番実測（選択→共有→受け取りリンクで選択カードだけが出ること）
- 実機確認: 選択モードの操作感（バッジ視認性・⚠トーン・SELECT ALL）はユーザー実機で最終判断
  （盤面カードクリックは Playwright 合成ポインタで不安定な既知事情あり。選択モードはドラッグ capture を無効化するため
  自動化できる可能性はあるが、保証しない）
