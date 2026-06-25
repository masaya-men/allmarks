# 次セッションのゴール (= セッション 134)

## 今の状態（セッション133で完了）
paper-atelier を **「CSS擬似」→「本物の紙PNG素材」** に置換するフル再現を実装し、`allmarks.app` に本番反映済み。8タスクをサブエージェント駆動（各タスク二段レビュー＋fix）→ opus 全ブランチレビュー Ready to merge（0 Critical/0 Important）→ master `d25db58` → デプロイ。tsc0 / vitest 1786 / build OK。default(黒+音波)は byte-identical。素材未配置の面は CSS見た目に graceful degrade。

## user 宿題（最優先・実機校正）
allmarks.app をハードリロード → SETTINGS → THEMES → Paper Atelier で実機確認し、フィードバック：
1. **素材バリエーション選択**: 定規帯 v1/v2・サム v1/v2・蝋封（赤封蝋 vs 濃色）・カード台紙の色味・foxing 重ねの要否。
2. **寸法校正**: 定規トラック高(今 34px)・カード台紙の余白(今 padding 6%)・セリフ署名サイズ・背景ヴィネット強度。
→ 全部トークン/マニフェスト差し替えで寄せられる（今は初期値）。

## 次にやる
1. **残り2素材を生成して配置**: `parchment-bg`(背景の継ぎ目なし羊皮紙タイル／不透明OK、`Downloads/素材/` 由来 or 再生成) と `letterpress-ink-grain`(ワードマークのかすれ＝黒地に白インク、継ぎ目なし)。配置=`public/themes/paper-atelier/<id>.png` に置き、`lib/board/paper-assets.ts` を `true`(または CSS トークンを `url(...)`)に。
2. **user 校正フィードバックを反映**(バリエーション/寸法トークン微調整 → 再デプロイ反復)。
3. **メーター状態差の磨き**(spec§3.3 04: hover でタブ浮き影／ドラッグ中インク濃度up／慣性減速／エンドストップ) ＝ 段階追加。
4. その後 **Plan 3＝共有のテーマ化**(SharedBoard が `data-theme-id` 未適用＝paper トークンが /s/ で cascade しない、spec§6) → #1 white-sector・#5 celestial-atlas 量産(素材は先取り生成済)。

## 守ること
- 本番 `allmarks.app`。default(黒+音波) は **byte-identical** 維持。**自由リサイズは壊さない**。装飾/署名は pointer-events:none・極端サイズでクランプ。常時 canvas/GPU/backdrop-filter 禁止。
- 保留素材トークンは **`none` でなく `initial`**(var フォールバックの罠)。
- deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`、`--branch=master --commit-message`(ASCII)。応答は日本語。
- 視覚は user が直接確認(スクショ撮影に手を割かない)[[feedback_user_self_verifies_visuals]]。
- フォローアップ(TODO): e2e シード v9→16、useTweetTranslation 引数リネーム、4K perf watch。既知フレーキー channel.test。
