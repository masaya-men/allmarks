# 次セッションのゴール (= セッション 110)

## 今のゴール (1 行)

**✅ セッション 109 で「LP多言語化(層②)第1段 + LPスクロール演出 + タイトル多言語化 + コピー調整」を全完了し master マージ・本番反映済。次は (1) 残りの小フォロー(z-index トークン統一など)か、(2) 第2段=紹介ページ群の多言語化+新デザイン、のどちらかに着手。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 109)」を読む
2. `git branch --show-current` で確認(master に居るはず。feat/lp-i18n-layer2-phase1 はマージ済)
3. ユーザーに方向確認(下の選択肢)

## 選べる次の方向

### (1) LP 仕上げの小フォロー(軽い・1セッション未満)
- **z-index トークン統一**: `components/marketing/Features.module.css` の literal `z-index:1/2`、`SiteHeader.module.css` の `z-index:100` を `landing-tokens.css` のトークンへ。値は不変(見た目変化なし)。
- Hero の `useReveal` + 入場 timeline の二重作用を掃除(`data-entrance-done` の死にコメント解消。見出しを useReveal 対象から外し、入場 timeline 専任に)。
- LP 配下 GSAP import の静的/動的混在を統一。
- スマホ幅のスクロール演出最適化(今は非PC幅では静的フォールバック。横ジャック等のモバイル版を検討)。

### (2) 第2段=紹介ページ群(大きい・別 spec)
- faq/about/features/guide/privacy/terms/contact/extension の**中身書き直し+新デザイン+15言語化**。土台(層②の URL/SEO/言語ボタン)は第1段で完成済なので乗せるだけ。層②設計書 `specs/2026-06-18-lp-i18n-layer2-design.md` §2 の線引き参照。brainstorming→spec→plan→サブエージェント駆動で。

## 直近セッションで確立した重要ルール(踏襲)
- **可視性をアニメに依存させない**: 要素の表示/非表示は state の純粋関数。CSS 既定=見える、アニメの非表示初期値(opacity:0 等)は `gsap.matchMedia('(min-width:1024px) and (prefers-reduced-motion: no-preference)')` 内の `gsap.set` のみに閉じ、`clearProps`/revert で戻す。reduced-motion/非PC/SSR で必ず見える。
- **GSAP pin は `position: absolute` 要素に使うと壊れる**。全画面オーバーレイ的な見せ場は CSS `position`(sticky/relative)+ z-index で組む方が堅実。
- スクロール演出は本番(allmarks.app)に小刻みデプロイしてユーザー実機で calibration するのが正解(jsdom では検証不可)。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。
- `tsc <file>` 直叩き禁止(stray `.js`)→ `rtk tsc`。静的出力は flat file(`out/ja.html`)・属性は `hrefLang`(キャメル)。
- アプリ本体(`/board` `/s/*` `/save`)に言語接頭辞を付けない。`DB_NAME` 等の内部符号は不変。
- 翻訳の固定値 verbatim(footer 英語/AllMarks/X/YouTube/`#AllMarks`/placeholder)。デザイン変更は提案→承認。傾け・回転は禁止。
