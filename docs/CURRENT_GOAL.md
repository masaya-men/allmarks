# 次セッションのゴール (= セッション 108)

## 今のゴール (1 行)

**🎉 session 107 完了・本番反映済 (`allmarks.app`)・user 確認済: LP を白基調・編集的・スクロール演出で全面作り直し(フェーズ1)。Hero(製品ボード風ビジュアル + 奥行きパララックス)→ Problem → FEATURES 01–05(LIVE GRID は本物の NASA 動画を画面内で同時再生)→ Share → 白→黒に暗転する最終CTA → 黒フッター。CC0 の名画16点 + NASA動画3本で「本物のおしゃれなボード」を表現。傾けない・グリッド整列・偽メタデータなし。`landing.*` に英語(既定)+日本語コピー。LP は当面**英語固定**(provider 外 = 英語フォールバック)で、**多言語化=層②は次回**。次は層②(LP の言語別URL `/ja` `/zh`・hreflang・sitemap・15言語翻訳)or onboarding or 拡張ストア素材。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 107)」を読む
2. **本番は `allmarks.app`**(deploy は `out/` を `--project-name=allmarks --branch=master`、commit message は ASCII)
3. user に「次は LP多言語化(層②)/ onboarding / 拡張ストア素材 のどれにする?」を確認

## session 107 で確定したこと(user 確認済)
- **LP 全面作り直しを本番 ship**。設計 `docs/superpowers/specs/2026-06-17-lp-redesign-design.md` / 計画 `docs/superpowers/plans/2026-06-17-lp-redesign.md`。
- **構成 6 ブロック**(user 採用コピー、ミニマル文体): HERO / PROBLEM / FEATURES(01 CAPTURE / 02 LAYOUT / 03 LIVE GRID / 04 ORGANIZE / 05 PRIVACY)/ SHARE / FINAL CTA(暗転)+ 黒フッター。
- **AllMarks 視覚原則を確立(記憶化済 [[feedback_allmarks_grid_no_tilt]])**: グリッド配置が基本・**カードを傾けない**・画像は大胆に・偽メタデータを付けない(本物のボードは画像カードにドメインラベルを出さない)。
- **デモ素材**: CC0 名画16点(Art Institute of Chicago)+ NASA パブリックドメイン動画3本(`lib/marketing/demo-collage.ts` + `public/marketing/collage/`)。LIVE GRID は IntersectionObserver で画面内のみ再生・reduced-motion はポスター静止。
- **新フォント**: 見出しに Fraunces(セリフ)を `next/font/google` で追加。LP トークンは `components/marketing/landing-tokens.css` の `.lpRoot`(白 `#faf9f6` / インク `#14130f` / 緑 `#28F100` / serif / sans / maxw 1489)。
- **🔴 ダーク強制バグの教訓 [[reference_lp_light_color_scheme]]**: LP は意図的に白。だが app の `<html data-theme="dark">` 既定 + ブラウザの自動ダーク(Chrome Auto Dark / Dark Reader)で白ページが暗転して見えた。対処 = `.lpRoot { color-scheme: light }` + LandingPage マウント中は `<html data-theme="light">`(離脱で dark 復帰)。**白い LP を作るときは必ず light を明示宣言する**。
- **`ThemeToggle.tsx` は消さない**: LP ヘッダーからは外したが、`app/(marketing)/layout.tsx`(/features /guide 等の静的ページ)が今も使用中。

## 次の候補
- **i18n 層②(LP 多言語化)** ← 多言語集客の本丸。`app/[locale]/` で素URL=英語 + `/ja` `/zh`…+ hreflang + 言語別 sitemap。`landing.*` の日本語は作成済(ja.json)、残り13言語の LP 翻訳が必要。設計図は spec §5 / 旧 i18n spec 参照。
- **onboarding**(初回案内)
- **拡張ストア公開素材**(スクショ・説明文・`EXTENSION_STORE_URL` 投入)
- **LP 残債(任意・非ブロッキング)**: `useReveal` の `RefObject` キャストをフック signature 修正で一掃 / Hero ghost CTA の死んだ `#save-demo` fallback 除去 / NASA aurora 動画の焼き込みクレジット文言が気になるなら別クリップに差し替え。

## 守ること
- **本番は allmarks.app**。deploy 前 `npx wrangler whoami`、tsc + vitest 通してから。実機/本番で測ってから「動いてる」と報告
- 発明しない・本物の部品を流用。横文字を日本語応答に混ぜない。AskUserQuestion ボックス禁止。デザイン変更は提案→承認→実装
- **AllMarks 視覚原則**: グリッド整列・傾けない・画像大胆・偽メタデータ禁止
- `DB_NAME='booklage-db'`・固定英語語彙・窓名等の不可視/固定符号は**永久に維持**
- i18n: 新 key は en/ja 同期(層②着手時に15言語へ展開)。LP は当面英語固定
