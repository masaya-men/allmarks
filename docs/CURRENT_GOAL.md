# 次セッションのゴール (= セッション 164)

## 今の状態（s163＝★フラット化 サブ①「メニュー中立化＋右ドロワー統一」を出荷／次＝サブ②白フラット default テーマ）

**セッション163でやったこと（master マージ済 `e5aceb0` `--no-ff`／`allmarks.app` 反映済／tsc0・vitest2008・build OK）:**
- **フラット化 サブ① 完遂**（親 spec `2026-07-05-flat-theme-and-theme-boundary-design.md`／サブ① spec `2026-07-05-flat-sub1-menu-neutrality-right-drawer-design.md`／plan `2026-07-05-flat-sub1-menu-neutrality-right-drawer.md`）。brainstorm→spec→plan→**サブエージェント駆動7タスク＋各レビュー＋opus 全ブランチレビュー（要修正1件を修正）**。
  - **共通右ドロワー基盤 `ChromeDrawer`** を新設（右ドック~400px・非ブロッキング・Esc/外側クリック/×で閉じる・**body へ portal して z-405**）。**TUNE・SETTINGS・SHARE・THEMES の4パネルを統一**（全部クリックで開く＝TUNE/SETTINGS は hover 廃止／SHARE は中央モーダル→右ドロワー・~400px リフロー／書き出し画像用の隠しノードは無傷）。`BoardRoot` に単一 `activeDrawer` 状態（同時1枚だけ）。
  - **絞り込み・カードの＋タグ**は据え置き（その場ポップ・見た目だけ中立化）。
  - **全メニュー中立化**：paper-atelier の chrome 装飾（scoped CSS・`--paper-panel-*`/`--chrome-*` 参照・`useIsPaperTheme` JS分岐）を全メニューから除去＋serif 漏れ防止に中立 mono フォントを pin。**盤面（カード/背景ワードマーク/スクロールメーター/カード装飾/額縁・封蝋）はテーマ可変のまま無変更**。`--paper-panel-*` 定義は PiP/SaveToast のため温存。`DEFAULT_THEME_ID` は不変（暗い dotted-notebook のまま＝白 default は②）。
  - 正味 **約1000行削減**（4パネルの独立 shell を1基盤に統合）。

## ★あなたが本番で目視するチェックリスト（品質ゲートでは判定不能な“見た目”）
- **シェアの窓**：実カードが並んだ状態での ~400px リフローの見え方（テストは空ボードのみ確認）。
- **TUNE の窓**：横→縦レイアウトとフェーダー/文字パラパラ演出の“感じ”。
- **ドロワーがヘッダーのトリガーボタンを覆う**点（×/Esc/外側クリックで閉じる。同ボタン再押しでは閉じない）。気になれば「開いたらヘッダー退避/pressed 表示」等の小調整を検討。
- 上記が気になる場合の微調整はサブ②以降でまとめて可。

## このセッションのゴール ＝ フラット化 サブ②（白フラット default テーマ）
**まず親 spec を再読 → サブ②を brainstorm（見た目はモックで確認してから）→ spec→plan→サブエージェント駆動で実装。**
- 新テーマ「白フラット・エディトリアル」を `THEME_REGISTRY` に追加し **`DEFAULT_THEME_ID` を差し替え**（LP と呼応）。
- 詰める点（親 spec §48）：具体パレット（LP トークン対応）、**静かなメーターの見せ方**、**モーション“無し”の定義**（登場/テキスト/退場）。
- サブ⑥（Task6）で **ThemePicker/ThemeCustomizeSection に残る色トークン**（`--text-meta`/`--color-glass-*` 等）を白フラットに合わせて中立/調整（サブ①で「serif/羊皮紙化はしない」までは済・色の byte 中立は②送り）。
- メニューの新意匠（フラットで明るい chrome）を白盤面に合わせて決めるならこの回（サブ①で構造は完成済み・中立の“今の暗い姿”のまま）。

## サブ①の残り follow-up（非ブロッキング・次以降）
- **N-07 e2e**：`board-b0.spec.ts` の IDB seed 版数ズレ（`open(db,9)` vs `DB_VERSION=16`）でこの spec が実行不能。セレクタは右ドロワー用に更新済だが**未実行検証**。seed を現行スキーマへ。
- **SharedBoard.tsx**（受け取り画面）：TUNE と SHARE が独立 state で同時に開き得る（`activeDrawer` 統一が無い）。稀な組合せ・低優先。
- **ChromeButton.test.tsx**：paper 削除で書き直した describe が薄い（textContent 不変のみ）。
- 分解の残り：③カスタマイズ拡張（角丸 ON/OFF＋N-35 つまみ）／④音波テーマ命名＋N-33 タグ表記。

## その他の保留（従来どおり）
- **Mac 実機の目視**（フルスクリーン保存カード＋N-30 ピル）。
- **拡張の再審査は束ねる**：N-25（済）＋N-28 Pinterest＋N-29 設定導線 を1回で。
- **ローンチ前必須**：(1)スマホ本格対応（最優先・未着手）(2)端末間同期（案B・スパイク緑）(3)見せ用共有ボード (4)翻訳/法務レビュー。

## 守ること（毎回）
- 見た目変更は ui-design.md 準拠＋実機（Playwright）検証してからデプロイ。テーマ作業前に `reference_theme_system_foundation` と親 spec を読む。
- web 変更は deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`。
- 機微情報は `docs/private/` のみ。マージ後は生 `git log --graph`。応答は日本語・簡潔・平易。PopOut/PiP 等は正式名で呼ぶ。
