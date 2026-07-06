# 次セッションのゴール (= セッション 165)

## 今の状態（s164＝SHARE 作り直しの brainstorm→spec→plan 完成／TUNE 横並び保管 完了／次は SHARE 実装フェーズ1）

**セッション164でやったこと（コミット済・コード/UI 変更なし＝デプロイ不要）:**
- **① SHARE 作り直し（N-34/36/37/38 統合）の brainstorm→spec→plan 完了**。ユーザーと相談で確定：
  - **① (b) 併記**：SHARE＝スクショが主役／`/s` 取り込みリンクは「COPY LINK」の任意アクションで残す（画像＋リンクを併記）。「画像そのものをクリックで取り込み」は SNS 仕様上不可＝リンク併記かQR（QRは将来）。
  - **② (a) 一時状態**：自由配置はモード中だけ、抜けるとグリッド復帰（本物盤面には反映しない＝グリッド常時法則を守る）。
  - **A案 二段**：SHARE 押下→窓を出さずモード突入→第1段「選ぶ」（s157 流用・下部バー primary を ARRANGE に）→第2段「並べる」（自由配置キャンバス＋下部「SHARING…」トースト）→ユーザーが**範囲選択スクショ**（クロム写り込み回避）→終了でグリッド復帰。
  - **タイトル**（＝TITLE ボタンの背景ワードマーク）を今回実装：`ShareTitleConfig{enabled,text,size,x,y}` 単一設定で駆動、その場編集＋**ドラッグ移動**＋サイズ＋出し入れ、既定でカードの後ろ。フォント種類ピッカー（N-35）は次。
  - **重要な実コード発見**：`/s` 生成のサーバー route は **画像サムネ必須**（thumb 無いと 400）。→ COPY LINK は出荷済みの thumb+リンク生成を**裏で回すヘッドレス版**に縮小（サムネは OG プレビュー用・ユーザーが貼るのは自分のスクショ）。
  - **spec**: [2026-07-06-share-collage-screenshot-rebuild-design.md](superpowers/specs/2026-07-06-share-collage-screenshot-rebuild-design.md)／**plan**: [2026-07-06-share-collage-screenshot-rebuild.md](superpowers/plans/2026-07-06-share-collage-screenshot-rebuild.md)（**10タスク・出荷可能3フェーズ**）。
- **② TUNE 横並び保管 完了**（commit）：`b317fa2` の横並び TuneTrigger を `components/board/_archive/TuneClassicBody.{tsx,module.css}.txt`＋README にビルド非結合（`.txt`）で保管。tsc 緑で非結合確認。

## このセッションのゴール ＝ SHARE 実装フェーズ1（サブエージェント駆動）

**plan の Task 1〜4（フェーズ1＝コアモード：選ぶ→並べる→スクショ／旧ドロワー撤去）を実装。** 進め方＝**サブエージェント駆動開発**（タスクごとに新エージェント＋各後レビュー）。
- Task 1 `lib/share/collage-layout.ts`（純関数・TDD）→ Task 2 `CollageCanvas.tsx`（自由配置描画/ドラッグ/リサイズ）→ Task 3 `ShareToast.tsx`（下部トースト）→ Task 4 BoardRoot 配線（sharePhase 二段化・SHARE 入口・ShareSelectBar リラベル・旧 SHARE ドロワー撤去）。
- **フェーズ1 出荷チェックポイント**でゲート緑→本番デプロイ→目視。以降フェーズ2（タイトル Task5-7）／フェーズ3（COPY LINK Task8-10）。
- ジェスチャ系は `setPointerCapture` で Playwright 不可＝純関数テスト＋手動目視（plan の Global Constraints に明記）。

## その後に控える大物（順序の目安）
- **フラット化 サブ②：白フラット default テーマ**（親 spec [2026-07-05-flat-theme-and-theme-boundary-design.md](superpowers/specs/2026-07-05-flat-theme-and-theme-boundary-design.md) §48：新テーマ追加＋`DEFAULT_THEME_ID` 差し替え・モック確認してから）→ ③カスタマイズ（角丸＋N-35 タイトル摘み）→ ④音波命名＋N-33 タグ表記。
- TUNE 中身のフラット作り替え（保管済みなのでいつでも着手可）。

## サブ①の残り follow-up（非ブロッキング・次以降）
- **N-07 e2e**：`board-b0.spec.ts` の IDB seed 版数ズレ（`open(db,9)` vs `DB_VERSION=16`）で実行不能。seed を現行スキーマへ。
- **SharedBoard.tsx**：TUNE と SHARE が独立 state で同時に開き得る（低優先）。
- **ChromeButton.test.tsx**：paper 削除で薄い describe。

## その他の保留（従来どおり）
- **Mac 実機の目視**（フルスクリーン保存カード＋N-30 ピル）。
- **拡張の再審査は束ねる**：N-25（済）＋N-28 Pinterest＋N-29 設定導線 を1回で。
- **ローンチ前必須**：(1)スマホ本格対応（最優先・未着手）(2)端末間同期（案B・スパイク緑）(3)見せ用共有ボード (4)翻訳/法務レビュー。

## 守ること（毎回）
- 見た目変更は ui-design.md 準拠＋実機（Playwright/手動）検証してからデプロイ。テーマ作業前に `reference_theme_system_foundation` と親 spec を読む。
- web 変更は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`。
- 機微情報は `docs/private/` のみ。マージ後は生 `git log --graph`。応答は日本語・簡潔・平易。PopOut/PiP 等は正式名で呼ぶ。
