# 紹介ページ群 フェーズC(法務: privacy/terms/contact/extension-privacy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 法務4ページ(Privacy / Terms / Contact / Extension Privacy)を、フェーズA/B の土台に乗せ、内容を現行プロダクトの事実に正しく書き直し(特に拡張権限・共有の正確化)・落ち着いた読み物デザインに統一・15言語化・英語フラット+`[locale]`生成・sitemap 追加し、残り nav(contact/privacy/terms/extension-privacy)も言語化する。

**Architecture:** フェーズB と同じ「共有本文部品 + 英語フラット経路 + `[locale]` 14言語経路 + `pageMetadata` + `MarketingShell`」型を踏襲。ただし法務は集客と別の**読み物レイアウト**なので新 CSS `legal-page.module.css`(1カラム・快適な行長・明確な見出し階層・最終更新日・privacy/terms はページ内目次アンカー・スクロール演出なし)を新設。Contact は短い中央寄せ。全コピーは現行コードの事実から書き直す(本計画 §確定済みプロダクト事実 が唯一の根拠)。

**Tech Stack:** Next.js 14 App Router(`output:'export'`)、TypeScript strict、Vanilla CSS Modules、Vitest。法務ページは GSAP/reveal を使わない(可読性最優先・静的)。

## Global Constraints

- **応答・コメントは日本語**。UI 表示テキストは翻訳ファイル + 世界共通英語語彙。金額は¥(本タスクで金額表記なし)。
- `output:'export'`。`[locale]` 配下は `generateStaticParams`=`PREFIXED_LOCALES`(14)・`dynamicParams=false`・未対応 locale は `notFound()`。英語フラット、他14言語は `/<locale>/<page>`。
- **アプリ本体(`/board` `/triage` `/s/*` `/save` `/save-iframe` `/api`)に接頭辞を付けない**。`DB_NAME='booklage-db'` 等の不可視符号・拡張の `booklage:*` メッセージ型・窓名は不変。
- 15言語キー構造完全一致。固定値 verbatim(`AllMarks`/`X`/`YouTube`/`GitHub`/`Cloudflare`/`IndexedDB`/`Chrome`/コード識別子 `activeTab` 等/`Ctrl+Shift+B`)。法務ページに `cta.button`('Open Board')は**設けない**(閉じは SiteFooter の黒フィナーレが担う)。
- **コピーは現行コードの事実から書く**。本計画 §確定済みプロダクト事実 に反する記述を書かない。特に**共有はサーバー(KV/R2)に30日保存される**という事実、**拡張の権限は `<all_urls>` で `notifications` は無い**事実を正しく書く(旧ページの誤りを継承しない)。
- 個人情報を出さない(本名・個人メアド・個人 X 垢)。Contact は **GitHub Issues 中心・X欄なし・個人メアド非掲載**。準拠法は日本・東京(維持)。最終更新日 = **2026-06-18**(英語表記 `June 18, 2026`、各言語で自然に)。
- 法務は**スクロール演出なし**・傾け/回転なし・AI青紫グラデ禁止・偽メタデータ禁止。ダーク強制対策は `MarketingShell`(既存)。
- **404 回避の順序**: `LOCALIZED_INTRO_SUBPATHS` への subpath 追加(nav 言語化)は当該 `[locale]` 経路が全14言語生成・翻訳済みになった後(Task 7)。
- **本番デプロイ**: `npx wrangler whoami` → `rtk pnpm build` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message "<ASCII>"`。`tsc <file>` 直叩き禁止 → `rtk tsc`。

---

## 確定済みプロダクト事実(法務コピーの唯一の根拠・コード検証済み)

- **保存先 = ブラウザの IndexedDB のみ**(`lib/storage/indexeddb.ts`、DB名は内部符号で不可視)。サーバーにユーザー DB なし・アカウントなし・ログインなし。
- **共有は実はサーバーに保存される(旧プライバシーの「送らない」は誤り)**: 共有リンクを作ると、ボードのデータが Cloudflare KV に、プレビュー画像が Cloudflare R2 に**アップロードされ**、秘密の共有リンク(6文字 ID)からのみ到達でき、**約30日で自動削除**(`functions/api/share/create.ts`、`lib/share/types-v2.ts` TTL=30日)。**共有を明示的に作らない限り何もアップロードされない**。非公開ボードは決してアップロードされない。加えて PNG 書き出しはローカル生成。
- **ブックマークレット**は閲覧中ページの OGP メタ(title/description/image/site名)を**ブラウザ内で読み**、ローカルの保存窓に渡すだけ。サーバー経由なし。
- **ホスティング/解析**: Cloudflare Pages。Cloudflare が匿名のサーバ指標(総ページビュー等)を標準ホスティングの一部として持つことがある=個人特定情報なし。Google Analytics/Facebook Pixel 等の第三者トラッキングなし。追跡 Cookie なし。
- **第三者埋め込み**: ツイート(react-tweet)・動画(oEmbed)等は各サービスのプライバシーポリシーに従う。
- **拡張機能の事実**(`extension/manifest.json` v0.1.20 + extension/*.js でコード確認):
  - 権限 = `activeTab` / `contextMenus` / `scripting` / `offscreen` / `storage`。**`notifications` 権限は無い**(旧ページの記載は誤り、書かない)。
  - `host_permissions` = **`<all_urls>`**(旧ページの `https://allmarks.app/*` は誤り)。理由: フローティング保存ボタン等の content script を全サイトに注入するため、および保存橋渡しの offscreen iframe が allmarks.app を読むため。
  - content script は `<all_urls>` に `content.js`/`floating-button.js` を注入(全サイトに保存ボタン)+ X/YouTube/note/Vimeo/SoundCloud にサイト別補助スクリプト。**ただしページ内容を読むのは保存を実行した時の OGP メタのみ**(常時の閲覧監視はしない)。
  - 設定(自動保存・フローティングボタン有効/不透明度/無効ドメイン・カーソルピル位置)は **`chrome.storage.sync`**(Chrome 同期 ON なら Google 経由で同期されうる=こちらは見えない)。
  - 保存済み URL の控え `savedUrlsMirror` は **`chrome.storage.local`**(「保存済み」表示・重複検知用、ローカルのみ)。
  - 保存実体は offscreen iframe(`https://allmarks.app/save-iframe?ext=1`)経由で allmarks.app の IndexedDB に書く。**外部サーバー送信・解析・テレメトリは一切なし**。
  - キーコンボ = `Ctrl+Shift+B`(Mac `Command+Shift+B`)。
- **GitHub リポジトリ = `masaya-men/allmarks`**(旧 `booklage` は全て修正)。
- **広告の開示**: 現状広告なし・無料。将来広告を入れる可能性に触れる場合は**汎用的に**(「将来広告を追加する場合はこの方針を更新し、こちら側では引き続き個人データを集めない」)。特定の広告事業者名・収益戦略は書かない(プライバシー方針上の中立な開示のみ)。

---

## File Structure

新規:
- `components/marketing/pages/legal-page.module.css` — 法務読み物グラマー(1カラム・行長~70ch・見出し階層・最終更新日・目次・脚注リンク。reveal なし)。
- `components/marketing/pages/PrivacyContent.tsx` / `TermsContent.tsx` / `ContactContent.tsx` / `ExtensionPrivacyContent.tsx`(client、`pages.<page>.*`)。
- `app/[locale]/privacy/page.tsx` / `app/[locale]/terms/page.tsx` / `app/[locale]/contact/page.tsx` / `app/[locale]/extension/privacy/page.tsx`(14言語サーバーラッパ)。
- `messages/pages-legal-parity.test.ts` — privacy/terms/contact/extensionPrivacy の15言語キーパリティ。

改修:
- `app/(marketing)/{privacy,terms,contact}/page.tsx` と `app/(marketing)/extension/privacy/page.tsx` — `LegacyMarketingChrome` 版を provider + `MarketingShell` + `<Page>Content` 版に作り直し。
- `messages/{en,ja}.json` — `pages.{privacy,terms,contact,extensionPrivacy}.*` を人手で追加。
- `messages/{zh,ko,es,fr,de,pt,it,nl,tr,ru,ar,th,vi}.json`(13) — 同4ページ翻訳。
- `lib/i18n/locale-urls.ts` — `LOCALIZED_INTRO_SUBPATHS` に `contact`/`privacy`/`terms`/`extension/privacy` を追加(Task 7)。
- `components/marketing/pages/ExtensionContent.tsx` — privacy リンクを `navHref(locale,'extension/privacy')` + 翻訳ラベルに(フェーズB の英語固定残債を回収)。**locale を受け取る必要があるため**、`ExtensionContent` に `locale` prop を足し、Extension の英語/locale ラッパから渡す(下記 Task 7 で詳細)。
- `app/sitemap.ts` — privacy/terms/contact/extension-privacy を15言語エントリに拡張。
- `docs/`(Task 8)。

**注**: `app/[locale]/extension/privacy/page.tsx` は phase B の `app/[locale]/extension/page.tsx`(紹介)と入れ子で共存(subpath='extension/privacy')。

---

## Task 1: 法務読み物 CSS `legal-page.module.css`

**Files:**
- Create: `components/marketing/pages/legal-page.module.css`

**Interfaces:**
- Produces: CSS Modules クラス(全法務 Content が import):
  - `root`(中央寄せ・最大幅~760px・上下余白)、`hero`、`kicker`、`kickerDot`、`title`、`lead`、`updated`(最終更新日の小さなモノ表記)
  - `toc`(目次ボックス)、`tocTitle`、`tocList`、`tocLink`
  - `section`(`scroll-margin-top` でアンカー着地、見出し下余白)、`heading`(h2)、`subheading`(h3 任意)、`body`(段落・行長~70ch)、`list`/`listItem`、`link`、`note`
  - `table`/`th`/`td`(拡張権限表)
  - `contactBlock`(Contact 用の中央寄せカード)、`contactItem`、`contactLabel`、`contactValue`
- 可視性は常に opacity:1(reveal なし)。傾け/回転なし。`scroll-margin-top` で固定ヘッダー下に見出しが隠れないよう調整。

- [ ] **Step 1: ファイル作成**

`components/marketing/pages/legal-page.module.css`:
```css
/* legal-page.module.css
   法務ページ(privacy/terms/contact/extension-privacy)の落ち着いた読み物グラマー。
   AllMarks LP の白基調(--lp-paper)+ ink 文字 + Fraunces 見出し + Geist body。
   1カラム・行長~70ch・明確な見出し階層・ページ内目次アンカー・最終更新日。
   可読性最優先: スクロール演出なし(全要素 opacity:1)、傾け/回転なし。 */

.root {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: clamp(72px, 12vw, 132px) 40px clamp(56px, 9vw, 112px);
  box-sizing: border-box;
}

.hero { margin-bottom: clamp(36px, 6vw, 64px); }

.kicker {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 22px;
  font-family: var(--font-geist-mono), ui-monospace, monospace;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--lp-ink-soft);
}

.kickerDot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--lp-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--lp-accent) 16%, transparent);
}

.title {
  margin: 0;
  font-family: var(--lp-serif);
  font-weight: 300;
  font-size: clamp(34px, 5.4vw, 58px);
  line-height: 1.06;
  letter-spacing: -0.03em;
  color: var(--lp-ink);
  text-wrap: balance;
}

.lead {
  max-width: 60ch;
  margin: clamp(18px, 2.6vw, 26px) 0 0;
  font-family: var(--lp-serif);
  font-weight: 300;
  font-size: clamp(18px, 2.1vw, 23px);
  line-height: 1.45;
  color: var(--lp-ink-soft);
  text-wrap: pretty;
}

.updated {
  margin: clamp(16px, 2vw, 22px) 0 0;
  font-family: var(--font-geist-mono), ui-monospace, monospace;
  font-size: 12px;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--lp-ink-soft) 80%, transparent);
}

/* 目次(privacy/terms) */
.toc {
  margin: 0 0 clamp(40px, 6vw, 72px);
  padding: clamp(20px, 2.6vw, 28px) clamp(22px, 3vw, 30px);
  border: 1px solid color-mix(in srgb, var(--lp-ink) 12%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--lp-ink) 3%, transparent);
}

.tocTitle {
  margin: 0 0 14px;
  font-family: var(--font-geist-mono), ui-monospace, monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--lp-ink-soft);
}

.tocList {
  margin: 0; padding: 0; list-style: none;
  display: grid;
  gap: 8px;
}

.tocLink {
  font-family: var(--lp-sans);
  font-size: clamp(14px, 1.3vw, 16px);
  line-height: 1.4;
  color: var(--lp-ink-soft);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: color 0.25s ease, border-color 0.25s ease;
}
.tocLink:hover { color: var(--lp-ink); border-color: color-mix(in srgb, var(--lp-accent) 70%, transparent); }

/* 本文セクション */
.section {
  /* 固定ヘッダー下にアンカー着地が隠れない余白 */
  scroll-margin-top: clamp(80px, 10vw, 110px);
  margin: 0 0 clamp(32px, 4.4vw, 48px);
}

.heading {
  margin: 0 0 clamp(12px, 1.4vw, 16px);
  font-family: var(--lp-serif);
  font-weight: 300;
  font-size: clamp(22px, 2.8vw, 30px);
  line-height: 1.16;
  letter-spacing: -0.02em;
  color: var(--lp-ink);
  text-wrap: balance;
}

.subheading {
  margin: clamp(18px, 2.4vw, 26px) 0 clamp(8px, 1vw, 12px);
  font-family: var(--lp-sans);
  font-weight: 600;
  font-size: clamp(15px, 1.5vw, 17px);
  letter-spacing: -0.01em;
  color: var(--lp-ink);
}

.body {
  max-width: 70ch;
  margin: 0 0 clamp(10px, 1.2vw, 14px);
  font-family: var(--lp-sans);
  font-size: clamp(15px, 1.4vw, 17px);
  line-height: 1.72;
  letter-spacing: -0.003em;
  color: var(--lp-ink-soft);
  text-wrap: pretty;
}

.list {
  max-width: 70ch;
  margin: 0 0 clamp(10px, 1.2vw, 14px);
  padding-left: 1.3em;
}

.listItem {
  margin: 0 0 7px;
  font-family: var(--lp-sans);
  font-size: clamp(15px, 1.4vw, 17px);
  line-height: 1.66;
  color: var(--lp-ink-soft);
}

.link {
  color: var(--lp-ink);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: color-mix(in srgb, var(--lp-ink) 35%, transparent);
  transition: text-decoration-color 0.25s ease;
}
.link:hover { text-decoration-color: var(--lp-accent); }

.note {
  max-width: 70ch;
  margin: clamp(10px, 1.2vw, 14px) 0 0;
  font-family: var(--lp-sans);
  font-size: clamp(13px, 1.2vw, 14px);
  line-height: 1.64;
  color: color-mix(in srgb, var(--lp-ink-soft) 76%, transparent);
}

/* 権限表(extension-privacy) */
.table {
  width: 100%;
  border-collapse: collapse;
  margin: clamp(10px, 1.4vw, 16px) 0 clamp(14px, 1.6vw, 18px);
  font-family: var(--lp-sans);
  font-size: clamp(14px, 1.3vw, 15px);
}
.th {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1.5px solid color-mix(in srgb, var(--lp-ink) 22%, transparent);
  font-weight: 600;
  color: var(--lp-ink);
}
.td {
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--lp-ink) 10%, transparent);
  color: var(--lp-ink-soft);
  line-height: 1.6;
  vertical-align: top;
}
.code {
  font-family: var(--font-geist-mono), ui-monospace, monospace;
  font-size: 0.9em;
  padding: 1px 6px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--lp-ink) 7%, transparent);
  color: var(--lp-ink);
  white-space: nowrap;
}

/* Contact 用の中央寄せブロック */
.contactBlock {
  display: grid;
  gap: clamp(20px, 3vw, 30px);
  margin-top: clamp(20px, 3vw, 32px);
}
.contactItem {
  padding: clamp(20px, 2.8vw, 28px) clamp(22px, 3vw, 30px);
  border: 1px solid color-mix(in srgb, var(--lp-ink) 12%, transparent);
  border-radius: 14px;
}
.contactLabel {
  margin: 0 0 8px;
  font-family: var(--font-geist-mono), ui-monospace, monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--lp-ink-soft);
}
.contactValue {
  margin: 0;
  font-family: var(--lp-sans);
  font-size: clamp(15px, 1.4vw, 17px);
  line-height: 1.66;
  color: var(--lp-ink-soft);
}

@media (max-width: 720px) {
  .root { padding: clamp(56px, 16vw, 96px) 24px 56px; }
  .table { font-size: 13px; }
  .th, .td { padding: 8px 8px; }
}
@media (max-width: 420px) {
  .root { padding: 64px 20px 48px; }
}
```

- [ ] **Step 2: 健全性確認**

Run: `rtk pnpm build`
Expected: build 成功(未 import なので影響なし、CSS 構文確認)。

- [ ] **Step 3: Commit**

```bash
rtk git add components/marketing/pages/legal-page.module.css
rtk git commit -m "feat(marketing): legal reading-layout CSS grammar (TOC, table, contact block)"
```

---

## Task 2: Privacy ページ(en/ja + 部品 + 経路)

**Files:**
- Modify: `messages/en.json`、`messages/ja.json`
- Create: `components/marketing/pages/PrivacyContent.tsx`
- Modify: `app/(marketing)/privacy/page.tsx`
- Create: `app/[locale]/privacy/page.tsx`

**Interfaces:**
- Produces: `PrivacyContent(): React.ReactElement`(client、目次アンカー付き)。`pages.privacy.*` キー:
  `meta.{title,description}` / `hero.{kicker,title,lead,updated}` / `toc.title` / 各セクション `{heading,body}` を `philosophy`/`collect`/`local`/`sharing`/`bookmarklet`/`extension`/`hosting`/`thirdParty`/`advertising`/`children`/`changes`/`contact`。
- 目次は各セクション heading を anchor(`#collect` 等)で並べる。anchor id は固定(英語キー名)。

- [ ] **Step 1: `en.json` の `pages` に `privacy` を追加**

```json
"privacy": {
  "meta": {
    "title": "Privacy Policy",
    "description": "AllMarks collects zero personal data. Your bookmarks stay in your browser; nothing is uploaded unless you choose to share a board."
  },
  "hero": {
    "kicker": "Privacy",
    "title": "Privacy Policy",
    "lead": "AllMarks is built on one principle: your data belongs to you. We collect no personal data, and there are no accounts.",
    "updated": "Last updated: June 18, 2026"
  },
  "toc": { "title": "Contents" },
  "philosophy": {
    "heading": "Zero data collection",
    "body": "Your bookmarks, tags, and board layouts are stored only in your browser's local database (IndexedDB). We do not collect, store, or transmit your personal data to our servers, and there are no accounts to sign in to."
  },
  "collect": {
    "heading": "What we don't collect",
    "body": "We do not collect your name, email, or address; we have no accounts or login credentials; we keep no copy of your browsing history or your bookmarks on our servers; we use no tracking or advertising cookies; and we gather no IP-based fingerprints or analytics tied to you as an individual."
  },
  "local": {
    "heading": "Local storage only",
    "body": "Everything lives in your browser on your device. That means we cannot access, view, or recover your data, no server-side backup of your boards exists, and clearing your browser data permanently removes your AllMarks content. You can export your own backup at any time."
  },
  "sharing": {
    "heading": "When you share a board",
    "body": "Sharing is the one case where data leaves your device — and only because you ask it to. When you create a share link, the board's data is uploaded to our hosting (Cloudflare KV) and a preview image to storage (Cloudflare R2), reachable only through the secret share link, and automatically deleted after about 30 days. Nothing is uploaded unless you explicitly create a share link, and your private boards are never uploaded. You can also export a board as a PNG, which is generated entirely in your browser."
  },
  "bookmarklet": {
    "heading": "Bookmarklet",
    "body": "The AllMarks bookmarklet reads the Open Graph meta tags (title, description, image, site name) of the page you're on, entirely within your browser, and passes them to your local AllMarks save window. No data passes through our servers."
  },
  "extension": {
    "heading": "Browser extension",
    "body": "The AllMarks extension reads only the page you choose to save, and sends nothing to any server — your saves go straight into your browser's local database. Its own privacy policy explains exactly what it reads and the permissions it uses."
  },
  "hosting": {
    "heading": "Hosting and analytics",
    "body": "AllMarks is hosted on Cloudflare Pages. Cloudflare may record minimal, anonymized server metrics (such as total page views) as part of standard hosting; these contain no personally identifiable information. We use no Google Analytics, no Facebook Pixel, and no third-party tracking scripts."
  },
  "thirdParty": {
    "heading": "Third-party content",
    "body": "AllMarks can display content from other sites — for example tweets via react-tweet, or videos via oEmbed. Those embeds may be subject to the privacy policies of their own services, which we recommend reviewing for any content that appears in your boards."
  },
  "advertising": {
    "heading": "Advertising",
    "body": "AllMarks is free and shows no ads today. If we ever introduce advertising to support the free service, we will update this policy, clearly label it, and continue to collect zero personal data on our end."
  },
  "children": {
    "heading": "Children's privacy",
    "body": "AllMarks does not knowingly collect any information from children under 13. Because we collect no personal data from anyone, this is inherent to how the app works."
  },
  "changes": {
    "heading": "Changes to this policy",
    "body": "We may update this policy from time to time. Changes are posted on this page with a new \"last updated\" date. Because we collect no personal data, we cannot notify you of changes directly."
  },
  "contact": {
    "heading": "Questions",
    "body": "If you have questions about this policy, please reach us through the contact page."
  }
}
```

- [ ] **Step 2: `ja.json` の `pages` に同キー構造で日本語を追加**

```json
"privacy": {
  "meta": {
    "title": "プライバシーポリシー",
    "description": "AllMarks は個人データを一切集めません。ブックマークはあなたのブラウザの中だけ。ボードを共有したときだけ、必要なデータがアップロードされます。"
  },
  "hero": {
    "kicker": "Privacy",
    "title": "プライバシーポリシー",
    "lead": "AllMarks の原則はひとつ — データはあなたのものです。個人データは集めず、アカウントもありません。",
    "updated": "最終更新日: 2026年6月18日"
  },
  "toc": { "title": "目次" },
  "philosophy": {
    "heading": "データを集めない",
    "body": "ブックマーク・タグ・ボードのレイアウトは、あなたのブラウザのローカルデータベース(IndexedDB)の中だけに保存されます。個人データを私たちのサーバーに集めたり保存したり送ったりしません。ログインするアカウントもありません。"
  },
  "collect": {
    "heading": "集めないもの",
    "body": "氏名・メールアドレス・住所は集めません。アカウントもログイン情報もありません。あなたの閲覧履歴やブックマークを私たちのサーバーに控えとして持つこともありません。追跡・広告 Cookie は使いません。IP に基づくフィンガープリントや、あなた個人に紐づく解析も取りません。"
  },
  "local": {
    "heading": "保存はローカルだけ",
    "body": "すべてはあなたの端末のブラウザの中にあります。つまり私たちはあなたのデータを見ることも、取り出すことも、復元することもできません。サーバー側のバックアップは存在せず、ブラウザのデータを消すと AllMarks の内容も完全に消えます。バックアップはいつでも自分で書き出せます。"
  },
  "sharing": {
    "heading": "ボードを共有するとき",
    "body": "共有は、データが端末の外に出る唯一の場面です — しかもあなたが望んだときだけ。共有リンクを作ると、ボードのデータが Cloudflare KV に、プレビュー画像が Cloudflare R2 にアップロードされ、秘密の共有リンクからのみ到達でき、約30日で自動的に削除されます。共有リンクを明示的に作らない限り何もアップロードされず、非公開のボードがアップロードされることは決してありません。ボードは PNG にも書き出せますが、これはすべてブラウザの中で生成されます。"
  },
  "bookmarklet": {
    "heading": "ブックマークレット",
    "body": "AllMarks のブックマークレットは、閲覧中ページの Open Graph メタタグ(タイトル・説明・画像・サイト名)をブラウザの中だけで読み取り、ローカルの保存窓に渡します。サーバーを経由するデータはありません。"
  },
  "extension": {
    "heading": "ブラウザ拡張",
    "body": "AllMarks 拡張は、あなたが保存を選んだページだけを読み取り、どのサーバーにも何も送りません — 保存はそのままブラウザのローカルデータベースに入ります。何を読み、どの権限を使うかは拡張専用のプライバシーポリシーで説明しています。"
  },
  "hosting": {
    "heading": "ホスティングと解析",
    "body": "AllMarks は Cloudflare Pages でホストされています。Cloudflare は標準ホスティングの一部として匿名のサーバー指標(総ページビュー等)を記録することがありますが、個人を特定する情報は含みません。Google Analytics・Facebook Pixel・第三者トラッキングは一切使いません。"
  },
  "thirdParty": {
    "heading": "第三者のコンテンツ",
    "body": "AllMarks は他サイトのコンテンツ — 例えば react-tweet 経由のツイートや oEmbed 経由の動画 — を表示することがあります。これらの埋め込みは各サービス自身のプライバシーポリシーに従う場合があるため、ボードに表示されるコンテンツについては各サービスの方針をご確認ください。"
  },
  "advertising": {
    "heading": "広告について",
    "body": "AllMarks は無料で、現在広告は表示していません。将来、無料サービスを支えるために広告を導入する場合は、この方針を更新し、広告であることを明示し、私たちの側では引き続き個人データを一切集めません。"
  },
  "children": {
    "heading": "子どものプライバシー",
    "body": "AllMarks は13歳未満の子どもから情報を意図的に集めることはありません。そもそも誰からも個人データを集めない仕組みなので、これは自然に守られます。"
  },
  "changes": {
    "heading": "本方針の変更",
    "body": "本方針は随時更新することがあります。変更はこのページに、新しい「最終更新日」とともに掲載します。個人データを集めていないため、変更を直接お知らせすることはできません。"
  },
  "contact": {
    "heading": "ご質問",
    "body": "本方針についてのご質問は、お問い合わせページからご連絡ください。"
  }
}
```

- [ ] **Step 3: JSON 妥当性確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/ja.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: `PrivacyContent.tsx` を作る**

`components/marketing/pages/PrivacyContent.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './legal-page.module.css'

/** privacy/terms 共通: セクション定義(anchor id = key)。 */
const SECTIONS = [
  'philosophy', 'collect', 'local', 'sharing', 'bookmarklet',
  'extension', 'hosting', 'thirdParty', 'advertising', 'children',
  'changes', 'contact',
] as const

/**
 * Privacy 本文(法務読み物・目次アンカー付き)。事実は §確定済みプロダクト事実に準拠。
 * 共有は KV/R2 に30日保存される事実を正しく書く(旧ページの「送らない」誤りを継承しない)。
 * スクロール演出なし(全要素可視)。
 */
export function PrivacyContent(): React.ReactElement {
  const { t } = useI18n()
  return (
    <article className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.privacy.hero.kicker')}
        </p>
        <h1 className={styles.title}>{t('pages.privacy.hero.title')}</h1>
        <p className={styles.lead}>{t('pages.privacy.hero.lead')}</p>
        <p className={styles.updated}>{t('pages.privacy.hero.updated')}</p>
      </header>

      <nav className={styles.toc} aria-label={t('pages.privacy.toc.title')}>
        <p className={styles.tocTitle}>{t('pages.privacy.toc.title')}</p>
        <ul className={styles.tocList}>
          {SECTIONS.map((id) => (
            <li key={id}>
              <a href={`#${id}`} className={styles.tocLink}>
                {t(`pages.privacy.${id}.heading`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {SECTIONS.map((id) => (
        <section key={id} id={id} className={styles.section}>
          <h2 className={styles.heading}>{t(`pages.privacy.${id}.heading`)}</h2>
          <p className={styles.body}>{t(`pages.privacy.${id}.body`)}</p>
          {id === 'extension' && (
            <p className={styles.body}>
              <Link href="/extension/privacy" className={styles.link}>
                {t('pages.privacy.extension.heading')}
              </Link>
            </p>
          )}
          {id === 'contact' && (
            <p className={styles.body}>
              <Link href="/contact" className={styles.link}>
                {t('pages.privacy.contact.heading')}
              </Link>
            </p>
          )}
        </section>
      ))}
    </article>
  )
}
```
※ extension/contact の補助リンクは当面フラット(`/extension/privacy`・`/contact`)。Task 7 で全ページ言語化後、navHref 化は任意(法務間リンクはフラットでも 404 にならない=英語版が常に存在)。リンクラベルは該当セクション heading を流用(翻訳済み)。

- [ ] **Step 5: 英語 `/privacy` を作り直す**

`app/(marketing)/privacy/page.tsx`:
```tsx
import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { PrivacyContent } from '@/components/marketing/pages/PrivacyContent'
import { pageMetadata } from '@/lib/i18n/page-metadata'

export function generateMetadata(): Metadata {
  return pageMetadata('en', 'privacy', 'privacy')
}

export default function PrivacyPage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <MarketingShell locale="en" subpath="privacy">
        <PrivacyContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 6: 14言語 `app/[locale]/privacy/page.tsx` を作る**

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { PrivacyContent } from '@/components/marketing/pages/PrivacyContent'
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
  return pageMetadata(locale, 'privacy', 'privacy')
}

export default async function LocalePrivacy({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) notFound()
  return (
    <I18nProvider initialLocale={locale} initialMessages={STATIC_MESSAGES[locale]}>
      <MarketingShell locale={locale} subpath="privacy">
        <PrivacyContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 7: tsc + build**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0、build 成功。`out/privacy.html` + `out/ja/privacy.html` 等14本生成。`<title>` に `AllMarks — Privacy Policy`、canonical=`/privacy`、hreflang16。

- [ ] **Step 8: Commit**

```bash
rtk git add messages/en.json messages/ja.json components/marketing/pages/PrivacyContent.tsx "app/(marketing)/privacy/page.tsx" "app/[locale]/privacy/page.tsx"
rtk git commit -m "feat(privacy): rebuild Privacy (en+ja) on MarketingShell, corrected share/KV facts"
```

---

## Task 3: Terms ページ(en/ja + 部品 + 経路)

**Files:**
- Modify: `messages/en.json`、`messages/ja.json`
- Create: `components/marketing/pages/TermsContent.tsx`
- Modify: `app/(marketing)/terms/page.tsx`
- Create: `app/[locale]/terms/page.tsx`

**Interfaces:**
- Produces: `TermsContent(): React.ReactElement`(目次アンカー付き)。`pages.terms.*` キー:
  `meta.{title,description}` / `hero.{kicker,title,lead,updated}` / `toc.title` / セクション `{heading,body}` を `acceptance`/`service`/`responsibilities`/`ip`/`sharing`/`warranty`/`liability`/`modifications`/`law`/`contact`。

- [ ] **Step 1: `en.json` の `pages` に `terms` を追加**

```json
"terms": {
  "meta": {
    "title": "Terms of Service",
    "description": "AllMarks terms of service — free to use, no account, your data stays in your browser."
  },
  "hero": {
    "kicker": "Terms",
    "title": "Terms of Service",
    "lead": "AllMarks is a free app with no account. These terms explain the basics of using it.",
    "updated": "Last updated: June 18, 2026"
  },
  "toc": { "title": "Contents" },
  "acceptance": {
    "heading": "1. Acceptance of terms",
    "body": "By using AllMarks (\"the Service\"), you agree to these Terms of Service. If you do not agree, please do not use the Service."
  },
  "service": {
    "heading": "2. The service",
    "body": "AllMarks is a free web app for saving bookmarks and arranging them as visual boards. All data is stored locally in your browser, and no account or registration is required."
  },
  "responsibilities": {
    "heading": "3. Your responsibilities",
    "body": "You are responsible for the content you save and share, you agree not to use the Service for any unlawful purpose or to disrupt it, and you understand that your data is stored locally — clearing your browser data permanently deletes your AllMarks content."
  },
  "ip": {
    "heading": "4. Intellectual property",
    "body": "Bookmarks you save reference content owned by third parties; AllMarks claims no ownership of bookmarked content. The AllMarks app, its code, design, and branding belong to AllMarks."
  },
  "sharing": {
    "heading": "5. Sharing content",
    "body": "When you create a share link, the board data is uploaded to our hosting so the link can render it, and is deleted automatically after about 30 days. By sharing, you represent that you have the right to share the content in this way."
  },
  "warranty": {
    "heading": "6. No warranty",
    "body": "The Service is provided \"as is\" and \"as available\" without warranties of any kind. We do not guarantee it will be uninterrupted, secure, or error-free, and we are not responsible for data loss from browser data clearing, device failure, or any other cause."
  },
  "liability": {
    "heading": "7. Limitation of liability",
    "body": "To the maximum extent permitted by law, AllMarks shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service."
  },
  "modifications": {
    "heading": "8. Changes to the service and terms",
    "body": "We may modify or discontinue the Service at any time without notice, and may update these terms from time to time. Continued use after changes means you accept the revised terms."
  },
  "law": {
    "heading": "9. Governing law",
    "body": "These terms are governed by the laws of Japan, and any disputes are subject to the exclusive jurisdiction of the courts of Tokyo, Japan."
  },
  "contact": {
    "heading": "10. Questions",
    "body": "If you have questions about these terms, please reach us through the contact page."
  }
}
```

- [ ] **Step 2: `ja.json` の `pages` に同キー構造で日本語を追加**

```json
"terms": {
  "meta": {
    "title": "利用規約",
    "description": "AllMarks の利用規約 — 無料・アカウント不要・データはあなたのブラウザの中。"
  },
  "hero": {
    "kicker": "Terms",
    "title": "利用規約",
    "lead": "AllMarks はアカウント不要の無料アプリです。この規約は利用の基本を説明します。",
    "updated": "最終更新日: 2026年6月18日"
  },
  "toc": { "title": "目次" },
  "acceptance": {
    "heading": "1. 規約への同意",
    "body": "AllMarks(以下「本サービス」)を利用することで、本利用規約に同意したものとみなされます。同意いただけない場合は、本サービスを利用しないでください。"
  },
  "service": {
    "heading": "2. 本サービスについて",
    "body": "AllMarks はブックマークを保存しビジュアルなボードに並べる無料の Web アプリです。すべてのデータはブラウザのローカルに保存され、アカウントや登録は不要です。"
  },
  "responsibilities": {
    "heading": "3. 利用者の責任",
    "body": "保存・共有するコンテンツについては利用者が責任を負います。違法な目的での利用や本サービスの妨害をしないことに同意するものとします。データはローカルに保存されるため、ブラウザのデータを消すと AllMarks の内容は完全に削除されます。"
  },
  "ip": {
    "heading": "4. 知的財産",
    "body": "保存したブックマークは第三者が権利を持つコンテンツを参照します。AllMarks はブックマークされたコンテンツの所有権を主張しません。AllMarks アプリ・そのコード・デザイン・ブランドは AllMarks に帰属します。"
  },
  "sharing": {
    "heading": "5. コンテンツの共有",
    "body": "共有リンクを作ると、リンクが表示できるようボードのデータが私たちのホスティングにアップロードされ、約30日で自動的に削除されます。共有することで、その方法でコンテンツを共有する権利があることを表明したものとみなされます。"
  },
  "warranty": {
    "heading": "6. 無保証",
    "body": "本サービスは現状有姿かつ提供可能な範囲で提供され、いかなる種類の保証もありません。中断がないこと・安全であること・誤りがないことを保証せず、ブラウザのデータ消去・端末の故障・その他の原因によるデータ損失について責任を負いません。"
  },
  "liability": {
    "heading": "7. 責任の制限",
    "body": "法律で認められる最大限の範囲で、AllMarks は本サービスの利用から生じる間接的・付随的・特別・結果的・懲罰的損害について責任を負いません。"
  },
  "modifications": {
    "heading": "8. サービスと規約の変更",
    "body": "私たちは予告なくいつでも本サービスを変更または終了することがあり、本規約も随時更新することがあります。変更後も利用を続ける場合、改定後の規約に同意したものとみなされます。"
  },
  "law": {
    "heading": "9. 準拠法",
    "body": "本規約は日本法に準拠し、本規約または本サービスに関する紛争は日本国東京の裁判所を専属的合意管轄とします。"
  },
  "contact": {
    "heading": "10. ご質問",
    "body": "本規約についてのご質問は、お問い合わせページからご連絡ください。"
  }
}
```

- [ ] **Step 3: JSON 妥当性確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/ja.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: `TermsContent.tsx` を作る**

`components/marketing/pages/TermsContent.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './legal-page.module.css'

const SECTIONS = [
  'acceptance', 'service', 'responsibilities', 'ip', 'sharing',
  'warranty', 'liability', 'modifications', 'law', 'contact',
] as const

/**
 * Terms 本文(法務読み物・目次アンカー付き)。準拠法=日本/東京(維持)。
 * 共有=KV に一時アップロード+30日削除の事実を反映。スクロール演出なし。
 */
export function TermsContent(): React.ReactElement {
  const { t } = useI18n()
  return (
    <article className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.terms.hero.kicker')}
        </p>
        <h1 className={styles.title}>{t('pages.terms.hero.title')}</h1>
        <p className={styles.lead}>{t('pages.terms.hero.lead')}</p>
        <p className={styles.updated}>{t('pages.terms.hero.updated')}</p>
      </header>

      <nav className={styles.toc} aria-label={t('pages.terms.toc.title')}>
        <p className={styles.tocTitle}>{t('pages.terms.toc.title')}</p>
        <ul className={styles.tocList}>
          {SECTIONS.map((id) => (
            <li key={id}>
              <a href={`#${id}`} className={styles.tocLink}>
                {t(`pages.terms.${id}.heading`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {SECTIONS.map((id) => (
        <section key={id} id={id} className={styles.section}>
          <h2 className={styles.heading}>{t(`pages.terms.${id}.heading`)}</h2>
          <p className={styles.body}>{t(`pages.terms.${id}.body`)}</p>
          {id === 'contact' && (
            <p className={styles.body}>
              <Link href="/contact" className={styles.link}>
                {t('pages.terms.contact.heading')}
              </Link>
            </p>
          )}
        </section>
      ))}
    </article>
  )
}
```

- [ ] **Step 5: 英語 `/terms` を作り直す**

`app/(marketing)/terms/page.tsx`:
```tsx
import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { TermsContent } from '@/components/marketing/pages/TermsContent'
import { pageMetadata } from '@/lib/i18n/page-metadata'

export function generateMetadata(): Metadata {
  return pageMetadata('en', 'terms', 'terms')
}

export default function TermsPage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <MarketingShell locale="en" subpath="terms">
        <TermsContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 6: 14言語 `app/[locale]/terms/page.tsx` を作る**

(Task 2 Step 6 と同型、`privacy`→`terms`、`PrivacyContent`→`TermsContent`)
```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { TermsContent } from '@/components/marketing/pages/TermsContent'
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
  return pageMetadata(locale, 'terms', 'terms')
}

export default async function LocaleTerms({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) notFound()
  return (
    <I18nProvider initialLocale={locale} initialMessages={STATIC_MESSAGES[locale]}>
      <MarketingShell locale={locale} subpath="terms">
        <TermsContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 7: tsc + build**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0、build 成功。`out/terms.html` + `out/ja/terms.html` 等14本生成。

- [ ] **Step 8: Commit**

```bash
rtk git add messages/en.json messages/ja.json components/marketing/pages/TermsContent.tsx "app/(marketing)/terms/page.tsx" "app/[locale]/terms/page.tsx"
rtk git commit -m "feat(terms): rebuild Terms (en+ja) on MarketingShell, Japan governing law kept"
```

---

## Task 4: Contact ページ(en/ja + 部品 + 経路)

**Files:**
- Modify: `messages/en.json`、`messages/ja.json`
- Create: `components/marketing/pages/ContactContent.tsx`
- Modify: `app/(marketing)/contact/page.tsx`
- Create: `app/[locale]/contact/page.tsx`

**Interfaces:**
- Produces: `ContactContent(): React.ReactElement`(短い中央寄せ)。`pages.contact.*` キー:
  `meta.{title,description}` / `hero.{kicker,title,lead}` / `github.{label,body}` / `feedback.{label,body}` / `security.{label,body}`。
- GitHub リンク = `https://github.com/masaya-men/allmarks/issues`(コンポーネント側に定数)。**X 欄は作らない**。個人メアド非掲載。

- [ ] **Step 1: `en.json` の `pages` に `contact` を追加**

```json
"contact": {
  "meta": {
    "title": "Contact",
    "description": "Get in touch about AllMarks — questions, feedback, bug reports, and security, through GitHub."
  },
  "hero": {
    "kicker": "Contact",
    "title": "Get in touch.",
    "lead": "Questions, ideas, and bug reports are all welcome. GitHub is the most reliable way to reach us."
  },
  "github": {
    "label": "GitHub Issues",
    "body": "For bug reports and feature requests, open an issue on GitHub — it's the surest way to be heard."
  },
  "feedback": {
    "label": "Feedback",
    "body": "Ideas for making AllMarks better are always welcome — \"I wish it could do this\" or \"this part is awkward,\" however small."
  },
  "security": {
    "label": "Security",
    "body": "Found a security issue? Please report it privately through GitHub rather than a public issue. Responsible disclosure is much appreciated."
  }
}
```

- [ ] **Step 2: `ja.json` の `pages` に同キー構造で日本語を追加**

```json
"contact": {
  "meta": {
    "title": "お問い合わせ",
    "description": "AllMarks へのご質問・フィードバック・バグ報告・セキュリティは GitHub からどうぞ。"
  },
  "hero": {
    "kicker": "Contact",
    "title": "お気軽にどうぞ。",
    "lead": "ご質問・アイデア・バグ報告など歓迎します。GitHub が最も確実な連絡方法です。"
  },
  "github": {
    "label": "GitHub Issues",
    "body": "バグ報告や機能リクエストは GitHub に issue を立ててください — 最も確実に届きます。"
  },
  "feedback": {
    "label": "フィードバック",
    "body": "AllMarks をより良くするためのアイデアはいつでも歓迎です — 「こんな機能が欲しい」「ここが使いにくい」など、どんな小さなことでも。"
  },
  "security": {
    "label": "セキュリティ",
    "body": "セキュリティ上の問題を見つけた場合は、公開 issue ではなく GitHub から非公開でご報告ください。責任ある開示に感謝します。"
  }
}
```

- [ ] **Step 3: JSON 妥当性確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/ja.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: `ContactContent.tsx` を作る**

`components/marketing/pages/ContactContent.tsx`:
```tsx
'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './legal-page.module.css'

const GITHUB_ISSUES_URL = 'https://github.com/masaya-men/allmarks/issues'

/**
 * Contact 本文(短い中央寄せ)。GitHub Issues 中心・X 欄なし・個人メアド非掲載
 * (確定方針: 個人 FF14 垢はサイト非掲載・拡散専用)。スクロール演出なし。
 */
export function ContactContent(): React.ReactElement {
  const { t } = useI18n()
  return (
    <article className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.contact.hero.kicker')}
        </p>
        <h1 className={styles.title}>{t('pages.contact.hero.title')}</h1>
        <p className={styles.lead}>{t('pages.contact.hero.lead')}</p>
      </header>

      <div className={styles.contactBlock}>
        <section className={styles.contactItem}>
          <p className={styles.contactLabel}>{t('pages.contact.github.label')}</p>
          <p className={styles.contactValue}>
            {t('pages.contact.github.body')}{' '}
            <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
              github.com/masaya-men/allmarks/issues
            </a>
          </p>
        </section>
        <section className={styles.contactItem}>
          <p className={styles.contactLabel}>{t('pages.contact.feedback.label')}</p>
          <p className={styles.contactValue}>{t('pages.contact.feedback.body')}</p>
        </section>
        <section className={styles.contactItem}>
          <p className={styles.contactLabel}>{t('pages.contact.security.label')}</p>
          <p className={styles.contactValue}>{t('pages.contact.security.body')}</p>
        </section>
      </div>
    </article>
  )
}
```

- [ ] **Step 5: 英語 `/contact` を作り直す**

`app/(marketing)/contact/page.tsx`:
```tsx
import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ContactContent } from '@/components/marketing/pages/ContactContent'
import { pageMetadata } from '@/lib/i18n/page-metadata'

export function generateMetadata(): Metadata {
  return pageMetadata('en', 'contact', 'contact')
}

export default function ContactPage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <MarketingShell locale="en" subpath="contact">
        <ContactContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 6: 14言語 `app/[locale]/contact/page.tsx` を作る**

(Task 2 Step 6 同型、`privacy`→`contact`、`PrivacyContent`→`ContactContent`)
```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ContactContent } from '@/components/marketing/pages/ContactContent'
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
  return pageMetadata(locale, 'contact', 'contact')
}

export default async function LocaleContact({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) notFound()
  return (
    <I18nProvider initialLocale={locale} initialMessages={STATIC_MESSAGES[locale]}>
      <MarketingShell locale={locale} subpath="contact">
        <ContactContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 7: tsc + build**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0、build 成功。`out/contact.html` + `out/ja/contact.html` 等14本。旧 `booklage` リンク・X 欄が無いこと。

- [ ] **Step 8: Commit**

```bash
rtk git add messages/en.json messages/ja.json components/marketing/pages/ContactContent.tsx "app/(marketing)/contact/page.tsx" "app/[locale]/contact/page.tsx"
rtk git commit -m "feat(contact): rebuild Contact (en+ja), GitHub allmarks, no X, no personal email"
```

---

## Task 5: Extension Privacy ページ(en/ja 修正版 + 部品 + 経路)

**Files:**
- Modify: `messages/en.json`、`messages/ja.json`
- Create: `components/marketing/pages/ExtensionPrivacyContent.tsx`
- Modify: `app/(marketing)/extension/privacy/page.tsx`
- Create: `app/[locale]/extension/privacy/page.tsx`

**Interfaces:**
- Produces: `ExtensionPrivacyContent(): React.ReactElement`(権限表付き)。`pages.extensionPrivacy.*` キー:
  `meta.{title,description}` / `hero.{kicker,title,lead,updated}` / `does.{heading,body}` / `notCollect.{heading,body}` / `storage.{heading,body}` / `bridge.{heading,body}` / `perms.{heading,activeTab,contextMenus,scripting,offscreen,storage,hostAll,colName,colPurpose}` / `openSource.{heading,body}` / `contact.{heading,body}` / `changes.{heading,body}`。
- 権限名(`activeTab` 等)・`<all_urls>`・`Ctrl+Shift+B`・`chrome.storage.sync`/`chrome.storage.local`・`https://allmarks.app/save-iframe?ext=1` はコンポーネント側に固定コードとして描画(翻訳しない)。`perms.*`(hostAll 等)は purpose の翻訳文のみ。

**最重要(審査直結・旧ページの誤りを継承しない)**: 権限は activeTab/contextMenus/scripting/offscreen/storage + host `<all_urls>` の**6行**。**`notifications` 行を作らない**。`host_permissions` は `<all_urls>`。設定=`chrome.storage.sync`、保存URL控え=`chrome.storage.local`(savedUrlsMirror)。GitHub は `allmarks`。

- [ ] **Step 1: `en.json` の `pages` に `extensionPrivacy` を追加**

```json
"extensionPrivacy": {
  "meta": {
    "title": "Extension Privacy Policy",
    "description": "Privacy policy for the AllMarks Chrome extension — it reads only the page you save and sends nothing to any server."
  },
  "hero": {
    "kicker": "Extension Privacy",
    "title": "AllMarks Extension — Privacy Policy",
    "lead": "The extension reads only the page you choose to save, and sends nothing to any server.",
    "updated": "Last updated: June 18, 2026"
  },
  "does": {
    "heading": "What the extension does",
    "body": "When you click the extension icon, press the keyboard shortcut, or use the right-click \"Save to AllMarks\" menu, the extension reads the URL, page title, description, preview image, site name, and favicon of the active tab (or the link you right-clicked) and writes them as a bookmark into your browser's local database on the allmarks.app origin."
  },
  "notCollect": {
    "heading": "What it does not do",
    "body": "It does not collect, log, or transmit your browsing history. It sends no data to our servers or any third party. It has no analytics, tracking, advertising, or telemetry of any kind. It does not read page contents beyond the Open Graph meta tags above, and only when you trigger a save."
  },
  "storage": {
    "heading": "Where data is stored",
    "body": "Saved bookmarks live only in your browser's local database on the allmarks.app origin. Your extension settings (such as the floating button and cursor pill options) are saved with chrome.storage.sync, so if Chrome sync is on they may sync across your Chrome browsers through Google's infrastructure — we never see them. A local list of which URLs you've already saved is kept with chrome.storage.local so the save button can show an \"already saved\" state; it stays on your device. There is no account, server, or database on our side that stores your bookmarks."
  },
  "bridge": {
    "heading": "How saving reaches the app",
    "body": "To write a bookmark into the same local database the AllMarks web app uses, the extension opens a hidden page at allmarks.app/save-iframe. This bridges from the extension into the allmarks.app origin; no information is sent to any other domain."
  },
  "perms": {
    "heading": "Permissions and why",
    "colName": "Permission",
    "colPurpose": "Purpose",
    "activeTab": "Read the URL and Open Graph meta of the tab you actively save.",
    "contextMenus": "Add the right-click \"Save to AllMarks\" entries.",
    "scripting": "Inject the small extractor that reads the page's meta tags when you save.",
    "offscreen": "Create the offscreen page that hosts the allmarks.app save bridge.",
    "storage": "Save your extension settings and the local \"already saved\" list.",
    "hostAll": "Show the floating save button on the pages you visit and let the save bridge reach allmarks.app. The extension reads a page's meta only when you choose to save it."
  },
  "openSource": {
    "heading": "Open source",
    "body": "The source code is public on GitHub (the extension lives under the extension folder), so anyone can verify exactly what it does."
  },
  "contact": {
    "heading": "Contact",
    "body": "For privacy questions, please use the contact page."
  },
  "changes": {
    "heading": "Changes",
    "body": "We update this page whenever permissions or data flows change. The \"last updated\" date above reflects the most recent change."
  }
}
```

- [ ] **Step 2: `ja.json` の `pages` に同キー構造で日本語を追加**

```json
"extensionPrivacy": {
  "meta": {
    "title": "拡張機能プライバシーポリシー",
    "description": "AllMarks Chrome 拡張のプライバシーポリシー — 保存するページだけを読み取り、どのサーバーにも何も送りません。"
  },
  "hero": {
    "kicker": "Extension Privacy",
    "title": "AllMarks 拡張機能 — プライバシーポリシー",
    "lead": "拡張は、あなたが保存を選んだページだけを読み取り、どのサーバーにも何も送りません。",
    "updated": "最終更新日: 2026年6月18日"
  },
  "does": {
    "heading": "拡張がすること",
    "body": "拡張アイコンをクリックするか、キーボードショートカットを押すか、右クリックの「Save to AllMarks」メニューを使うと、拡張はアクティブなタブ(または右クリックしたリンク)の URL・ページタイトル・説明・プレビュー画像・サイト名・ファビコンを読み取り、allmarks.app オリジンのブラウザのローカルデータベースにブックマークとして書き込みます。"
  },
  "notCollect": {
    "heading": "拡張がしないこと",
    "body": "閲覧履歴を収集・記録・送信しません。私たちのサーバーや第三者にデータを送りません。解析・トラッキング・広告・テレメトリの類は一切ありません。上記の Open Graph メタタグを超えてページ内容を読むことはなく、しかも読むのは保存を実行したときだけです。"
  },
  "storage": {
    "heading": "データの保存先",
    "body": "保存したブックマークは allmarks.app オリジンのブラウザのローカルデータベースの中だけにあります。拡張の設定(フローティングボタンやカーソルピルの設定など)は chrome.storage.sync に保存されるため、Chrome 同期が ON なら Google のインフラ経由で複数の Chrome に同期されることがあります — こちらからは見えません。どの URL を保存済みかのローカルな一覧は chrome.storage.local に保持され、保存ボタンが「保存済み」表示をできるようにします。これは端末内にとどまります。私たちの側にあなたのブックマークを保存するアカウント・サーバー・データベースはありません。"
  },
  "bridge": {
    "heading": "保存がアプリに届く仕組み",
    "body": "AllMarks の Web アプリが使うのと同じローカルデータベースにブックマークを書き込むため、拡張は allmarks.app/save-iframe の隠しページを開きます。これは拡張から allmarks.app オリジンへの橋渡しで、他のドメインには情報を送りません。"
  },
  "perms": {
    "heading": "権限とその理由",
    "colName": "権限",
    "colPurpose": "目的",
    "activeTab": "あなたが能動的に保存するタブの URL と Open Graph メタを読む。",
    "contextMenus": "右クリックの「Save to AllMarks」項目を追加する。",
    "scripting": "保存時にページのメタタグを読む小さな抽出スクリプトを注入する。",
    "offscreen": "allmarks.app への保存橋渡しをホストする offscreen ページを作る。",
    "storage": "拡張の設定とローカルの「保存済み」一覧を保存する。",
    "hostAll": "訪れたページにフローティング保存ボタンを表示し、保存橋渡しが allmarks.app に届くようにする。ページのメタを読むのは、あなたが保存を選んだときだけです。"
  },
  "openSource": {
    "heading": "オープンソース",
    "body": "ソースコードは GitHub で公開されています(拡張は extension フォルダ内)。何をするか誰でも確認できます。"
  },
  "contact": {
    "heading": "お問い合わせ",
    "body": "プライバシーに関するご質問は、お問い合わせページからどうぞ。"
  },
  "changes": {
    "heading": "変更",
    "body": "権限やデータの流れが変わったときにこのページを更新します。上部の「最終更新日」が直近の変更を表します。"
  }
}
```

- [ ] **Step 3: JSON 妥当性確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/ja.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: `ExtensionPrivacyContent.tsx` を作る**

`components/marketing/pages/ExtensionPrivacyContent.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './legal-page.module.css'

const GITHUB_URL = 'https://github.com/masaya-men/allmarks'

/** 権限行: コード名は固定、purpose だけ翻訳キー。manifest v0.1.20 の実権限に一致。 */
const PERMS = [
  { code: 'activeTab', key: 'activeTab' },
  { code: 'contextMenus', key: 'contextMenus' },
  { code: 'scripting', key: 'scripting' },
  { code: 'offscreen', key: 'offscreen' },
  { code: 'storage', key: 'storage' },
  { code: '<all_urls>', key: 'hostAll' },
] as const

/**
 * 拡張プライバシー本文(審査参照ページ)。manifest/extension コード実体に一致させる:
 * 権限6行(notifications 無し)・host <all_urls>・設定=storage.sync・保存控え=storage.local。
 * GitHub=allmarks。スクロール演出なし。
 */
export function ExtensionPrivacyContent(): React.ReactElement {
  const { t } = useI18n()
  return (
    <article className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.extensionPrivacy.hero.kicker')}
        </p>
        <h1 className={styles.title}>{t('pages.extensionPrivacy.hero.title')}</h1>
        <p className={styles.lead}>{t('pages.extensionPrivacy.hero.lead')}</p>
        <p className={styles.updated}>{t('pages.extensionPrivacy.hero.updated')}</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.does.heading')}</h2>
        <p className={styles.body}>{t('pages.extensionPrivacy.does.body')}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.notCollect.heading')}</h2>
        <p className={styles.body}>{t('pages.extensionPrivacy.notCollect.body')}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.storage.heading')}</h2>
        <p className={styles.body}>{t('pages.extensionPrivacy.storage.body')}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.bridge.heading')}</h2>
        <p className={styles.body}>{t('pages.extensionPrivacy.bridge.body')}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.perms.heading')}</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>{t('pages.extensionPrivacy.perms.colName')}</th>
              <th className={styles.th}>{t('pages.extensionPrivacy.perms.colPurpose')}</th>
            </tr>
          </thead>
          <tbody>
            {PERMS.map((p) => (
              <tr key={p.code}>
                <td className={styles.td}><code className={styles.code}>{p.code}</code></td>
                <td className={styles.td}>{t(`pages.extensionPrivacy.perms.${p.key}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.openSource.heading')}</h2>
        <p className={styles.body}>
          {t('pages.extensionPrivacy.openSource.body')}{' '}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
            github.com/masaya-men/allmarks
          </a>
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.contact.heading')}</h2>
        <p className={styles.body}>
          {t('pages.extensionPrivacy.contact.body')}{' '}
          <Link href="/contact" className={styles.link}>/contact</Link>
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.changes.heading')}</h2>
        <p className={styles.body}>{t('pages.extensionPrivacy.changes.body')}</p>
      </section>
    </article>
  )
}
```

- [ ] **Step 5: 英語 `/extension/privacy` を作り直す**

`app/(marketing)/extension/privacy/page.tsx`(Legacy 版を全置換):
```tsx
import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ExtensionPrivacyContent } from '@/components/marketing/pages/ExtensionPrivacyContent'
import { pageMetadata } from '@/lib/i18n/page-metadata'

export function generateMetadata(): Metadata {
  return pageMetadata('en', 'extensionPrivacy', 'extension/privacy')
}

export default function ExtensionPrivacyPage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <MarketingShell locale="en" subpath="extension/privacy">
        <ExtensionPrivacyContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 6: 14言語 `app/[locale]/extension/privacy/page.tsx` を作る**

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ExtensionPrivacyContent } from '@/components/marketing/pages/ExtensionPrivacyContent'
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
  return pageMetadata(locale, 'extensionPrivacy', 'extension/privacy')
}

export default async function LocaleExtensionPrivacy({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) notFound()
  return (
    <I18nProvider initialLocale={locale} initialMessages={STATIC_MESSAGES[locale]}>
      <MarketingShell locale={locale} subpath="extension/privacy">
        <ExtensionPrivacyContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 7: tsc + build(3階層 + extension 共存確認)**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0、build 成功。`out/extension/privacy.html`(英語・新デザイン)+ `out/ja/extension/privacy.html` 等14本生成。**`out/extension.html`(phase B 紹介)も壊れず共存**。権限表に `notifications` 無し・`<all_urls>` あり・GitHub `allmarks`。

- [ ] **Step 8: Commit**

```bash
rtk git add messages/en.json messages/ja.json components/marketing/pages/ExtensionPrivacyContent.tsx "app/(marketing)/extension/privacy/page.tsx" "app/[locale]/extension/privacy/page.tsx"
rtk git commit -m "feat(ext-privacy): rebuild Extension Privacy (en+ja), corrected perms (<all_urls>, no notifications) + allmarks"
```

---

## Task 6: 法務4ページを13言語へ翻訳 + キーパリティテスト

**Files:**
- Modify: `messages/{zh,ko,es,fr,de,pt,it,nl,tr,ru,ar,th,vi}.json`
- Create: `messages/pages-legal-parity.test.ts`

**Interfaces:**
- Consumes: en.json の `pages.{privacy,terms,contact,extensionPrivacy}.*`(Task 2–5 = 基準)。
- Produces: 15言語すべてに同一キー構造。

- [ ] **Step 1: キーパリティテストを先に書く(失敗する)**

`messages/pages-legal-parity.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

function leafKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  )
}

const PAGE_KEYS = ['privacy', 'terms', 'contact', 'extensionPrivacy'] as const

describe('pages 法務4ページ 15言語キーパリティ', () => {
  const en = require('./en.json').pages
  for (const page of PAGE_KEYS) {
    const baseKeys = leafKeys(en[page]).sort()
    for (const locale of SUPPORTED_LOCALES) {
      it(`${locale} の pages.${page} は en と同一 leaf key を持つ`, () => {
        const msgs = require(`./${locale}.json`)
        expect(msgs.pages?.[page], `${locale} に pages.${page} が無い`).toBeDefined()
        expect(leafKeys(msgs.pages[page]).sort()).toEqual(baseKeys)
      })
    }
  }
})
```

- [ ] **Step 2: red 確認**

Run: `rtk vitest run messages/pages-legal-parity.test.ts`
Expected: en/ja PASS、13言語 FAIL。

- [ ] **Step 3: 13言語へ翻訳(並列サブエージェント)**

各言語ファイルの `pages` に `privacy`/`terms`/`contact`/`extensionPrivacy` を en.json 基準で追加。**サブエージェント駆動**で13言語並列。各指示:
- en.json の該当4ブロックを自然に翻訳。**キー構造完全一致**。
- **verbatim 固定(翻訳しない)**: `AllMarks` / `X` / `YouTube` / `GitHub` / `Cloudflare` / `Cloudflare KV` / `Cloudflare R2` / `IndexedDB` / `Chrome` / `Google` / `Open Graph` / `react-tweet` / `oEmbed` / `PNG` / `Ctrl+Shift+B` / コード識別子 `activeTab` `contextMenus` `scripting` `offscreen` `storage` `chrome.storage.sync` `chrome.storage.local` `savedUrlsMirror` `<all_urls>` `allmarks.app` `save-iframe` / `github.com/masaya-men/allmarks/issues`。固有名詞・コード・URL・ドメインはそのまま。
- 法務トーン(明確・正確・誠実)。事実を改変しない(特に「共有は KV/R2 に30日アップロードされる」「権限は notifications 無し・`<all_urls>` あり」を保つ)。準拠法=日本/東京を保つ。
- meta.title/hero.title は各言語で自然な法務用語(プライバシーポリシー/利用規約/お問い合わせ/拡張機能プライバシーポリシー 相当)。日付は各言語で自然に(2026-06-18)。
- ar は翻訳テキストのみ(コード/URL はラテンのまま)。JSON 妥当性厳守。

- [ ] **Step 4: パリティ + 妥当性確認**

Run: `rtk vitest run messages/pages-legal-parity.test.ts`
Expected: PASS(4ページ × 15言語)。

- [ ] **Step 5: 全テスト + tsc + build**

Run: `rtk vitest run && rtk tsc && rtk pnpm build`
Expected: 全 PASS、tsc 0、build 成功。各言語 HTML 焼き込み。

- [ ] **Step 6: Commit**

```bash
rtk git add messages/ messages/pages-legal-parity.test.ts
rtk git commit -m "i18n(pages): translate privacy/terms/contact/extension-privacy to 13 languages + parity test"
```

---

## Task 7: sitemap + nav 全言語化(`LOCALIZED_INTRO_SUBPATHS` 完成)+ Extension紹介の privacy リンク言語化

**Files:**
- Modify: `app/sitemap.ts`
- Modify: `lib/i18n/locale-urls.ts`
- Modify: `components/marketing/pages/ExtensionContent.tsx`
- Modify: `app/(marketing)/extension/page.tsx`、`app/[locale]/extension/page.tsx`
- Test: `app/sitemap.test.ts`(集客の describe に法務4ページを追記)

**Interfaces:**
- `LOCALIZED_INTRO_SUBPATHS` に `contact`/`privacy`/`terms`/`extension/privacy` を追加 → nav 全言語化完成(全ページ生成済みで 404 安全)。
- sitemap に法務4ページ×15言語。
- `ExtensionContent` に `locale` prop を足し、privacy リンクを `navHref(locale,'extension/privacy')` + 翻訳ラベルに(フェーズB の英語固定残債を回収)。

- [ ] **Step 1: sitemap テストを追記(red)**

`app/sitemap.test.ts` に describe 追記:
```ts
describe('sitemap 法務4ページ', () => {
  const urls = sitemap().map((e) => e.url)
  for (const page of ['privacy', 'terms', 'contact'] as const) {
    it(`${page} は15言語ぶん存在する`, () => {
      expect(urls.filter((u) => u.endsWith(`/${page}`))).toHaveLength(15)
    })
  }
  it('extension/privacy は15言語ぶん存在する', () => {
    expect(urls.filter((u) => u.endsWith('/extension/privacy'))).toHaveLength(15)
  })
})
```

- [ ] **Step 2: red 確認**

Run: `rtk vitest run app/sitemap.test.ts`
Expected: FAIL(privacy/terms/contact は英語フラット1本、extension/privacy 未登録)。

- [ ] **Step 3: sitemap を15言語エントリ化**

`app/sitemap.ts` の routes 配列で、既存の単独 `/contact` `/privacy` `/terms` 行を削除し言語別マップに置換 + extension/privacy 追加:
```ts
    // Contact(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'contact'),
      priority: 0.6,
      changeFrequency: 'monthly' as const,
    })),
    // Privacy(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'privacy'),
      priority: 0.5,
      changeFrequency: 'monthly' as const,
    })),
    // Terms(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'terms'),
      priority: 0.5,
      changeFrequency: 'monthly' as const,
    })),
    // Extension Privacy(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'extension/privacy'),
      priority: 0.5,
      changeFrequency: 'monthly' as const,
    })),
```
※ 既存の `{ path: '/contact' }` `{ path: '/privacy' }` `{ path: '/terms' }` 3行は削除。

- [ ] **Step 4: green 確認**

Run: `rtk vitest run app/sitemap.test.ts`
Expected: PASS。

- [ ] **Step 5: `LOCALIZED_INTRO_SUBPATHS` を完成**

`lib/i18n/locale-urls.ts`:
```ts
export const LOCALIZED_INTRO_SUBPATHS: ReadonlySet<string> = new Set([
  'about',
  'features',
  'guide',
  'faq',
  'extension',
  'extension/privacy',
  'contact',
  'privacy',
  'terms',
])
```

- [ ] **Step 6: Extension紹介の privacy リンクを言語化**

`components/marketing/pages/ExtensionContent.tsx` に `locale` prop を足し(`navHref` 用)、privacy リンクを言語化:
```tsx
import { navHref } from '@/lib/i18n/locale-urls'
import type { SupportedLocale } from '@/lib/i18n/config'
// シグネチャ:
export function ExtensionContent({ locale }: { locale: SupportedLocale }): React.ReactElement {
  // …
  // privacy セクションのリンクを:
  //   <Link href="/extension/privacy" className={styles.link}>Extension privacy</Link>
  // から:
  //   <Link href={navHref(locale, 'extension/privacy')} className={styles.link}>
  //     {t('pages.extensionPrivacy.hero.kicker')}
  //   </Link>
  // に変更(ラベルは extensionPrivacy の kicker='Extension Privacy' を流用=翻訳済み)。
}
```
呼び出し側 `app/(marketing)/extension/page.tsx` は `<ExtensionContent locale="en" />`、`app/[locale]/extension/page.tsx` は `<ExtensionContent locale={locale} />` を渡す。

- [ ] **Step 7: tsc + 全テスト + build**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0、全 PASS、build 成功。nav の全 subpath が言語接頭辞付き(`/ja/contact` 等)に。

- [ ] **Step 8: Commit**

```bash
rtk git add app/sitemap.ts app/sitemap.test.ts lib/i18n/locale-urls.ts components/marketing/pages/ExtensionContent.tsx "app/(marketing)/extension/page.tsx" "app/[locale]/extension/page.tsx"
rtk git commit -m "feat(seo): sitemap + full nav localization for legal pages; extension privacy link localized"
```

---

## Task 8: 通し検証 + 本番デプロイ + 実機 calibration + ドキュメント

**Files:** `docs/TODO.md`、`docs/CURRENT_GOAL.md`、`docs/TODO_COMPLETED.md`

- [ ] **Step 1: 全テスト + tsc + build**

Run: `rtk vitest run && rtk tsc && rtk pnpm build`
Expected: 全 PASS、tsc 0、build 成功。

- [ ] **Step 2: 旧語/誤りが残っていないか grep**

Run:
```bash
rtk grep -i "booklage" components/marketing/pages app/\[locale\]
rtk grep "notifications" components/marketing/pages
rtk grep -i "allmarks.app/\*" messages/
```
Expected: 法務 Content に `booklage` 無し(GitHub=allmarks)、権限に `notifications` 無し、`host_permissions: allmarks.app/*` の誤り無し。

- [ ] **Step 3: 本番デプロイ**

```bash
npx wrangler whoami
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message "deploy: intro pages phase C (legal i18n)"
```

- [ ] **Step 4: 本番実機 calibration**

- `allmarks.app/privacy` `/terms` `/contact` `/extension/privacy`(英語)+ `/ja/...` 等が正しい言語で開く。
- `curl -s https://allmarks.app/ja/privacy | grep -E 'hreflang|canonical'` で hreflang16・canonical=`/ja/privacy`。
- privacy/terms の目次アンカーが効く(クリックで該当見出しに飛び、固定ヘッダーに隠れない)。
- 拡張プライバシーの権限表が `<all_urls>` を含み `notifications` を含まない。GitHub=allmarks。
- ヘッダー/フッター nav が全 subpath で言語接頭辞付き(`/ja/contact` 等)。Contact に X 欄なし。
- Extension紹介(`/extension`)と extension-privacy(`/extension/privacy`)が共存。

- [ ] **Step 5: ドキュメント更新 + Commit**

`docs/TODO.md`「現在の状態」(セッション112: フェーズC = 紹介ページ群 全9ページ完成)、`docs/CURRENT_GOAL.md`(次 = 拡張ストア審査提出 / オンボーディング等)、`docs/TODO_COMPLETED.md` に narrative。
```bash
rtk git add docs/
rtk git commit -m "docs: intro pages phase C (legal i18n) shipped; intro pages all 9 done"
```

---

## Self-Review

**1. Spec coverage:**
- §2 法務C 4ページ → Task 2(privacy)/3(terms)/4(contact)/5(extension-privacy)。✓
- §3 URL/ルーティング(英語フラット + `[locale]` + 2階層 extension/privacy)→ 各経路 + Task 5 Step 7 共存確認。✓
- §5.3 法務デザイン(1カラム読み物・目次・最終更新日・演出なし・Contact 中央寄せ)→ Task 1(legal-page.module.css)+ 各 Content。✓
- §6.3 内容(privacy 正確化 / terms 平易 / contact GitHub中心・X無し・メアド無し / extension-privacy 正確)→ §確定済みプロダクト事実 + 各コピー。共有 KV/R2 30日・拡張権限 `<all_urls>`/notifications無し を**訂正反映**。✓
- §7 多言語 → Task 2–5(en/ja)+ Task 6(13言語 + parity)。✓
- §4.2 nav 言語化 → Task 7(`LOCALIZED_INTRO_SUBPATHS` 完成 + Extension紹介リンク言語化)。✓
- §11 テスト → Task 6(parity)/7(sitemap)/8(通し+本番)。✓
- §12 フェーズC → 本プラン。これで紹介9ページ全完成。✓

**2. Placeholder scan:** 各 Step に実コード/コマンド/期待値/実コピー(en+ja 全文)あり。13言語はサブエージェント指示明記。プレースホルダ無し。✓

**3. Type consistency:** 全 `[locale]` ラッパは `isPrefixedLocale`/`generateStaticParams`/`pageMetadata(locale,'<page>','<subpath>')`/`MarketingShell locale/subpath` を同一シグネチャで使用。extension-privacy は subpath='extension/privacy'(2階層)・pageKey='extensionPrivacy'。`legal-page.module.css` クラス名(root/hero/toc/section/heading/body/table/th/td/code/contactBlock 等)は Task 1 定義と各 Content の参照が一致。`ExtensionContent({locale})` の prop 追加は Task 7 で呼び出し2箇所も更新。✓

**意図的に後続送り**: オンボーディング、拡張ストア審査の実提出、`OG_LOCALE` 重複の共有定数化(第3利用者待ち)、ar の RTL レイアウト対応(翻訳テキストのみ)。

---

## Execution Handoff

フェーズC(法務4ページ)の実装計画です。完了すると: Privacy / Terms / Contact / Extension Privacy が15言語の専用URLで稼働し、内容は現行プロダクトの事実に正確一致(共有のサーバー保存・拡張権限を訂正)、落ち着いた読み物デザインで統一、nav が全 subpath 言語化されます。**これで紹介9ページ全てが英語+14言語で完成し、拡張ストア審査に出せる正確なプライバシー導線が整います。**
</parameter>
