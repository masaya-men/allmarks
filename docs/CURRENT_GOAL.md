# 次セッションのゴール — 高速バックログ消化（1機能 = 1 フレッシュセッション）

## 進め方（最速プロトコル）

- **1 機能ずつ、フレッシュなセッションで**進める（文脈が軽い＝Claude が速く・安く・正確に走れる）。
- 各機能の最初に、ユーザーはキックオフ 1 行を貼るだけ：
  > 「docs/CURRENT_GOAL.md を読んで、バックログの **#N** を進めて。設計は最小往復で最速、実装 → 検証 → デプロイまで自走して。」
- Claude は：**設計（brainstorming・決定は最小）→ 実装 → tsc/vitest/build/deploy → commit → 「次のキックオフ文」を提示**。
- ルール：見た目変更は claim 前に Playwright で実測。応答は短く。戻せる修正は逐一承認を取らず自走。デプロイは `--branch=master`。機微は `docs/private/`。

## バックログ（順不同・どれからでも）

1. **#3 タグ付け刷新【最優先・着手中】** — spec: `docs/superpowers/specs/2026-07-07-tag-mode-drag-drop-design.md`。パネルは**右端に浮く小さめのタグ専用・上下中央・程よい高さで内部スクロール**（ユーザー確定）。
   - ✅ **Phase 1 完了（commit 済・未デプロイ）**: MANAGE TAGS → in-page TAG MODE（`tagMode` state・Share 選択機構を流用・`TagDropPanel` 右端浮動パネル・DONE/Esc）。tsc0/vitest2070。
   - ⚠️ **デプロイ禁止（Phase 2 完了まで）**: 今デプロイすると MANAGE TAGS が機能しないパネルを開き、Triage タグ付けが到達不能。Phase 2 で drag-drop が動いてから初めてデプロイ。
   - ⏭ **Phase 2（次）**: 選択カードをドラッグ → 右端タグ行（`data-tag-id`）/`+ NEW TAG`（`data-tag-new`）にドロップ → `persistTags(id, union(既存, tagId))` で追加付与・ホバーハイライト/「+N」。GSAP Draggable + ドロップ hit-test。→ Phase 3: `+ NEW TAG` で `useTags.create` 新規作成。→ Phase 4: Triage 撤去。
2. **TUNE 刷新セット** — (#2) 前に気に入っていた版へ**戻す**（カード間ギャップ調整時に**右端カードが見えず**調整しづらい問題）＋ **TUNE をテーマ追従**に（タグ絞り込みも追従要否を検討）。(#1) **角丸 ON/OFF** トグルを TUNE に同居（盤面/Share 共通で効くはず）。(#4) カード幅/ギャップ調整時、**盤面左右端の余白が揃う所でスナップ**。
3. **#7 ライトボックスの戻り先** — ナビ後に閉じると「**最後に見ていたカード**」の位置へスクロールして戻す（現状は最初のクリックカードに戻る＝`BoardRoot handleLightboxNav` が source を更新しない意図的実装）。①source 更新 ＋ ②画面外なら盤面スクロール + FLIP 着地。
4. **#6 ライトボックス自動再生** — タグでスライドショー、動画は再生 → 終了で次カードへ。
5. **#8 Share 画像の一時サーバー保管** — スクショ画像を一時的にサーバー（R2 等）へ → URL 付き画像を用意 → SNS 投稿で「本物画像 ＋ クリックで開ける」。s169 の「再構成しない」判断の再検討。
6. **#5 収益化** — 機微につき詳細は `docs/private/IDEAS.md` 参照（アカウント無しで全機能無料、端末間同期のみ有料の案）。

## 完了済（s170 この会話）

- **角丸を大きさ連動**（`min(20px, w*0.12)`）：盤面（CardsLayer）＋ Share collage（CollageCanvas）＋ 受信 /s（CardsLayer）。ライトボックス開閉のカクッ無し（`:root` 上書き）。
- **ライトボックス開閉を高速化**（open 0.34 / close 0.30）。
- **スクロールメーターを盤面外の下端バンドへ移動**（+20px lift・実測確認）。受信 /s メーターのリグレッション修正。
- **Share select の「100 MAX」ピル削除**（重複＋ガタつき）。**Share バーをメーターより前面**（z 401/402）。
