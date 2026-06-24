# 次セッションのゴール (= セッション 133)

## 重要な方針転換（セッション132で確定）
Plan 2（トークンで色替え＋飾りを重ねる「スキン」）を本番反映したが、**user 評価＝「あのモックと全く同じ質感じゃないと嫌、完全再現には程遠い」**。
→ **本物の紙テクスチャ素材（GPT生成の透明PNG）を使って各面を“紙そのもの”に作り直す**フル再現へ方針転換。**設計は承認済み**。

## 正本ドキュメント
- 設計: [docs/superpowers/specs/2026-06-25-paper-atelier-full-fidelity-design.md](superpowers/specs/2026-06-25-paper-atelier-full-fidelity-design.md)（承認済の4決定込み：①カードに**セリフ署名(title)あり** ②ヘッダー=**Fraunces セリフ＋Caveat 手書き** ③ヘッダーのモーション=**RGBグリッチ廃止→穏やかなインク演出** ④メーター状態差は段階追加）。
- 素材プロンプト: [docs/private/theme-mockups/ASSET-BRIEF.md](private/theme-mockups/ASSET-BRIEF.md)（gitignored）。

## 素材の状況（最重要）
- **方式確定**: GPT は「透明」指定でも**市松模様を絵として描く偽透明**を出すことがある→ **本物の透明PNG**で出せた（user 成功）。出ない時は「アートに無い単色ベタ塗り背景」で出して私がキー抜き。
- **装飾シート(3) = 完了**: 自動スライサ（`<scratchpad>/slice.cjs`、sharp を絶対パス require、透明の連結成分で分割）で**17パーツに切り出し→ id 名で staging 済**：`docs/private/theme-mockups/_sliced/` に `washi-tape-1..5` / `push-pin-gold,green` / `paper-clip` / `photo-corner-1..4` / `stamp-circular,rect,oval` / `wax-seal-a` / `mk1-plate`。
- **⏳ user 宿題 = (4)メーター素材を“本物の透明PNG”で作り直し**（`meter-paper-strip` 折れ/かすれの紙帯 ＋ `meter-paper-thumb` 紙片タブ）。同方式でOK。来たら私が slice/配置。
- (1)`parchment-bg` は不透明でOK（`C:/Users/masay/Downloads/素材/` にある）。card-mat は任意（私が処理 or 後で透明再生成）。
- 他テーマ素材（celestial-atlas / liquid-chrome）も先取り生成済み（`Downloads/素材/` 等、後の #5/#4 用）。

## 次にやる
1. **`writing-plans` で実装計画**を起こす（設計承認済）。素材は id 参照＋**未配置でも壊れない graceful degrade**。
2. 実装（**カード=羊皮紙台紙＋印刷写真インセット＋セリフ署名＋実装飾PNG** が最大の山 → メーター → chrome 書体/インク演出 → 活版ワードマーク → MK-1/蝋封）。各面、素材が揃った所から本番反映。
3. liquid-chrome(#4) の流体演出に three-fluid-fx / WebGL 流体を後で本気検討（user 提案、#4 のテーマそのもの）。paper では使わない（常時GPU=性能制約）。

## 守ること
- 本番 `allmarks.app`。default(黒+音波) は **byte-identical** 維持。**自由リサイズは壊さない**（装飾/署名は極端サイズでクランプ）。装飾は pointer-events:none で操作非干渉。常時 canvas/GPU/backdrop-filter 禁止。
- deploy 前 `rtk tsc && rtk vitest run && rtk pnpm build`、`--branch=master --commit-message`(ASCII)。応答は日本語。
- 視覚は user が直接確認（スクショ撮影に手を割かない）[[feedback_user_self_verifies_visuals]]。
- 既知フレーキー `tests/lib/channel.test.ts`。フォローアップ: (N-07) e2e シード v9→16、useTweetTranslation 引数リネーム、4K perf watch（TODO.md）。
