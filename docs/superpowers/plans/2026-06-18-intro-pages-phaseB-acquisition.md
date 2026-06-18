# 紹介ページ群 フェーズB(集客ページ: features/guide/faq/extension) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 集客4ページ(Features / Guide / FAQ / 新設 Extension 紹介)を、フェーズA の土台(`MarketingShell` / `pageMetadata` / `navHref`+`LOCALIZED_INTRO_SUBPATHS` / `pages.*` 名前空間)に乗せ、内容を現行プロダクトの事実に書き直し・編集デザイン統一・15言語化・英語フラット+`[locale]`生成・sitemap 追加する。

**Architecture:** フェーズA の About 縦切りで確立した型をそのまま横展開する。各ページは共有本文部品 `components/marketing/pages/<Page>Content.tsx`(client、`useI18n().t('pages.<page>.*')`)を、英語フラット経路(`app/(marketing)/<page>/page.tsx`)と14言語経路(`app/[locale]/<page>/page.tsx`)の双方が `I18nProvider`+`MarketingShell` で巻く。編集デザインは新設の共有 CSS モジュール `intro-page.module.css`(About の LP グラマーを一般化)に集約し DRY 化する。reveal の小残債(useReveal と CSS ゲートの非対称)を先に直してから全ページに乗せる。

**Tech Stack:** Next.js 14 App Router(`output: 'export'`)、TypeScript strict、Vanilla CSS Modules、Vitest、GSAP(`lib/scroll/use-reveal` のみ流用)。

## Global Constraints

- **応答・コメントは日本語**。UI 表示テキストは世界共通英語語彙 + 翻訳ファイル。金額は¥(本タスクでは金額表記なし)。
- `output: 'export'`(完全静的)。`[locale]` 配下は `generateStaticParams` で全14 locale を作り置き。`dynamicParams = false`。未対応 locale は `notFound()`。
- **英語はフラット URL**(`/features`)、**他14言語は `/<locale>/features`**。`SUPPORTED_LOCALES`(15、並び= `ja,en,zh,ko,es,fr,de,pt,it,nl,tr,ru,ar,th,vi`)、`PREFIXED_LOCALES`= en を除く14。
- **アプリ本体(`/board` `/triage` `/s/*` `/save` `/save-iframe` `/api`)に接頭辞を付けない**。`DB_NAME='booklage-db'` 等の不可視符号は不変。
- 15言語ファイルの固定英語語彙・placeholder・絵文字・キーコンボ・`#AllMarks` は全言語 verbatim。新規キーは15言語でキー構造完全一致。`pages.<page>.cta.button` = `Open Board`(全言語 verbatim)。
- **コピーは現行コードの事実から書く**(spec §6.1・推測抑制5原則)。確定済みの事実(本計画の §確定済みプロダクト事実 を参照)に反する主張を書かない。
- **可視性をアニメに依存させない**(CSS 既定=可視、非表示初期値は `matchMedia('(prefers-reduced-motion: no-preference) and (min-width:1024px)')` 内 + reduced-motion/narrow は静的可視)。**傾け・回転禁止**・グリッド整列・偽メタデータ禁止・AI っぽい青紫グラデ禁止(`.claude/rules/ui-design.md`)。
- ダーク強制対策: `MarketingShell` が mount 中 `<html data-theme="light">`+`color-scheme:light` を設定(既存・流用するだけ)。
- **404 回避の順序制約**: `LOCALIZED_INTRO_SUBPATHS` への追加(= nav 言語接頭辞化)は、当該ページの `[locale]` 経路が**全14言語ぶん生成・翻訳済みになった後**(Task 8)に行う。それまで nav はフラットのまま(navHref が未登録 subpath をフラットに落とす)。
- **本番デプロイ**(セッション末): `npx wrangler whoami` → `rtk pnpm build` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message "<ASCII>"`。`tsc <file>` 直叩き禁止 → `rtk tsc`。

---

## 確定済みプロダクト事実(コピー執筆の唯一の根拠・コード検証済み)

実装者はコピーを書くとき**この事実のみ**に従う。記憶や旧紹介文を鵜呑みにしない。

- **テーマは2種のみ**: `dotted-notebook`(既定)/ `grid-paper`(`lib/board/theme-registry.ts:3-16`、`DEFAULT_THEME_ID='dotted-notebook'`)。「リキッドグラス」テーマは**存在しない**(書かない)。
- **カードサイズ = 連続リサイズ + 名前付きプリセット**: 連続スライダー 80–480px(既定240、`lib/board/size-migration.ts:1-3`)+ 5プリセット `DENSE/TIGHT/DEFAULT/OPEN/AMBIENT`(`lib/board/tune-presets.ts:21-27`)。**「S/M/L」「サイズ1–5」は UI に無い**(書かない)。コピーは「密度プリセット(DENSE〜AMBIENT)+ どのカードも自由にリサイズ」と表現。
- **表示モード3種健在**: `visual` / `editorial` / `native`(`lib/board/types.ts:76`、per-card override 可 `lib/storage/indexeddb.ts:63-64`)。
- **タグ**: 既定アルファベット昇順(`DEFAULT_TAG_ORDER_MODE='auto-asc'`、`lib/board/tag-order.ts:14-17`)+ 昇順/降順トグル + 手動ドラッグ順。インライン編集(`InlineTagRenameInput.tsx`)・直接ドラッグ並べ替え。
- **再生 = フォーカスで1本が生きて再生 + 周りは静止画でゆらめく**(`CardsLayer.tsx:85` `HERO_CAP = 1`、15秒交代 `HERO_PER_CARD_MS=15000`、非ヒーローは `CardSlideshow.tsx` の静止画クロスフェード)。**「複数同時再生」と書かない**(ユーザー承認済みの正直な言い回し)。MOTION トグルで全停止(`MotionToggle.tsx`)。
- **音波モチーフ**: ScrollMeter / WaveformTrack が既定テーマの世界観(`ScrollMeter.tsx`、`WaveformTrack.tsx`)。
- **保存の3経路**: (1) **URL貼り付けが主役**(ボードに URL をペースト)、(2) ブックマークレット(固定 256×256 の `/save` 窓に Saved / Already saved / Failed、`SaveToast.tsx`)、(3) Chrome 拡張(`extension/manifest.json` version `0.1.20`、ワンクリック/右クリック/ショートカット保存)。
- **共有**: `/s/<id>`(6文字 base62)= KV に共有データ(TTL 30日)+ R2 に OG 画像(JPEG、`/api/share/<id>/og`)。**サーバーにユーザー DB は無い**(`lib/share/*`、`functions/api/share/*`)。加えて PNG 書き出し(canvas、`lib/share/capture-mirror.ts`)+ X シェア。
- **拡張ストア URL は空**: `EXTENSION_STORE_URL = ''`(`lib/board/constants.ts:32`)。空の間は「ストア準備中・今はブックマークレットで使える」を出し、死んだリンクを出さない。
- **対応サイト/インライン再生**(`lib/utils/url.ts:23-32`): X/ツイート(react-tweet)・YouTube(Shorts 含む)・TikTok・Vimeo・SoundCloud は**ボード上でインライン再生**。**Instagram は埋め込み不可**で元ページへのリンクアウト(業界共通の制約、`url.ts:119-121`)。一般サイトはサムネイル。
- **プライバシー = ローカル完結**: IndexedDB のみ、サーバー DB なし、アカウント不要、追跡 Cookie なし(Cloudflare の匿名サーバ指標のみ)。

---

## File Structure

新規:
- `components/marketing/pages/intro-page.module.css` — 集客ページ共有の編集 CSS グラマー(About のクラス体系を一般化、reveal ゲートを useReveal と対称化)。
- `components/marketing/pages/FeaturesContent.tsx` — Features 本文(client、`pages.features.*`)。
- `components/marketing/pages/GuideContent.tsx` — Guide 本文。
- `components/marketing/pages/FaqContent.tsx` — FAQ 本文。
- `components/marketing/pages/ExtensionContent.tsx` — Extension 紹介本文(EXTENSION_STORE_URL 空対応バナー)。
- `app/[locale]/features/page.tsx`、`app/[locale]/guide/page.tsx`、`app/[locale]/faq/page.tsx`、`app/[locale]/extension/page.tsx` — 14言語サーバーラッパ。
- `app/(marketing)/extension/page.tsx` — 英語 Extension 紹介(新設)。
- `messages/pages-acquisition-parity.test.ts` — features/guide/faq/extension の15言語キーパリティ + `cta.button` verbatim テスト。
- `app/sitemap.test.ts`(無ければ新規) — 集客4ページの sitemap エントリ検証。

改修:
- `lib/scroll/use-reveal.ts` — matchMedia の no-preference ブランチに `and (min-width:1024px)` を付け、narrow を静的可視に(CSS ゲートと対称化)。
- `app/(marketing)/{features,guide,faq}/page.tsx` — `LegacyMarketingChrome` 版を provider + `MarketingShell` + `<Page>Content` 版に作り直し。
- `messages/{en,ja}.json` — `pages.{features,guide,faq,extension}.*` を人手で追加(基準構造)。
- `messages/{zh,ko,es,fr,de,pt,it,nl,tr,ru,ar,th,vi}.json`(13) — 同4ページを翻訳。
- `lib/i18n/locale-urls.ts` — `LOCALIZED_INTRO_SUBPATHS` に `features/guide/faq/extension` を追加(Task 8、全ページ生成後)。
- `app/sitemap.ts` — features/guide/faq/extension を15言語エントリに拡張。
- `docs/TODO.md` / `docs/CURRENT_GOAL.md` / `docs/TODO_COMPLETED.md`(Task 9)。

**注**: `app/(marketing)/extension/privacy/page.tsx`(法務C)は本フェーズでは**触らない**(`LegacyMarketingChrome` のまま)。Extension 紹介ページからのプライバシーリンクはフラット `/extension/privacy` を指す(Phase C で言語化)。

---

## Task 1: `useReveal` のゲートを CSS と対称化(reveal 小残債の回収)

**Files:**
- Modify: `lib/scroll/use-reveal.ts`

**Interfaces:**
- Produces: `useReveal(ref, opts)` — 既存シグネチャ不変。挙動変更のみ: no-preference のフェード演出を **PC幅(>=1024px)に限定**し、narrow/reduced-motion は静的可視。

**狙い**: 現状 useReveal は `(prefers-reduced-motion: no-preference)` のみで幅ゲート無し。一方 CSS の非表示初期値は `no-preference and (min-width:1024px)`。この非対称で 768–1023px の PC で「CSS は可視のまま → JS が opacity:0 から fade」して一瞬チラつく。useReveal 側に `and (min-width:1024px)` を足し、narrow は静的可視にして対称化する。LP/About も同じ 1024px ゲートなので副作用は「narrow で演出しない(=元から静的意図)」だけ。

- [ ] **Step 1: 幅ゲートを追加**

`lib/scroll/use-reveal.ts` の matchMedia ブロックを以下に置換:
```ts
    const mm = gsap.matchMedia()
    // reduced-motion または narrow(<1024px)は静的に可視(演出は PC のみ)。
    mm.add('(prefers-reduced-motion: reduce), (max-width: 1023px)', () => {
      gsap.set(targets, { opacity: 1, y: 0 })
    })
    mm.add('(prefers-reduced-motion: no-preference) and (min-width: 1024px)', () => {
      const tween = gsap.fromTo(targets, { opacity: 0, y },
        { opacity: 1, y: 0, duration: 0.8, stagger, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 75%' } })
      return () => { tween.scrollTrigger?.kill(); tween.kill() }
    })
    return () => mm.revert()
```

- [ ] **Step 2: tsc + 既存テスト + build**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0、既存テスト全 PASS(useReveal は gsap/matchMedia 依存で jsdom 単体テスト対象外 = 既存もテスト無し。挙動は本番 calibration で確認)、build 成功。

- [ ] **Step 3: Commit**

```bash
rtk git add lib/scroll/use-reveal.ts
rtk git commit -m "fix(reveal): gate useReveal fade to PC width (>=1024px), symmetric with CSS"
```

---

## Task 2: 集客ページ共有 CSS グラマー `intro-page.module.css`

**Files:**
- Create: `components/marketing/pages/intro-page.module.css`

**Interfaces:**
- Produces: CSS Modules クラス群(全 `<Page>Content` が import して使う):
  - レイアウト: `root`, `hero`, `kicker`, `kickerDot`, `title`, `lead`
  - 番号付きセクション: `sections`, `section`, `sectionIndex`, `sectionNum`, `sectionTick`, `sectionBody`, `heading`, `body`, `note`, `link`
  - Q&A: `qaList`, `qa`, `qaQ`, `qaA`
  - 状態バナー(Extension 準備中): `banner`, `bannerHeading`, `bannerBody`
  - 閉じ CTA: `cta`, `ctaRule`, `ctaHeading`, `ctaLink`, `ctaArrow`
- reveal ゲートは `.root [data-reveal]`(`.root` はスコープ済みなので他ページに漏れない)を `(no-preference) and (min-width:1024px)` で opacity:0、reduce で opacity:1。

**狙い**: About の `AboutContent.module.css` の LP グラマー(白 #faf9f6、Fraunces 見出し weight300、Geist body、緑アクセント1点、グリッド整列・傾けない、px clamp)を再利用可能な共有モジュールに一般化。4ページで重複 CSS を作らない(DRY)。

- [ ] **Step 1: ファイル作成**

`components/marketing/pages/intro-page.module.css`:
```css
/* intro-page.module.css
   集客紹介ページ(features/guide/faq/extension)共有の編集グラマー。
   About の AllMarks LP グラマーを一般化: 白 off-white 地、ink 文字、Fraunces 見出し
   (weight 300, tight tracking)、Geist body、緑アクセント(--lp-accent)1点。
   グリッド整列・傾け/回転なし。px ベース clamp() で dev desktop サイズに上限。

   可視性はアニメ非依存: 全要素 opacity:1 が既定。.root [data-reveal] のみ
   matchMedia(no-preference + 1024px)内で opacity:0 にし useReveal が fade。
   reduced-motion / narrow / SSR では opacity:1 を強制(useReveal Task 1 と対称)。 */

.root {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: clamp(72px, 12vw, 132px) 40px clamp(40px, 8vw, 96px);
  box-sizing: border-box;
}

/* Hero */
.hero { margin-bottom: clamp(56px, 10vw, 116px); }

.kicker {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 28px;
  font-family: var(--font-geist-mono), ui-monospace, 'SFMono-Regular', monospace;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--lp-ink-soft);
}

.kickerDot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--lp-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--lp-accent) 16%, transparent);
}

.title {
  margin: 0;
  font-family: var(--lp-serif);
  font-weight: 300;
  font-size: clamp(38px, 6.6vw, 72px);
  line-height: 1.04;
  letter-spacing: -0.03em;
  color: var(--lp-ink);
  text-wrap: balance;
}

.lead {
  max-width: 34ch;
  margin: clamp(24px, 3.6vw, 38px) 0 0;
  font-family: var(--lp-serif);
  font-weight: 300;
  font-size: clamp(20px, 2.6vw, 28px);
  line-height: 1.4;
  letter-spacing: -0.012em;
  color: var(--lp-ink-soft);
  text-wrap: pretty;
}

/* Numbered editorial sections */
.sections { border-top: 1px solid color-mix(in srgb, var(--lp-ink) 12%, transparent); }

.section {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: clamp(20px, 4vw, 56px);
  padding: clamp(36px, 6vw, 64px) 0;
  border-bottom: 1px solid color-mix(in srgb, var(--lp-ink) 12%, transparent);
}

.sectionIndex {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-top: 4px;
}

.sectionNum {
  font-family: var(--lp-serif);
  font-weight: 300;
  font-size: clamp(26px, 3.4vw, 38px);
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--lp-ink);
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

.sectionTick {
  display: block;
  width: 28px;
  height: 3px;
  margin-top: 16px;
  border-radius: 999px;
  background: var(--lp-accent);
}

.sectionBody { min-width: 0; }

.heading {
  margin: 0;
  font-family: var(--lp-serif);
  font-weight: 300;
  font-size: clamp(24px, 3.2vw, 34px);
  line-height: 1.12;
  letter-spacing: -0.02em;
  color: var(--lp-ink);
  text-wrap: balance;
}

.body {
  max-width: 62ch;
  margin: clamp(14px, 1.6vw, 20px) 0 0;
  font-family: var(--lp-sans);
  font-size: clamp(16px, 1.4vw, 18px);
  line-height: 1.72;
  letter-spacing: -0.005em;
  color: var(--lp-ink-soft);
  text-wrap: pretty;
}

/* 誠実な制約開示など、本文に添える控えめな注記 */
.note {
  max-width: 62ch;
  margin: clamp(12px, 1.4vw, 16px) 0 0;
  font-family: var(--lp-sans);
  font-size: clamp(14px, 1.2vw, 15px);
  line-height: 1.66;
  color: color-mix(in srgb, var(--lp-ink-soft) 78%, transparent);
}

.link {
  color: var(--lp-ink);
  text-decoration: none;
  background-image: linear-gradient(var(--lp-ink), var(--lp-ink));
  background-repeat: no-repeat;
  background-position: 0 100%;
  background-size: 100% 1px;
  padding-bottom: 1px;
  transition: background-size 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.link:hover { background-image: linear-gradient(var(--lp-accent), var(--lp-accent)); }

/* Q&A (FAQ) */
.qaList { border-top: 1px solid color-mix(in srgb, var(--lp-ink) 12%, transparent); }

.qa {
  padding: clamp(28px, 4.4vw, 44px) 0;
  border-bottom: 1px solid color-mix(in srgb, var(--lp-ink) 12%, transparent);
}

.qaQ {
  margin: 0;
  font-family: var(--lp-serif);
  font-weight: 300;
  font-size: clamp(20px, 2.6vw, 27px);
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--lp-ink);
  text-wrap: balance;
}

.qaA {
  max-width: 64ch;
  margin: clamp(12px, 1.4vw, 16px) 0 0;
  font-family: var(--lp-sans);
  font-size: clamp(16px, 1.4vw, 18px);
  line-height: 1.72;
  color: var(--lp-ink-soft);
  text-wrap: pretty;
}

/* 状態バナー(Extension ストア準備中) */
.banner {
  margin: 0 0 clamp(40px, 7vw, 72px);
  padding: clamp(22px, 3vw, 30px) clamp(24px, 3.2vw, 34px);
  border: 1px solid color-mix(in srgb, var(--lp-ink) 14%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--lp-accent) 7%, transparent);
}

.bannerHeading {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 10px;
  font-family: var(--font-geist-mono), ui-monospace, monospace;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--lp-ink);
}

.bannerBody {
  margin: 0;
  max-width: 60ch;
  font-family: var(--lp-sans);
  font-size: clamp(15px, 1.3vw, 17px);
  line-height: 1.66;
  color: var(--lp-ink-soft);
}

/* Closing CTA(About と同じ静かな ghost link) */
.cta { margin-top: clamp(72px, 12vw, 132px); text-align: center; }

.ctaRule {
  display: inline-block;
  width: 40px;
  height: 3px;
  border-radius: 999px;
  background: var(--lp-accent);
  margin-bottom: clamp(28px, 4vw, 40px);
}

.ctaHeading {
  margin: 0 0 clamp(22px, 3vw, 32px);
  font-family: var(--lp-serif);
  font-weight: 300;
  font-size: clamp(28px, 4.4vw, 52px);
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: var(--lp-ink);
  text-wrap: balance;
}

.ctaLink {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  font-family: var(--lp-sans);
  font-size: clamp(16px, 1.6vw, 18px);
  font-weight: 500;
  letter-spacing: -0.01em;
  text-decoration: none;
  color: var(--lp-ink);
  background-image: linear-gradient(var(--lp-ink), var(--lp-ink));
  background-repeat: no-repeat;
  background-position: 0 100%;
  background-size: 100% 1px;
  padding-bottom: 2px;
  transition: background-size 0.45s cubic-bezier(0.16, 1, 0.3, 1), color 0.3s ease;
}
.ctaLink:hover {
  color: color-mix(in srgb, var(--lp-ink) 86%, var(--lp-accent));
  background-image: linear-gradient(var(--lp-accent), var(--lp-accent));
}

.ctaArrow { display: inline-block; transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1); }
.ctaLink:hover .ctaArrow { transform: translate(3px, -3px); }

/* Reveal 初期状態(scoped、PC のみ。useReveal Task 1 と対称) */
@media (prefers-reduced-motion: no-preference) and (min-width: 1024px) {
  .root [data-reveal] { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .root [data-reveal] { opacity: 1; }
}

/* Responsive */
@media (max-width: 720px) {
  .root { padding: clamp(56px, 16vw, 96px) 24px 56px; }
  .hero { margin-bottom: clamp(44px, 13vw, 88px); }
  .section { grid-template-columns: 1fr; gap: 18px; }
  .sectionIndex { flex-direction: row; align-items: center; gap: 14px; padding-top: 0; }
  .sectionTick { margin-top: 0; }
}
@media (max-width: 420px) {
  .root { padding: 64px 20px 48px; }
}
```

- [ ] **Step 2: 健全性確認**

Run: `rtk pnpm build`
Expected: build 成功(まだ誰も import していないので影響なし、CSS 構文エラーが無いことの確認)。

- [ ] **Step 3: Commit**

```bash
rtk git add components/marketing/pages/intro-page.module.css
rtk git commit -m "feat(marketing): shared editorial CSS grammar for intro pages"
```

---

## Task 3: Features ページ(コピー en/ja + 部品 + 英語/locale 経路)

**Files:**
- Modify: `messages/en.json`、`messages/ja.json`
- Create: `components/marketing/pages/FeaturesContent.tsx`
- Modify: `app/(marketing)/features/page.tsx`
- Create: `app/[locale]/features/page.tsx`

**Interfaces:**
- Consumes: `useI18n()`、`intro-page.module.css`(Task 2)、`MarketingShell`、`I18nProvider`、`STATIC_MESSAGES`、`pageMetadata`、`PREFIXED_LOCALES`、`SUPPORTED_LOCALES`。
- Produces: `FeaturesContent(): React.ReactElement`(client)。`pages.features.*` キー構造(以後13言語がこれに一致):
  `meta.{title,description}` / `hero.{kicker,title,lead}` / `save.{num,heading,body}` / `board.{num,heading,body}` / `motion.{num,heading,body}` / `share.{num,heading,body}` / `privacy.{num,heading,body}` / `sites.{heading,body,note}` / `cta.{heading,button}`。

- [ ] **Step 1: `en.json` の `pages` に `features` を追加**

`messages/en.json` の `pages` オブジェクト(既存 `about` の隣)に追加。値(英語・確定コピー、§確定済みプロダクト事実 準拠):
```json
"features": {
  "meta": {
    "title": "Features",
    "description": "Save anything from the web and lay it out as a visual board. Inline playback, tags, instant sharing — all private, all in your browser."
  },
  "hero": {
    "kicker": "Features",
    "title": "Everything you save, made to look at.",
    "lead": "AllMarks keeps the things you love from across the web on one living, visual board — not a list you never open again."
  },
  "save": {
    "num": "01",
    "heading": "Save three ways",
    "body": "Paste a URL straight onto your board — that's the main way. Prefer one click? Use the bookmarklet that works in any browser, or the Chrome extension for one-tap saving from any page."
  },
  "board": {
    "num": "02",
    "heading": "A board you arrange",
    "body": "Cards sit on a clean grid — never tilted. Resize any card freely, or pick a density preset from DENSE to AMBIENT. Switch each card between visual, editorial, and native looks. Tag freely; tags sort alphabetically, or drag them into your own order."
  },
  "motion": {
    "num": "03",
    "heading": "A board that comes alive",
    "body": "As you browse, the video in focus plays for real while the others shimmer through still frames — so the board feels alive without ever turning into chaos. One switch, MOTION, calms it all to stillness whenever you want."
  },
  "share": {
    "num": "04",
    "heading": "Share in a link",
    "body": "Turn any board into a short link with a ready-made preview image for social. Or export it as a PNG and post it to X. Shared boards live on a link, not in an account."
  },
  "privacy": {
    "num": "05",
    "heading": "Private by default",
    "body": "Your bookmarks live in your browser, never on our servers. No account, no sign-up, no tracking cookies. It's free, and it stays yours."
  },
  "sites": {
    "heading": "Where it works",
    "body": "Posts from X, YouTube (including Shorts), TikTok, Vimeo, and SoundCloud play right on your board. Anything else is saved with a clean thumbnail.",
    "note": "Instagram can't be embedded by anyone outside Instagram, so those saves open the original page instead — we'd rather be honest than fake it."
  },
  "cta": {
    "heading": "Start your board.",
    "button": "Open Board"
  }
}
```

- [ ] **Step 2: `ja.json` の `pages` に同キー構造で日本語コピーを追加**

```json
"features": {
  "meta": {
    "title": "Features",
    "description": "Web で見つけたものを保存して、ビジュアルなボードに並べる。インライン再生・タグ・即共有 — すべてあなたのブラウザの中で、プライベートに。"
  },
  "hero": {
    "kicker": "Features",
    "title": "保存したものを、眺めて楽しいものに。",
    "lead": "Web 中のお気に入りを、生きて動く1枚のビジュアルボードに。二度と開かないリストにはしません。"
  },
  "save": {
    "num": "01",
    "heading": "3つの保存方法",
    "body": "URL をボードに貼り付ける — これが主役です。ワンクリックがよければ、どのブラウザでも使えるブックマークレット、または Chrome 拡張でどのページからもワンタップ保存できます。"
  },
  "board": {
    "num": "02",
    "heading": "自分で並べるボード",
    "body": "カードはきれいなグリッドに並びます — 傾けません。どのカードも自由にリサイズでき、DENSE 〜 AMBIENT の密度プリセットも選べます。各カードを visual / editorial / native の見た目で切り替え。タグは自由に付けられ、アルファベット順、または好きな順にドラッグできます。"
  },
  "motion": {
    "num": "03",
    "heading": "生きて動くボード",
    "body": "眺めるそばから、フォーカスにある動画が実際に再生され、ほかのカードは静止画でゆらめきます — 散らからずに、ボードが生きて見えます。MOTION のスイッチ1つで、いつでも静けさに戻せます。"
  },
  "share": {
    "num": "04",
    "heading": "リンクで共有",
    "body": "どのボードも、SNS 用のプレビュー画像つきの短いリンクにできます。PNG に書き出して X に投稿することも。共有ボードはアカウントではなくリンクに紐づきます。"
  },
  "privacy": {
    "num": "05",
    "heading": "最初からプライベート",
    "body": "ブックマークはサーバーではなくあなたのブラウザの中に。アカウントも登録も追跡 Cookie もありません。無料で、ずっとあなたのものです。"
  },
  "sites": {
    "heading": "対応している場所",
    "body": "X・YouTube(Shorts 含む)・TikTok・Vimeo・SoundCloud の投稿はボード上でそのまま再生されます。それ以外はきれいなサムネイルで保存されます。",
    "note": "Instagram は Instagram の外からは誰も埋め込めない仕様なので、その保存は元ページを開きます — ごまかさず正直にしています。"
  },
  "cta": {
    "heading": "あなたのボードを始めよう。",
    "button": "Open Board"
  }
}
```

- [ ] **Step 3: JSON 妥当性確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/ja.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: `FeaturesContent.tsx` を作る**

`components/marketing/pages/FeaturesContent.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useReveal } from '@/lib/scroll/use-reveal'
import styles from './intro-page.module.css'

/**
 * Features 本文(編集トーン・番号付きセクション)。
 * 文章は pages.features.* から。事実は §確定済みプロダクト事実に準拠(偽メタデータ・
 * 複数同時再生の誇張をしない)。可視性はアニメ非依存(CSS 既定で全要素可視、
 * data-reveal は PC のみ fade)。
 */
export function FeaturesContent(): React.ReactElement {
  const { t } = useI18n()
  const rootRef = useRef<HTMLElement>(null)
  useReveal(rootRef, { y: 24, stagger: 0.1 })

  const sections = ['save', 'board', 'motion', 'share', 'privacy'] as const

  return (
    <article ref={rootRef} className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker} data-reveal>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.features.hero.kicker')}
        </p>
        <h1 className={styles.title} data-reveal>{t('pages.features.hero.title')}</h1>
        <p className={styles.lead} data-reveal>{t('pages.features.hero.lead')}</p>
      </header>

      <div className={styles.sections}>
        {sections.map((key) => (
          <section key={key} className={styles.section} data-reveal>
            <div className={styles.sectionIndex}>
              <span className={styles.sectionNum}>{t(`pages.features.${key}.num`)}</span>
              <span className={styles.sectionTick} aria-hidden="true" />
            </div>
            <div className={styles.sectionBody}>
              <h2 className={styles.heading}>{t(`pages.features.${key}.heading`)}</h2>
              <p className={styles.body}>{t(`pages.features.${key}.body`)}</p>
            </div>
          </section>
        ))}

        <section className={styles.section} data-reveal>
          <div className={styles.sectionIndex}>
            <span className={styles.sectionNum}>06</span>
            <span className={styles.sectionTick} aria-hidden="true" />
          </div>
          <div className={styles.sectionBody}>
            <h2 className={styles.heading}>{t('pages.features.sites.heading')}</h2>
            <p className={styles.body}>{t('pages.features.sites.body')}</p>
            <p className={styles.note}>{t('pages.features.sites.note')}</p>
          </div>
        </section>
      </div>

      <section className={styles.cta} data-reveal>
        <span className={styles.ctaRule} aria-hidden="true" />
        <h2 className={styles.ctaHeading}>{t('pages.features.cta.heading')}</h2>
        <Link href="/board" className={styles.ctaLink}>
          {t('pages.features.cta.button')}
          <span className={styles.ctaArrow} aria-hidden="true">↗</span>
        </Link>
      </section>
    </article>
  )
}
```

- [ ] **Step 5: 英語 `/features` を作り直す**

`app/(marketing)/features/page.tsx`(`LegacyMarketingChrome` 版を全置換):
```tsx
import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { FeaturesContent } from '@/components/marketing/pages/FeaturesContent'
import { pageMetadata } from '@/lib/i18n/page-metadata'

export function generateMetadata(): Metadata {
  return pageMetadata('en', 'features', 'features')
}

export default function FeaturesPage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <MarketingShell locale="en" subpath="features">
        <FeaturesContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 6: 14言語 `app/[locale]/features/page.tsx` を作る**

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { FeaturesContent } from '@/components/marketing/pages/FeaturesContent'
import { STATIC_MESSAGES } from '@/lib/i18n/static-messages'
import { PREFIXED_LOCALES } from '@/lib/i18n/locale-urls'
import { pageMetadata } from '@/lib/i18n/page-metadata'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n/config'

export const dynamicParams = false

export function generateStaticParams(): Array<{ locale: string }> {
  return PREFIXED_LOCALES.map((locale) => ({ locale }))
}

function isPrefixedLocale(value: string): value is SupportedLocale {
  return value !== 'en' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) return {}
  return pageMetadata(locale, 'features', 'features')
}

export default async function LocaleFeatures({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) notFound()
  return (
    <I18nProvider initialLocale={locale} initialMessages={STATIC_MESSAGES[locale]}>
      <MarketingShell locale={locale} subpath="features">
        <FeaturesContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 7: tsc + build で英語/locale 経路を確認**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0、build 成功。`out/features.html`(英語・新編集デザイン)+ `out/ja/features.html` 等14本が生成。`out/features.html` の `<title>` に `AllMarks — Features`、canonical=`/features`、hreflang 16本。

- [ ] **Step 8: Commit**

```bash
rtk git add messages/en.json messages/ja.json components/marketing/pages/FeaturesContent.tsx "app/(marketing)/features/page.tsx" "app/[locale]/features/page.tsx"
rtk git commit -m "feat(features): rebuild Features (en+ja) on MarketingShell, fact-checked copy"
```

---

## Task 4: Guide ページ(コピー en/ja + 部品 + 英語/locale 経路)

**Files:**
- Modify: `messages/en.json`、`messages/ja.json`
- Create: `components/marketing/pages/GuideContent.tsx`
- Modify: `app/(marketing)/guide/page.tsx`
- Create: `app/[locale]/guide/page.tsx`

**Interfaces:**
- Produces: `GuideContent(): React.ReactElement`。`pages.guide.*` キー:
  `meta.{title,description}` / `hero.{kicker,title,lead}` / `start.{num,heading,body}` / `save.{num,heading,body}` / `arrange.{num,heading,body}` / `play.{num,heading,body}` / `share.{num,heading,body}` / `data.{num,heading,body}` / `trouble.{heading,body}` / `cta.{heading,button}`。

- [ ] **Step 1: `en.json` の `pages` に `guide` を追加**

```json
"guide": {
  "meta": {
    "title": "Guide",
    "description": "How to use AllMarks: save in three ways, arrange your board, play media, and share — start in about 30 seconds."
  },
  "hero": {
    "kicker": "Guide",
    "title": "Up and running in 30 seconds.",
    "lead": "No account, no setup. Open the board, save your first link, and start arranging."
  },
  "start": {
    "num": "01",
    "heading": "Open the board",
    "body": "Head to the board and you're in — nothing to sign up for. Copy a link from anywhere on the web and paste it straight onto the board to save your first card."
  },
  "save": {
    "num": "02",
    "heading": "Three ways to save",
    "body": "Pasting a URL is the main way. For one-click saving, drag the bookmarklet to your bookmarks bar — it works in every browser, including on your phone. On Chrome, the extension saves from any page in a tap."
  },
  "arrange": {
    "num": "03",
    "heading": "Make it yours",
    "body": "Click a card to open it full-size. Resize cards or pick a density preset, switch the visual / editorial / native look, and add tags. Drag cards and tags into the order you like — everything stays on a tidy grid."
  },
  "play": {
    "num": "04",
    "heading": "Watch it come alive",
    "body": "Videos from X, YouTube, TikTok, Vimeo, and SoundCloud play right on the board — the one in focus plays for real while the rest shimmer as stills. Toggle MOTION off any time for total quiet."
  },
  "share": {
    "num": "05",
    "heading": "Share your board",
    "body": "Make a short link with a preview image for social, or export the board as a PNG to post on X. Anyone with the link sees your board — no account needed on their end either."
  },
  "data": {
    "num": "06",
    "heading": "About your data",
    "body": "Everything is stored in this browser only. That means it won't follow you to another device or a private window, and clearing your browser data clears your boards. You can export a backup any time."
  },
  "trouble": {
    "heading": "If something looks off",
    "body": "A card stuck on a plain thumbnail usually just needs the page reloaded so it can fetch a fresh preview. If a bookmarklet save does nothing, re-add the bookmarklet — older copies can go stale after an update."
  },
  "cta": {
    "heading": "Open your first board.",
    "button": "Open Board"
  }
}
```

- [ ] **Step 2: `ja.json` の `pages` に同キー構造で日本語コピーを追加**

```json
"guide": {
  "meta": {
    "title": "Guide",
    "description": "AllMarks の使い方: 3つの保存方法、ボードの並べ方、メディア再生、共有 — 約30秒で始められます。"
  },
  "hero": {
    "kicker": "Guide",
    "title": "30秒で使い始められます。",
    "lead": "アカウントも初期設定も不要。ボードを開いて、最初のリンクを保存して、並べ始めましょう。"
  },
  "start": {
    "num": "01",
    "heading": "ボードを開く",
    "body": "ボードを開けばもう始まっています — 登録は何もありません。Web のどこかからリンクをコピーして、ボードに貼り付ければ最初のカードが保存されます。"
  },
  "save": {
    "num": "02",
    "heading": "3つの保存方法",
    "body": "URL の貼り付けが主役です。ワンクリック保存なら、ブックマークレットをブックマークバーにドラッグ — どのブラウザでも、スマホでも使えます。Chrome なら拡張機能でどのページからもワンタップ保存。"
  },
  "arrange": {
    "num": "03",
    "heading": "自分のものにする",
    "body": "カードをクリックすると全画面で開きます。カードをリサイズしたり密度プリセットを選んだり、visual / editorial / native の見た目を切り替えたり、タグを付けたり。カードもタグも好きな順にドラッグでき、いつもきれいなグリッドに収まります。"
  },
  "play": {
    "num": "04",
    "heading": "生きて動くのを眺める",
    "body": "X・YouTube・TikTok・Vimeo・SoundCloud の動画はボード上でそのまま再生されます — フォーカスの1本が実際に再生され、ほかは静止画でゆらめきます。MOTION をオフにすればいつでも完全な静けさに。"
  },
  "share": {
    "num": "05",
    "heading": "ボードを共有する",
    "body": "SNS 用のプレビュー画像つきの短いリンクを作るか、ボードを PNG に書き出して X に投稿できます。リンクを知っている人は誰でもボードを見られます — 相手にもアカウントは要りません。"
  },
  "data": {
    "num": "06",
    "heading": "データについて",
    "body": "すべてはこのブラウザの中だけに保存されます。つまり別の端末やシークレットウィンドウには引き継がれず、ブラウザのデータを消すとボードも消えます。バックアップはいつでも書き出せます。"
  },
  "trouble": {
    "heading": "うまくいかないとき",
    "body": "カードが素っ気ないサムネイルのままなら、たいていはページを再読み込みすれば新しいプレビューを取得できます。ブックマークレットで保存しても何も起きないときは、ブックマークレットを入れ直してください — 更新後に古いものが残っていることがあります。"
  },
  "cta": {
    "heading": "最初のボードを開こう。",
    "button": "Open Board"
  }
}
```

- [ ] **Step 3: JSON 妥当性確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/ja.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: `GuideContent.tsx` を作る**

`components/marketing/pages/GuideContent.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useReveal } from '@/lib/scroll/use-reveal'
import styles from './intro-page.module.css'

/**
 * Guide 本文(番号付きの手順 + 末尾にトラブル対処)。
 * 事実は §確定済みプロダクト事実に準拠。可視性はアニメ非依存。
 */
export function GuideContent(): React.ReactElement {
  const { t } = useI18n()
  const rootRef = useRef<HTMLElement>(null)
  useReveal(rootRef, { y: 24, stagger: 0.1 })

  const steps = ['start', 'save', 'arrange', 'play', 'share', 'data'] as const

  return (
    <article ref={rootRef} className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker} data-reveal>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.guide.hero.kicker')}
        </p>
        <h1 className={styles.title} data-reveal>{t('pages.guide.hero.title')}</h1>
        <p className={styles.lead} data-reveal>{t('pages.guide.hero.lead')}</p>
      </header>

      <div className={styles.sections}>
        {steps.map((key) => (
          <section key={key} className={styles.section} data-reveal>
            <div className={styles.sectionIndex}>
              <span className={styles.sectionNum}>{t(`pages.guide.${key}.num`)}</span>
              <span className={styles.sectionTick} aria-hidden="true" />
            </div>
            <div className={styles.sectionBody}>
              <h2 className={styles.heading}>{t(`pages.guide.${key}.heading`)}</h2>
              <p className={styles.body}>{t(`pages.guide.${key}.body`)}</p>
            </div>
          </section>
        ))}

        <section className={styles.section} data-reveal>
          <div className={styles.sectionIndex}>
            <span className={styles.sectionTick} aria-hidden="true" />
          </div>
          <div className={styles.sectionBody}>
            <h2 className={styles.heading}>{t('pages.guide.trouble.heading')}</h2>
            <p className={styles.body}>{t('pages.guide.trouble.body')}</p>
          </div>
        </section>
      </div>

      <section className={styles.cta} data-reveal>
        <span className={styles.ctaRule} aria-hidden="true" />
        <h2 className={styles.ctaHeading}>{t('pages.guide.cta.heading')}</h2>
        <Link href="/board" className={styles.ctaLink}>
          {t('pages.guide.cta.button')}
          <span className={styles.ctaArrow} aria-hidden="true">↗</span>
        </Link>
      </section>
    </article>
  )
}
```

- [ ] **Step 5: 英語 `/guide` を作り直す**

`app/(marketing)/guide/page.tsx`:
```tsx
import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { GuideContent } from '@/components/marketing/pages/GuideContent'
import { pageMetadata } from '@/lib/i18n/page-metadata'

export function generateMetadata(): Metadata {
  return pageMetadata('en', 'guide', 'guide')
}

export default function GuidePage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <MarketingShell locale="en" subpath="guide">
        <GuideContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 6: 14言語 `app/[locale]/guide/page.tsx` を作る**

Task 3 Step 6 と同型(`features`→`guide`、`FeaturesContent`→`GuideContent` に置換):
```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { GuideContent } from '@/components/marketing/pages/GuideContent'
import { STATIC_MESSAGES } from '@/lib/i18n/static-messages'
import { PREFIXED_LOCALES } from '@/lib/i18n/locale-urls'
import { pageMetadata } from '@/lib/i18n/page-metadata'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n/config'

export const dynamicParams = false

export function generateStaticParams(): Array<{ locale: string }> {
  return PREFIXED_LOCALES.map((locale) => ({ locale }))
}

function isPrefixedLocale(value: string): value is SupportedLocale {
  return value !== 'en' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) return {}
  return pageMetadata(locale, 'guide', 'guide')
}

export default async function LocaleGuide({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) notFound()
  return (
    <I18nProvider initialLocale={locale} initialMessages={STATIC_MESSAGES[locale]}>
      <MarketingShell locale={locale} subpath="guide">
        <GuideContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 7: tsc + build**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0、build 成功。`out/guide.html` + `out/ja/guide.html` 等14本生成。

- [ ] **Step 8: Commit**

```bash
rtk git add messages/en.json messages/ja.json components/marketing/pages/GuideContent.tsx "app/(marketing)/guide/page.tsx" "app/[locale]/guide/page.tsx"
rtk git commit -m "feat(guide): rebuild Guide (en+ja) on MarketingShell, fact-checked copy"
```

---

## Task 5: FAQ ページ(コピー en/ja + 部品 + 英語/locale 経路)

**Files:**
- Modify: `messages/en.json`、`messages/ja.json`
- Create: `components/marketing/pages/FaqContent.tsx`
- Modify: `app/(marketing)/faq/page.tsx`
- Create: `app/[locale]/faq/page.tsx`

**Interfaces:**
- Produces: `FaqContent(): React.ReactElement`。`pages.faq.*` キー:
  `meta.{title,description}` / `hero.{kicker,title,lead}` / `q1.{q,a}` 〜 `q9.{q,a}` / `cta.{heading,button}`。

- [ ] **Step 1: `en.json` の `pages` に `faq` を追加**

```json
"faq": {
  "meta": {
    "title": "FAQ",
    "description": "Common questions about AllMarks: is it free, where your data lives, how saving and sharing work, and which browsers are supported."
  },
  "hero": {
    "kicker": "FAQ",
    "title": "Questions, answered.",
    "lead": "The short version: it's free, private, and lives in your browser. Here are the details."
  },
  "q1": {
    "q": "Is it free?",
    "a": "Yes — AllMarks is free, with no account and no sign-up."
  },
  "q2": {
    "q": "Where is my data stored?",
    "a": "In your browser, on your device. Nothing is kept on our servers, so your boards never leave your machine unless you choose to share one."
  },
  "q3": {
    "q": "How do I save things?",
    "a": "Three ways: paste a URL straight onto the board (the main way), use the bookmarklet in any browser, or save in one tap with the Chrome extension."
  },
  "q4": {
    "q": "Which browsers work?",
    "a": "Any modern browser works for the board and the bookmarklet. The one-tap extension is Chrome-based for now."
  },
  "q5": {
    "q": "Can I use it on my phone?",
    "a": "Yes. Pasting a URL onto the board works on mobile, and the bookmarklet works in mobile browsers too."
  },
  "q6": {
    "q": "How does sharing work?",
    "a": "You can turn a board into a short link with a preview image for social, or export it as a PNG to post on X. A shared link carries the board itself — there's no account on either side."
  },
  "q7": {
    "q": "What happens if I clear my browser data?",
    "a": "Because everything lives in your browser, clearing its data also clears your boards. Export a backup first if you want to keep them, and import it later to restore."
  },
  "q8": {
    "q": "Is it open source?",
    "a": "Yes. The code is open, so anyone can confirm that nothing is sent anywhere it shouldn't be."
  },
  "q9": {
    "q": "Do I need an account?",
    "a": "No. There's no login, ever — that's the point. You stay anonymous and your data stays with you."
  },
  "cta": {
    "heading": "See it for yourself.",
    "button": "Open Board"
  }
}
```

- [ ] **Step 2: `ja.json` の `pages` に同キー構造で日本語コピーを追加**

```json
"faq": {
  "meta": {
    "title": "FAQ",
    "description": "AllMarks のよくある質問: 無料か、データはどこにあるか、保存と共有の仕組み、対応ブラウザについて。"
  },
  "hero": {
    "kicker": "FAQ",
    "title": "よくある質問にお答えします。",
    "lead": "ひとことで言うと: 無料・プライベート・ブラウザの中だけ。以下が詳細です。"
  },
  "q1": {
    "q": "無料ですか?",
    "a": "はい — AllMarks は無料で、アカウントも登録もありません。"
  },
  "q2": {
    "q": "データはどこに保存されますか?",
    "a": "あなたの端末のブラウザの中です。私たちのサーバーには何も残らないので、共有を選ばない限りボードがあなたの端末から出ることはありません。"
  },
  "q3": {
    "q": "どうやって保存しますか?",
    "a": "3つの方法があります: URL をボードに貼り付ける(主役)、どのブラウザでも使えるブックマークレット、Chrome 拡張でワンタップ保存。"
  },
  "q4": {
    "q": "どのブラウザで使えますか?",
    "a": "ボードとブックマークレットは最新のどのブラウザでも動きます。ワンタップの拡張機能は今のところ Chrome 系です。"
  },
  "q5": {
    "q": "スマホで使えますか?",
    "a": "はい。URL をボードに貼り付ける方法はスマホで動きますし、ブックマークレットもモバイルブラウザで使えます。"
  },
  "q6": {
    "q": "共有はどう動きますか?",
    "a": "ボードを SNS 用プレビュー画像つきの短いリンクにするか、PNG に書き出して X に投稿できます。共有リンクはボードそのものを運びます — どちら側にもアカウントは要りません。"
  },
  "q7": {
    "q": "ブラウザのデータを消したらどうなりますか?",
    "a": "すべてがブラウザの中にあるので、データを消すとボードも消えます。残したい場合は先にバックアップを書き出し、あとで読み込めば復元できます。"
  },
  "q8": {
    "q": "オープンソースですか?",
    "a": "はい。コードは公開されているので、データが余計な場所に送られていないことを誰でも確認できます。"
  },
  "q9": {
    "q": "アカウントは必要ですか?",
    "a": "いいえ。ログインは一切ありません — それが狙いです。あなたは匿名のまま、データはあなたの手元に残ります。"
  },
  "cta": {
    "heading": "自分の目で確かめよう。",
    "button": "Open Board"
  }
}
```

- [ ] **Step 3: JSON 妥当性確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/ja.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: `FaqContent.tsx` を作る**

`components/marketing/pages/FaqContent.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useReveal } from '@/lib/scroll/use-reveal'
import styles from './intro-page.module.css'

/**
 * FAQ 本文(Q&A リスト)。事実は §確定済みプロダクト事実に準拠。
 * 可視性はアニメ非依存。
 */
export function FaqContent(): React.ReactElement {
  const { t } = useI18n()
  const rootRef = useRef<HTMLElement>(null)
  useReveal(rootRef, { y: 22, stagger: 0.08 })

  const qs = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'] as const

  return (
    <article ref={rootRef} className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker} data-reveal>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.faq.hero.kicker')}
        </p>
        <h1 className={styles.title} data-reveal>{t('pages.faq.hero.title')}</h1>
        <p className={styles.lead} data-reveal>{t('pages.faq.hero.lead')}</p>
      </header>

      <div className={styles.qaList}>
        {qs.map((key) => (
          <section key={key} className={styles.qa} data-reveal>
            <h2 className={styles.qaQ}>{t(`pages.faq.${key}.q`)}</h2>
            <p className={styles.qaA}>{t(`pages.faq.${key}.a`)}</p>
          </section>
        ))}
      </div>

      <section className={styles.cta} data-reveal>
        <span className={styles.ctaRule} aria-hidden="true" />
        <h2 className={styles.ctaHeading}>{t('pages.faq.cta.heading')}</h2>
        <Link href="/board" className={styles.ctaLink}>
          {t('pages.faq.cta.button')}
          <span className={styles.ctaArrow} aria-hidden="true">↗</span>
        </Link>
      </section>
    </article>
  )
}
```

- [ ] **Step 5: 英語 `/faq` を作り直す**

`app/(marketing)/faq/page.tsx`:
```tsx
import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { FaqContent } from '@/components/marketing/pages/FaqContent'
import { pageMetadata } from '@/lib/i18n/page-metadata'

export function generateMetadata(): Metadata {
  return pageMetadata('en', 'faq', 'faq')
}

export default function FaqPage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <MarketingShell locale="en" subpath="faq">
        <FaqContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 6: 14言語 `app/[locale]/faq/page.tsx` を作る**

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { FaqContent } from '@/components/marketing/pages/FaqContent'
import { STATIC_MESSAGES } from '@/lib/i18n/static-messages'
import { PREFIXED_LOCALES } from '@/lib/i18n/locale-urls'
import { pageMetadata } from '@/lib/i18n/page-metadata'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n/config'

export const dynamicParams = false

export function generateStaticParams(): Array<{ locale: string }> {
  return PREFIXED_LOCALES.map((locale) => ({ locale }))
}

function isPrefixedLocale(value: string): value is SupportedLocale {
  return value !== 'en' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) return {}
  return pageMetadata(locale, 'faq', 'faq')
}

export default async function LocaleFaq({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) notFound()
  return (
    <I18nProvider initialLocale={locale} initialMessages={STATIC_MESSAGES[locale]}>
      <MarketingShell locale={locale} subpath="faq">
        <FaqContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 7: tsc + build**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0、build 成功。`out/faq.html` + `out/ja/faq.html` 等14本生成。

- [ ] **Step 8: Commit**

```bash
rtk git add messages/en.json messages/ja.json components/marketing/pages/FaqContent.tsx "app/(marketing)/faq/page.tsx" "app/[locale]/faq/page.tsx"
rtk git commit -m "feat(faq): rebuild FAQ (en+ja) on MarketingShell, fact-checked copy"
```

---

## Task 6: Extension 紹介ページ(新設・コピー en/ja + 部品 + 英語/locale 経路)

**Files:**
- Modify: `messages/en.json`、`messages/ja.json`
- Create: `components/marketing/pages/ExtensionContent.tsx`
- Create: `app/(marketing)/extension/page.tsx`
- Create: `app/[locale]/extension/page.tsx`

**Interfaces:**
- Consumes: `EXTENSION_STORE_URL`(`@/lib/board/constants`、現在空文字)。
- Produces: `ExtensionContent(): React.ReactElement`。`pages.extension.*` キー:
  `meta.{title,description}` / `hero.{kicker,title,lead}` / `status.{label,body}` / `what.{num,heading,body}` / `how.{num,heading,body}` / `sites.{num,heading,body}` / `privacy.{num,heading,body}` / `cta.{heading,button}`。
- **空ストア対応**: `EXTENSION_STORE_URL` が空の間は status バナー(「ストア準備中・今はブックマークレットで使える」)を出し、ストアボタンを出さない。値が入ったら(公開時)ストアリンクを点灯。
- **プライバシーリンク**: フラット `/extension/privacy`(Phase C で言語化するまで)。

- [ ] **Step 1: `en.json` の `pages` に `extension` を追加**

```json
"extension": {
  "meta": {
    "title": "Chrome Extension",
    "description": "Save any page to AllMarks in one tap with the Chrome extension. Reads only the page you save, sends nothing to a server."
  },
  "hero": {
    "kicker": "Extension",
    "title": "Save anything, in one tap.",
    "lead": "The AllMarks extension puts a save button on every page, so the things you find go straight to your board."
  },
  "status": {
    "label": "Coming soon to the Chrome Web Store",
    "body": "The extension is on its way to the store. In the meantime you can already save from any browser with the bookmarklet — no waiting."
  },
  "what": {
    "num": "01",
    "heading": "One-tap saving",
    "body": "Save the page you're on with a click, a right-click menu, or a keyboard shortcut. It drops straight onto your board, and you can add a tag right as you save."
  },
  "how": {
    "num": "02",
    "heading": "How to get it",
    "body": "Once it's on the Chrome Web Store, it's a one-click install. Right now, grab the bookmarklet from the guide and you'll have the same one-tap saving in any browser today."
  },
  "sites": {
    "num": "03",
    "heading": "Works across the web",
    "body": "Save from anywhere. Posts from X, YouTube, Vimeo, SoundCloud, and more come in ready to play on your board; everything else saves with a clean preview."
  },
  "privacy": {
    "num": "04",
    "heading": "Reads only what you save",
    "body": "The extension reads the page you choose to save and nothing else. There's no server in the middle — your saves go straight into your browser."
  },
  "cta": {
    "heading": "Start saving.",
    "button": "Open Board"
  }
}
```

- [ ] **Step 2: `ja.json` の `pages` に同キー構造で日本語コピーを追加**

```json
"extension": {
  "meta": {
    "title": "Chrome Extension",
    "description": "Chrome 拡張で、どのページもワンタップで AllMarks に保存。保存するページだけを読み取り、サーバーには何も送りません。"
  },
  "hero": {
    "kicker": "Extension",
    "title": "なんでも、ワンタップで保存。",
    "lead": "AllMarks 拡張は、どのページにも保存ボタンを置きます。見つけたものがそのままボードに届きます。"
  },
  "status": {
    "label": "Chrome ウェブストアに近日公開",
    "body": "拡張はストアに申請中です。それまでの間も、ブックマークレットを使えばどのブラウザからでもすぐに保存できます — 待つ必要はありません。"
  },
  "what": {
    "num": "01",
    "heading": "ワンタップ保存",
    "body": "今いるページを、クリック・右クリックメニュー・キーボードショートカットで保存。そのままボードに届き、保存しながらタグも付けられます。"
  },
  "how": {
    "num": "02",
    "heading": "入手方法",
    "body": "Chrome ウェブストアに並べば、ワンクリックで導入できます。今は、ガイドからブックマークレットを取得すれば、どのブラウザでも同じワンタップ保存が今日から使えます。"
  },
  "sites": {
    "num": "03",
    "heading": "Web 全体で使える",
    "body": "どこからでも保存できます。X・YouTube・Vimeo・SoundCloud などの投稿はボード上で再生できる状態で届き、それ以外もきれいなプレビューで保存されます。"
  },
  "privacy": {
    "num": "04",
    "heading": "保存するものだけを読む",
    "body": "拡張は、あなたが保存を選んだページだけを読み取り、それ以外は読みません。間にサーバーはなく、保存はそのままあなたのブラウザに入ります。"
  },
  "cta": {
    "heading": "保存を始めよう。",
    "button": "Open Board"
  }
}
```

- [ ] **Step 3: JSON 妥当性確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/ja.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: `ExtensionContent.tsx` を作る**

`components/marketing/pages/ExtensionContent.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useReveal } from '@/lib/scroll/use-reveal'
import { EXTENSION_STORE_URL } from '@/lib/board/constants'
import styles from './intro-page.module.css'

/**
 * Extension 紹介本文。EXTENSION_STORE_URL が空の間は「ストア準備中・今は
 * ブックマークレットで」バナーを出し、死んだストアリンクを出さない(値が入れば
 * 自動でストアボタン点灯)。プライバシーリンクはフラット /extension/privacy
 * (Phase C で言語化)。事実は §確定済みプロダクト事実に準拠。可視性はアニメ非依存。
 */
export function ExtensionContent(): React.ReactElement {
  const { t } = useI18n()
  const rootRef = useRef<HTMLElement>(null)
  useReveal(rootRef, { y: 24, stagger: 0.1 })

  const hasStore = EXTENSION_STORE_URL !== ''
  const sections = ['what', 'how', 'sites'] as const

  return (
    <article ref={rootRef} className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker} data-reveal>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.extension.hero.kicker')}
        </p>
        <h1 className={styles.title} data-reveal>{t('pages.extension.hero.title')}</h1>
        <p className={styles.lead} data-reveal>{t('pages.extension.hero.lead')}</p>
      </header>

      {!hasStore && (
        <aside className={styles.banner} data-reveal>
          <p className={styles.bannerHeading}>
            <span className={styles.kickerDot} aria-hidden="true" />
            {t('pages.extension.status.label')}
          </p>
          <p className={styles.bannerBody}>{t('pages.extension.status.body')}</p>
        </aside>
      )}

      <div className={styles.sections}>
        {sections.map((key) => (
          <section key={key} className={styles.section} data-reveal>
            <div className={styles.sectionIndex}>
              <span className={styles.sectionNum}>{t(`pages.extension.${key}.num`)}</span>
              <span className={styles.sectionTick} aria-hidden="true" />
            </div>
            <div className={styles.sectionBody}>
              <h2 className={styles.heading}>{t(`pages.extension.${key}.heading`)}</h2>
              <p className={styles.body}>{t(`pages.extension.${key}.body`)}</p>
            </div>
          </section>
        ))}

        <section className={styles.section} data-reveal>
          <div className={styles.sectionIndex}>
            <span className={styles.sectionNum}>{t('pages.extension.privacy.num')}</span>
            <span className={styles.sectionTick} aria-hidden="true" />
          </div>
          <div className={styles.sectionBody}>
            <h2 className={styles.heading}>{t('pages.extension.privacy.heading')}</h2>
            <p className={styles.body}>
              {t('pages.extension.privacy.body')}{' '}
              <Link href="/extension/privacy" className={styles.link}>
                Extension privacy
              </Link>
            </p>
          </div>
        </section>
      </div>

      <section className={styles.cta} data-reveal>
        <span className={styles.ctaRule} aria-hidden="true" />
        <h2 className={styles.ctaHeading}>{t('pages.extension.cta.heading')}</h2>
        <Link href="/board" className={styles.ctaLink}>
          {t('pages.extension.cta.button')}
          <span className={styles.ctaArrow} aria-hidden="true">↗</span>
        </Link>
      </section>
    </article>
  )
}
```
※ `EXTENSION_STORE_URL` の現値は空文字(`lib/board/constants.ts:32`)。空文字との厳密比較で「ストアリンク有無」を判定するだけ(`hasStore` は将来公開時に true)。`Link href="/extension/privacy"` のラベル `Extension privacy` は当面英語固定(Phase C で言語化キー化)。

- [ ] **Step 5: 英語 `/extension` を新設**

`app/(marketing)/extension/page.tsx`(新規。`extension/privacy/page.tsx` と兄弟):
```tsx
import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ExtensionContent } from '@/components/marketing/pages/ExtensionContent'
import { pageMetadata } from '@/lib/i18n/page-metadata'

export function generateMetadata(): Metadata {
  return pageMetadata('en', 'extension', 'extension')
}

export default function ExtensionPage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <MarketingShell locale="en" subpath="extension">
        <ExtensionContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 6: 14言語 `app/[locale]/extension/page.tsx` を新設**

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ExtensionContent } from '@/components/marketing/pages/ExtensionContent'
import { STATIC_MESSAGES } from '@/lib/i18n/static-messages'
import { PREFIXED_LOCALES } from '@/lib/i18n/locale-urls'
import { pageMetadata } from '@/lib/i18n/page-metadata'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n/config'

export const dynamicParams = false

export function generateStaticParams(): Array<{ locale: string }> {
  return PREFIXED_LOCALES.map((locale) => ({ locale }))
}

function isPrefixedLocale(value: string): value is SupportedLocale {
  return value !== 'en' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) return {}
  return pageMetadata(locale, 'extension', 'extension')
}

export default async function LocaleExtension({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) notFound()
  return (
    <I18nProvider initialLocale={locale} initialMessages={STATIC_MESSAGES[locale]}>
      <MarketingShell locale={locale} subpath="extension">
        <ExtensionContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 7: tsc + build(2階層 extension の共存確認)**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0、build 成功。`out/extension.html`(英語紹介)+ `out/ja/extension.html` 等14本生成。既存 `out/extension/privacy.html`(法務C、Legacy のまま)も**壊れず共存**していることを確認。

- [ ] **Step 8: Commit**

```bash
rtk git add messages/en.json messages/ja.json components/marketing/pages/ExtensionContent.tsx "app/(marketing)/extension/page.tsx" "app/[locale]/extension/page.tsx"
rtk git commit -m "feat(extension): new Extension intro page (en+ja), coming-soon banner while store URL empty"
```

---

## Task 7: 集客4ページを13言語へ翻訳 + キーパリティテスト

**Files:**
- Modify: `messages/{zh,ko,es,fr,de,pt,it,nl,tr,ru,ar,th,vi}.json`
- Create: `messages/pages-acquisition-parity.test.ts`

**Interfaces:**
- Consumes: en.json の `pages.{features,guide,faq,extension}.*`(Task 3–6 = 基準構造)。
- Produces: 15言語すべてに同一キー構造の `pages.{features,guide,faq,extension}.*`。

- [ ] **Step 1: キーパリティテストを先に書く(失敗する)**

`messages/pages-acquisition-parity.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

function leafKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  )
}

const PAGE_KEYS = ['features', 'guide', 'faq', 'extension'] as const

describe('pages 集客4ページ 15言語キーパリティ', () => {
  const en = require('./en.json').pages

  for (const page of PAGE_KEYS) {
    const baseKeys = leafKeys(en[page]).sort()
    for (const locale of SUPPORTED_LOCALES) {
      it(`${locale} の pages.${page} は en と同一 leaf key を持つ`, () => {
        const msgs = require(`./${locale}.json`)
        expect(msgs.pages?.[page], `${locale} に pages.${page} が無い`).toBeDefined()
        expect(leafKeys(msgs.pages[page]).sort()).toEqual(baseKeys)
      })
      it(`${locale} の pages.${page}.cta.button は "Open Board" verbatim`, () => {
        const msgs = require(`./${locale}.json`)
        expect(msgs.pages[page].cta.button).toBe('Open Board')
      })
    }
  }
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk vitest run messages/pages-acquisition-parity.test.ts`
Expected: FAIL(13言語に `pages.features` 等が無い)。en/ja は既に存在するので PASS、残り13言語で FAIL。

- [ ] **Step 3: 13言語へ翻訳(並列サブエージェント)**

各言語ファイル(zh/ko/es/fr/de/pt/it/nl/tr/ru/ar/th/vi)の `pages` オブジェクトに `features`/`guide`/`faq`/`extension` の4ブロックを en.json 基準で追加。**サブエージェント駆動**で13言語を並列実行。各サブエージェントへの指示:
- en.json の `pages.{features,guide,faq,extension}` を該当言語へ自然に翻訳。**キー構造は完全一致**(leaf key を1つも増減しない)。
- **verbatim 固定(翻訳しない)**: 各 `cta.button` = `Open Board`。ブランド名 `AllMarks`、固有名詞 `X` `YouTube` `Shorts` `TikTok` `Vimeo` `SoundCloud` `Instagram` `Chrome` `PNG` `URL` `MOTION` `DENSE` `AMBIENT` `visual` `editorial` `native` はそのまま(言語慣習で表記が変わる場合のみ自然に)。`Chrome Web Store` は各言語の公式名があればそれ、無ければ英語。
- トーンは LP の `landing.*` 訳・既存 `pages.about.*` 訳に合わせる(編集的で簡潔)。事実は §確定済みプロダクト事実から逸脱しない(複数同時再生と書かない・サイズ1–5と書かない・リキッドグラスと書かない)。
- ar は RTL 言語だが**翻訳テキストのみ**(レイアウト対応は別途、本タスク対象外)。
- JSON 妥当性を厳守(末尾カンマ・エスケープ)。

- [ ] **Step 4: キーパリティ + JSON 妥当性を確認**

Run: `rtk vitest run messages/pages-acquisition-parity.test.ts`
Expected: PASS(4ページ × 15言語 × 2アサーション)。

- [ ] **Step 5: 全テスト + tsc + build**

Run: `rtk vitest run && rtk tsc && rtk pnpm build`
Expected: 全 PASS、tsc 0、build 成功。`out/zh/features.html` 等が各言語で焼き込み。

- [ ] **Step 6: Commit**

```bash
rtk git add messages/ messages/pages-acquisition-parity.test.ts
rtk git commit -m "i18n(pages): translate features/guide/faq/extension to 13 languages + key-parity test"
```

---

## Task 8: sitemap 拡張 + nav 言語化(`LOCALIZED_INTRO_SUBPATHS`)

**Files:**
- Modify: `app/sitemap.ts`
- Modify: `lib/i18n/locale-urls.ts`
- Test: `app/sitemap.test.ts`(無ければ新規)

**Interfaces:**
- Consumes: `localePath(locale, subpath)`、`SUPPORTED_LOCALES`、`LOCALIZED_INTRO_SUBPATHS`。
- Produces: sitemap に features/guide/faq/extension の15言語エントリ。`LOCALIZED_INTRO_SUBPATHS` に4 subpath 追加 → ヘッダー/フッター nav が当該言語接頭辞付きに自動化(navHref)。

**順序の安全性**: Task 3–7 で features/guide/faq/extension の `[locale]` 経路が全14言語ぶん生成・翻訳済み。よって今 `LOCALIZED_INTRO_SUBPATHS` に足しても nav リンク先が 404 にならない(Global Constraints の順序制約を満たす)。

- [ ] **Step 1: sitemap の失敗するテストを書く**

`app/sitemap.test.ts`(既存なら集客4ページの describe を追記):
```ts
import { describe, it, expect } from 'vitest'
import sitemap from './sitemap'
import { SITE_URL } from '@/lib/constants'

describe('sitemap 集客4ページ', () => {
  const urls = sitemap().map((e) => e.url)
  for (const page of ['features', 'guide', 'faq', 'extension'] as const) {
    it(`${page} は英語フラットを含む`, () => {
      expect(urls).toContain(`${SITE_URL}/${page}`)
    })
    it(`${page} は日本語版を含む`, () => {
      expect(urls).toContain(`${SITE_URL}/ja/${page}`)
    })
    it(`${page} は15言語ぶん存在する`, () => {
      expect(urls.filter((u) => u.endsWith(`/${page}`))).toHaveLength(15)
    })
  }
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk vitest run app/sitemap.test.ts`
Expected: FAIL(features/guide/faq は英語1本のみ、extension は未登録)。

- [ ] **Step 3: sitemap を15言語エントリ化**

`app/sitemap.ts` の routes 配列で、既存の単独 `{ path: '/features', … }`・`{ path: '/guide', … }`・`{ path: '/faq', … }` 行を削除し、About と同じ言語別マップに置換。extension も新規追加:
```ts
    { path: '/board', priority: 0.9, changeFrequency: 'weekly' },
    // Features(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'features'),
      priority: 0.8,
      changeFrequency: 'monthly' as const,
    })),
    // Guide(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'guide'),
      priority: 0.8,
      changeFrequency: 'monthly' as const,
    })),
    // About(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'about'),
      priority: 0.7,
      changeFrequency: 'monthly' as const,
    })),
    // FAQ(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'faq'),
      priority: 0.7,
      changeFrequency: 'monthly' as const,
    })),
    // Extension 紹介(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'extension'),
      priority: 0.6,
      changeFrequency: 'monthly' as const,
    })),
    { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/terms', priority: 0.5, changeFrequency: 'monthly' },
```
※ 既存の `{ path: '/features', … }` `{ path: '/guide', … }` `{ path: '/faq', … }` の3行は削除(言語別マップが英語フラットも含む)。`SUPPORTED_LOCALES`/`localePath` は既に import 済み。

- [ ] **Step 4: sitemap テストが通る**

Run: `rtk vitest run app/sitemap.test.ts`
Expected: PASS。

- [ ] **Step 5: `LOCALIZED_INTRO_SUBPATHS` に4 subpath を追加**

`lib/i18n/locale-urls.ts` の `LOCALIZED_INTRO_SUBPATHS` を更新:
```ts
// 多言語化済みページのみ。404 回避のため、[locale] 経路が全14言語生成済みの
// subpath だけを登録する(navHref が未登録 subpath はフラットに落とす)。
export const LOCALIZED_INTRO_SUBPATHS: ReadonlySet<string> = new Set([
  'about',
  'features',
  'guide',
  'faq',
  'extension',
])
```

- [ ] **Step 6: tsc + 既存テスト + build**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0、全テスト PASS、build 成功。

- [ ] **Step 7: Commit**

```bash
rtk git add app/sitemap.ts app/sitemap.test.ts lib/i18n/locale-urls.ts
rtk git commit -m "feat(seo): sitemap + nav localization for features/guide/faq/extension (15 langs)"
```

---

## Task 9: 通し検証 + 本番デプロイ + 実機 calibration + ドキュメント

**Files:** `docs/TODO.md`、`docs/CURRENT_GOAL.md`、`docs/TODO_COMPLETED.md`

- [ ] **Step 1: 全テスト + tsc + build**

Run: `rtk vitest run && rtk tsc && rtk pnpm build`
Expected: vitest 全 PASS、tsc 0、build 成功。ルート増(集客4ページ × 14言語 = +56、英語フラット4は既存改修/新設)。

- [ ] **Step 2: 旧語が新ページに残っていないか grep**

Run:
```bash
rtk grep "リキッドグラス" messages/
rtk grep "liquid glass" messages/
rtk grep "booklage" components/marketing/pages
rtk grep "S/M/L" messages/
```
Expected: 新4ページのコピーに「リキッドグラス/liquid glass」「booklage」「S/M/L」「複数同時再生(multiple … simultaneously)」が**無い**こと。

- [ ] **Step 3: 本番デプロイ**

Run:
```bash
npx wrangler whoami
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message "deploy: intro pages phase B (features/guide/faq/extension i18n)"
```
Expected: deploy 成功、`allmarks.app` 反映。

- [ ] **Step 4: 本番実機 calibration(ユーザーと)**

確認項目:
- `allmarks.app/features` `/guide` `/faq` `/extension`(英語・新編集デザイン)+ `/ja/...` `/zh/...` 等が正しい言語で開く。
- `curl -s https://allmarks.app/ja/features | grep -E 'hreflang|canonical'` で hreflang 16本・canonical=`/ja/features`。
- ヘッダー/フッター nav が `/ja` 配下では `/ja/features` 等(言語接頭辞付き)になる(navHref)。言語メニューで同一ページの別言語へ移動。Contact はまだフラット(Phase C)。
- `/extension`(紹介)と `/extension/privacy`(Legacy 法務)が共存し両方開く。Extension 紹介に「準備中」バナーが出る(`EXTENSION_STORE_URL` 空)。
- reduced-motion/モバイル幅で全ページが必ず可視(reveal 非依存)。narrow PC(800px 程度)で reveal のチラつきが無い(Task 1 の対称化)。
- **見た目の細部(余白・タイポ・セクション間隔・バナー)をユーザーと調整**(`.claude/rules/ui-design.md` 承認フロー)。

- [ ] **Step 5: ドキュメント更新 + Commit(セッション末)**

`docs/TODO.md`「現在の状態」を更新(セッション111: フェーズB完了)、`docs/CURRENT_GOAL.md` を次(フェーズC = 法務 privacy/terms/contact/extension-privacy + 残り nav 言語化)用に上書き、`docs/TODO_COMPLETED.md` に narrative 追記。
```bash
rtk git add docs/
rtk git commit -m "docs: intro pages phase B (features/guide/faq/extension i18n) shipped; next phase C"
```

---

## Self-Review

**1. Spec coverage(spec §ごと):**
- §2 スコープ(集客B 4ページ + 新設 extension)→ Task 3(features)/4(guide)/5(faq)/6(extension)。✓
- §3 URL/ルーティング(英語フラット + `[locale]` 14言語 + 2階層 extension 共存)→ 各ページ Task の en 経路 + `[locale]` 経路、Task 6 Step 7 で extension/privacy 共存確認。✓
- §4.1 共有シェル一本化 → 全ページ `MarketingShell`(フェーズA 既存)を使用。✓
- §4.2 nav 言語化 → Task 8(`LOCALIZED_INTRO_SUBPATHS` 追加、全ページ生成後)。✓
- §4.3 lang/light → `MarketingShell`(既存)。✓
- §5.1/5.2 デザイン言語(編集トーン・番号付き・控えめ reveal・傾けない)→ Task 2(共有 CSS グラマー)+ 各 Content。✓
- §5.2 reveal は PC のみ + 可視性アニメ非依存 → Task 1(useReveal 対称化)+ Task 2(CSS ゲート)。✓
- §6.2 既知修正リスト(フォルダ→タグ/サイズ→プリセット+自由リサイズ/リキッドグラス削除/エクスポート控えめ/booklage→allmarks/保存3経路/共有 /s/+PNG+X/再生=1本+静止画/音波)→ §確定済みプロダクト事実 + 各ページコピーで反映。複数同時再生はユーザー承認の正直な言い回しに修正。✓
- §6.3 ページ別アウトライン(features 番号付き+対応サイト表+誠実開示 / guide 30秒→3経路→操作→再生→データ→トラブル / faq 刷新 Q&A / extension 何が/導入/サイト/プライバシー/準備中バナー)→ Task 3–6 のキー設計とコピー。✓(対応サイトは「表」でなく散文 + 誠実注記。i18n 簡潔化のため。表化は将来 polish)
- §7 多言語の仕組み(pages.* 名前空間・en/ja 人手・13言語並列・verbatim・パリティテスト)→ Task 3–6(en/ja)+ Task 7(13言語 + parity)。✓
- §9 影響ファイル → File Structure と一致。✓
- §11 テスト(キーパリティ・sitemap・build・本番)→ Task 7(parity)/8(sitemap)/9(通し+本番)。✓
- §12 フェーズB → 本プラン。法務Cは後続。✓
- §13 未確定(reveal の具体・対応サイト素材)→ reveal は Task 1/2 で確定、スクリーンショット素材は本フェーズでは導入せず散文+誠実開示で対応(偽メタデータ回避)。本番 calibration で詰める。✓

**2. Placeholder scan:** 各 Step に実コード/実コマンド/期待値/実コピー(en+ja 全文)あり。13言語(Task 7 Step 3)はサブエージェント指示を明記(en 基準 + verbatim ルールで一意)。"TBD"/"後で"/"適宜" 無し。✓

**3. Type consistency:** 全ページの `[locale]` ラッパは `isPrefixedLocale`/`generateStaticParams`/`pageMetadata(locale, '<page>', '<page>')`/`MarketingShell locale/subpath` を同一シグネチャで使用(フェーズA About と一致)。`pageMetadata(locale, pageKey, subpath)` の引数順、`localePath(locale, subpath)`、`LOCALIZED_INTRO_SUBPATHS: ReadonlySet<string>`、`useReveal(ref, {y, stagger})`、共有 CSS クラス名(`section`/`sectionNum`/`qaQ`/`banner` 等)は Task 2 定義と各 Content の参照が一致。`EXTENSION_STORE_URL` は string(空文字比較)。✓

**意図的に後続(フェーズC)送り**: privacy/terms/contact/extension-privacy の作り直し・言語化、Contact のフラット nav、`extension/privacy` の言語化(現状フラットリンク)、対応サイトの表組み・スクリーンショット素材、`OG_LOCALE` 重複の共有定数化(第3利用者が出れば)。

---

## Execution Handoff

フェーズB(集客4ページ)の実装計画です。完了すると: Features / Guide / FAQ / 新設 Extension 紹介が15言語の専用URLで稼働し、内容は現行プロダクトの事実に一致、編集デザインで統一、nav も当該言語接頭辞付きに自動化されます。これで拡張ストア審査に出せる紹介・プライバシー導線(extension 紹介 + 既存 extension/privacy)が英語+14言語で揃います。法務C(privacy/terms/contact/extension-privacy + 残り nav 言語化)は本土台に乗せる後続プラン。
</parameter>
</invoke>
