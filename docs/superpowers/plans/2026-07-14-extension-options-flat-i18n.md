# Plan — 拡張設定(options)の脱サウンド演出フラット化 ＋ 15言語 i18n（サブ6）

日付: 2026-07-14 / 親 spec: [2026-07-14-theme-scope-principle-design.md](../specs/2026-07-14-theme-scope-principle-design.md) §4・§7サブ6
粒度: **安価モデルが写経できる実 file:line・実コード埋め込み**。推測不要、この plan の通りに置換すれば完成する。

---

## 0. スコープと不変則

- 対象は `extension/` 内のみ（`options.html` / `options.css` / `options.js` / `popup.html` / `manifest.json` / `_locales/` / `tests/extension/`）。**盤面コード・盤面 `messages/*.json` は一切触らない**（別系統）。
- **脱サウンド演出**: SIGNAL/オシロスコープ/SYNC/MOTION/EQ/波形/フェーダー/globe/信号メーターを除去し、フラットで静かな中立メニューにする。
- **機能は不変**: `chrome.storage.sync` の保存キー・保存ロジック（`options.js` の `DEFAULTS`・各 `change`/`input` ハンドラ）は変えない。見た目と文言だけ変える。
- **15言語**: Chrome 標準 `_locales/<lang>/messages.json` 方式。表示言語は**ブラウザUI言語**（`chrome.i18n.getUILanguage()`）に自動追従、未対応言語は `default_locale=en` にフォールバック。
- **訳さない語**（globally-clear English 方針）: `AllMarks`、nav の `GENERAL`/`SETTINGS`/`SHORTCUTS`/`ABOUT`、プラットフォーム名 `X (Twitter)`/`note`/`スキ`/`Vimeo`/`YouTube`/`SoundCloud`、`Ctrl+Shift+B`/`⌘+Shift+B`/`Mac`、`example.com`。→ これらは HTML に**リテラルのまま**置き、`data-i18n` を付けない。
- ロケールコード（15）: `ja en zh ko es fr de pt it nl tr ru ar th vi`（`lib/i18n/config.ts:1-5` と一致）。Chrome の `_locales/` フォルダ名はこの base コードをそのまま使う（`zh` は generic 中国語で統一。`zh_CN`/`zh_TW` に分けない）。

---

## 1. `extension/options.html` — 全文差し替え

現状 210 行（サウンド演出だらけ）を、以下の**完全な新ファイル**で上書きする（Write ツールで全置換）。除去したもの・残したものは §1-2 に明記。

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AllMarks settings</title>
  <link rel="stylesheet" href="options.css" />
</head>
<body>
  <div class="app">
    <!-- ───────────── Sidebar ───────────── -->
    <aside class="sidebar">
      <div class="wordmark">AllMarks</div>

      <nav class="nav" id="nav">
        <a class="nav-item" data-target="card-autosave">GENERAL</a>
        <a class="nav-item is-active" data-target="card-floating">SETTINGS</a>
        <a class="nav-item" data-target="card-shortcut">SHORTCUTS</a>
        <a class="nav-item" data-target="about">ABOUT</a>
      </nav>

      <div class="side-foot">
        <div class="count">AllMarks · <b class="saved-count">—</b></div>
        <div class="ver">v<span id="verNum">—</span></div>
      </div>
    </aside>

    <!-- ───────────── Main ───────────── -->
    <main class="main">
      <h1 class="page-title" data-i18n="optDocTitle">AllMarks settings</h1>

      <div class="cards">

        <!-- 01 Auto-save -->
        <section class="card" id="card-autosave">
          <div class="card-head">
            <span class="card-title"><span class="num">01</span><span data-i18n="optAutosaveTitle">Auto-save on SNS button</span></span>
            <span class="saved"><i class="dot"></i><span data-i18n="optSaved">Saved</span></span>
          </div>
          <p class="lede" data-i18n="optAutosaveLede">When you press one of these buttons, the page is automatically saved to AllMarks. Already-saved URLs are skipped silently.</p>
          <div class="opt-grid">
            <label class="opt"><input class="am" type="checkbox" id="autoSaveXLike" /><span data-i18n="optAutosaveXLike">X (Twitter) — Like button</span></label>
            <label class="opt"><input class="am" type="checkbox" id="autoSaveNoteLike" /><span data-i18n="optAutosaveNoteLike">note — スキ button</span></label>
            <label class="opt"><input class="am" type="checkbox" id="autoSaveXBookmark" /><span data-i18n="optAutosaveXBookmark">X (Twitter) — Bookmark button</span></label>
            <label class="opt"><input class="am" type="checkbox" id="autoSaveVimeoLike" /><span data-i18n="optAutosaveVimeoLike">Vimeo — Like button</span></label>
            <label class="opt"><input class="am" type="checkbox" id="autoSaveYouTubeLike" /><span data-i18n="optAutosaveYouTubeLike">YouTube — Like button</span></label>
            <label class="opt"><input class="am" type="checkbox" id="autoSaveVimeoWatchLater" /><span data-i18n="optAutosaveVimeoWatchLater">Vimeo — Watch later button</span></label>
            <label class="opt"><input class="am" type="checkbox" id="autoSaveYouTubeWatchLater" /><span data-i18n="optAutosaveYouTubeWatchLater">YouTube — Watch later</span></label>
            <label class="opt"><input class="am" type="checkbox" id="autoSaveSoundCloudLike" /><span data-i18n="optAutosaveSoundCloudLike">SoundCloud — Like button</span></label>
          </div>
        </section>

        <!-- 02 Cursor pill -->
        <section class="card" id="card-cursor">
          <div class="card-head">
            <span class="card-title"><span class="num">02</span><span data-i18n="optCursorTitle">Cursor pill position when no mouse data</span></span>
            <span class="saved"><i class="dot"></i><span data-i18n="optSaved">Saved</span></span>
          </div>
          <div class="radios">
            <label class="opt"><input class="am" type="radio" name="pillPos" value="cursor" /><span data-i18n="optCursorAtCursor">At cursor</span></label>
            <label class="opt"><input class="am" type="radio" name="pillPos" value="bottom-right" /><span data-i18n="optCursorBottomRight">Bottom-right corner</span></label>
          </div>
        </section>

        <!-- 03 Floating save button -->
        <section class="card" id="card-floating">
          <div class="card-head">
            <span class="card-title"><span class="num">03</span><span data-i18n="optFloatingTitle">Floating save button</span></span>
            <span class="saved"><i class="dot"></i><span data-i18n="optSaved">Saved</span></span>
          </div>
          <p class="lede" data-i18n="optFloatingLede">A small mark sits on the edge of every page. Click to save the page to AllMarks. Long-press to drag — it snaps to the nearest left or right edge. Already-saved pages show a permanent green check.</p>
          <label class="opt stack field-row toggle"><input class="am" type="checkbox" id="floatingButtonEnabled" /><span data-i18n="optFloatingToggle">Show floating save button on all pages</span></label>

          <div class="slider-row">
            <span class="slabel" data-i18n="optFloatingIdleOpacity">Idle opacity</span>
            <input class="am" type="range" id="floatingButtonIdleOpacity" min="0" max="60" step="5" value="30" />
            <span class="sval" id="idleOpacityLabel">30%</span>
          </div>

          <div class="field-row">
            <button class="am" type="button" id="floatingButtonResetPosition" data-i18n="optFloatingReset">Reset position to right edge, middle</button>
          </div>

          <div class="card-sub" data-i18n="optFloatingHideTitle">Hide on specific sites</div>
          <p class="lede" data-i18n="optFloatingHideLede">Add a domain (e.g. example.com) to hide the floating button on that site only. Other save shortcuts still work.</p>
          <div class="domain-list" id="floatingButtonDisabledList"></div>
          <div class="field-row">
            <input class="am" type="text" id="floatingButtonAddDomain" placeholder="example.com" />
            <button class="am flat" type="button" id="floatingButtonAddDomainBtn" data-i18n="optFloatingAdd">Add</button>
          </div>
        </section>

        <!-- 04 Keyboard shortcut -->
        <section class="card" id="card-shortcut">
          <div class="card-head">
            <span class="card-title"><span class="num">04</span><span data-i18n="optShortcutTitle">Keyboard shortcut</span></span>
            <span class="saved"><i class="dot"></i><span data-i18n="optSaved">Saved</span></span>
          </div>
          <div class="field-row">
            <span class="kbd-label" data-i18n="optShortcutDefault">Default:</span>
            <span class="kbd-chip">Ctrl+Shift+B</span>
            <span class="kbd-note" data-i18n="optShortcutMacNote">(Mac: ⌘+Shift+B)</span>
          </div>
          <div class="field-row">
            <button class="am" type="button" id="shortcuts-link" data-i18n="optShortcutCustomize">Customize shortcuts</button>
          </div>
        </section>

        <!-- About -->
        <section class="about" id="about">
          <h2 data-i18n="optAboutTitle">About</h2>
          <p data-i18n="optAboutBody">AllMarks saves any URL — tweets, videos, articles — as a beautiful visual collage card. The extension keeps your bookmarks in your own browser and sends them to no server — no account, no tracking, no analytics.</p>
          <p><a id="openBoard" href="#" data-i18n="optAboutOpenBoard">Open AllMarks board →</a></p>
        </section>
      </div>
    </main>
  </div>
  <script src="options.js"></script>
</body>
</html>
```

### 1-1. 除去した要素（旧 options.html の該当 file:line）
| 除去物 | 旧 line |
|---|---|
| サイドバー `MOTION` ドット | 21-24（`.side-block`） |
| `.signal` オシロスコープ丸ごと（SIGNAL/LIVE/scope/SYNC/波形2本） | 26-39 |
| `.side-foot` の `BUILD`（VER は残し `v<version>` に統合） | 42-44 |
| `.topbar` 丸ごと（MOTION + count + `.eq` EQ10本） | 49-66 |
| `.title-wave` 波形SVG | 69-73 |
| 各カードの `.fader` ミキサーフェーダー | 79-83 / 105-108 / 132-136 / 167-170 |
| `.globe` 地球儀SVG（card-floating 内） | 123-131 |
| `.footer` 丸ごと（SYSTEM HEALTH/GOOD/SIGNAL STRENGTH/信号メーター/KEEP MOVING・KEEP MARKING） | 196-205 |
| ページ見出しの巨大な `ALLMARKS SETTINGS`（h1 は残すが文言=optDocTitle に統一） | 68 |

### 1-2. 残した要素（機能そのもの・そのまま）
- nav 4項目（`data-target` 温存 → `options.js` の `setupNav()` がそのまま動く）。
- カード5枚の**全 input の id**（`autoSaveXLike` 等・`pillPos` radio・`floatingButtonEnabled`・`floatingButtonIdleOpacity`・`floatingButtonResetPosition`・`floatingButtonAddDomain`・`floatingButtonAddDomainBtn`・`shortcuts-link`・`openBoard`）は**一字一句不変**。`options.js` は id で掴むので壊れない。
- `.saved-count`（保存件数）・`#verNum`（バージョン）は残す（`applySavedCount`/`applyVersion` が使う。`#buildNum` は削除したので §3 で該当行も削る）。
- `.saved` 保存インジケータは残す（機能フィードバック）。文言のみ `optSaved`="Saved" に i18n 化。

---

## 2. `extension/options.css` — 全文差し替え（フラット中立）

現状 590 行を、以下の**完全な新ファイル**で上書きする。サウンド演出セレクタ（`.signal`/`.scope`/`.motion`/`.eq`/`.title-wave`/`.fader`/`.globe`/`.strength` と `@keyframes eq-bounce`/`pulse-dot`/`saved-flash`）は**すべて削除**。機能系（checkbox/radio/slider/button/input/domain/nav）は残し、オレンジ多用の演出を落として静かな中立トーンにする。Geist フォントは維持。

```css
/* ── AllMarks settings — flat neutral (theme-independent) ── */
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('fonts/geist-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'Geist Mono';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('fonts/geist-mono-latin.woff2') format('woff2');
}

:root {
  color-scheme: dark;
  --bg: #0b0b0d;
  --panel: #141416;
  --line: rgba(255, 255, 255, 0.10);
  --line-soft: rgba(255, 255, 255, 0.06);
  --ink: rgba(255, 255, 255, 0.92);
  --ink-2: rgba(255, 255, 255, 0.60);
  --ink-3: rgba(255, 255, 255, 0.38);
  --accent: #28f100;        /* A-mark green — used only for check/saved/active */
  --accent-soft: #3ad16a;
  --focus: rgba(255, 255, 255, 0.55);
  --mono: 'Geist Mono', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  --sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

* { box-sizing: border-box; }
html, body { height: 100%; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.app {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  max-width: 1040px;
  min-height: 100vh;
  margin: 0 auto;
}

/* ───────── Sidebar ───────── */
.sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  padding: 30px 24px;
  border-right: 1px solid var(--line-soft);
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.wordmark {
  font-family: var(--sans);
  font-weight: 700;
  font-size: 26px;
  letter-spacing: -0.02em;
  line-height: 1;
  color: #fff;
}
.nav { display: flex; flex-direction: column; gap: 2px; }
.nav-item {
  position: relative;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--ink-3);
  padding: 8px 0 8px 16px;
  cursor: pointer;
  text-decoration: none;
  user-select: none;
  transition: color 0.15s ease;
}
.nav-item::before {
  content: '';
  position: absolute;
  left: 0; top: 50%;
  width: 3px; height: 0;
  border-radius: 2px;
  background: var(--ink-3);
  transform: translateY(-50%);
  transition: height 0.15s ease, background 0.15s ease;
}
.nav-item:hover { color: var(--ink-2); }
.nav-item.is-active { color: #fff; }
.nav-item.is-active::before { height: 15px; background: var(--accent); }

.side-foot {
  margin-top: auto;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--ink-3);
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.side-foot .count b { color: var(--ink); font-weight: 500; }

/* ───────── Main ───────── */
.main { padding: 34px 40px 40px; min-width: 0; }
.page-title {
  font-family: var(--sans);
  font-weight: 600;
  font-size: 24px;
  letter-spacing: -0.01em;
  margin: 0 0 28px;
  color: #fff;
}

.cards { display: flex; flex-direction: column; gap: 16px; }

/* ── Card ── */
.card {
  padding: 22px 24px 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}
.card-title {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.10em;
  color: #fff;
  text-transform: uppercase;
}
.card-title .num { color: var(--ink-3); margin-right: 12px; }

.saved {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.10em;
  color: var(--accent-soft);
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.saved.is-saving { opacity: 1; }
.saved .dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

.lede {
  font-size: 13px;
  line-height: 1.6;
  color: var(--ink-2);
  margin: 0 0 16px;
  max-width: 64ch;
}
.lede code, code {
  font-family: var(--mono);
  background: rgba(255, 255, 255, 0.07);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.92em;
}

/* ── Rows / controls ── */
.opt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 28px;
}
.opt {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--ink);
  cursor: pointer;
  user-select: none;
}
.radios { display: flex; flex-direction: column; gap: 14px; }

/* custom checkbox / radio (neutral, green only when checked) */
input[type='checkbox'].am, input[type='radio'].am {
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
  flex: none;
  width: 20px; height: 20px;
  border: 1.5px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  position: relative;
  transition: border-color 0.15s ease, background 0.15s ease;
}
input[type='checkbox'].am { border-radius: 5px; }
input[type='radio'].am { border-radius: 50%; }
input[type='checkbox'].am:hover, input[type='radio'].am:hover { border-color: rgba(255, 255, 255, 0.5); }
input[type='checkbox'].am:checked {
  background: var(--accent);
  border-color: var(--accent);
}
input[type='checkbox'].am:checked::after {
  content: '';
  position: absolute;
  left: 6px; top: 2px;
  width: 5px; height: 10px;
  border: solid #05230a;
  border-width: 0 2.2px 2.2px 0;
  transform: rotate(43deg);
}
input[type='radio'].am:checked { border-color: var(--accent); }
input[type='radio'].am:checked::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: var(--accent);
}
input:focus-visible.am { outline: 2px solid var(--focus); outline-offset: 2px; }

/* sub-divider inside a card */
.card-sub {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: #fff;
  margin: 22px 0 10px;
  padding-top: 20px;
  border-top: 1px solid var(--line-soft);
}
.field-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin: 14px 0; }
.field-row.toggle { margin-top: 0; }

/* idle opacity slider */
.slider-row { display: flex; align-items: center; gap: 16px; margin: 16px 0; }
.slider-row .slabel { font-size: 12px; color: var(--ink-2); white-space: nowrap; }
input[type='range'].am {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  max-width: 280px;
  height: 4px;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--ink) var(--fill, 50%), rgba(255, 255, 255, 0.12) var(--fill, 50%));
  cursor: pointer;
}
input[type='range'].am::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
}
.slider-row .sval { font-size: 12px; color: var(--ink); white-space: nowrap; }

/* buttons (flat, no orange dot) */
button.am {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 9px 15px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}
button.am:hover { border-color: rgba(255, 255, 255, 0.28); background: rgba(255, 255, 255, 0.08); color: #fff; }

/* domain list */
.domain-list { margin: 2px 0 14px; display: flex; flex-direction: column; gap: 8px; }
.domain-list:empty { display: none; }
.domain-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  font-size: 13px;
}
.domain-row .name { flex: 1; color: var(--ink); }
.domain-empty { font-size: 12px; color: var(--ink-3); margin: 0 0 14px; }

input[type='text'].am {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--ink);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 9px 13px;
  flex: 1;
  max-width: 320px;
  outline: none;
  transition: border-color 0.15s ease;
}
input[type='text'].am::placeholder { color: var(--ink-3); }
input[type='text'].am:focus { border-color: rgba(255, 255, 255, 0.32); }

/* keyboard chip */
.kbd-chip {
  display: inline-block;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.06em;
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 6px 12px;
}
.kbd-note { font-size: 12px; color: var(--ink-3); }
.kbd-label { font-size: 13px; color: var(--ink-2); }

/* about */
.about {
  margin-top: 16px;
  padding: 20px 24px;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.015);
}
.about h2 {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  margin: 0 0 10px;
  font-weight: 500;
  color: #fff;
}
.about p { font-size: 13px; color: var(--ink-2); margin: 0 0 8px; max-width: 62ch; line-height: 1.6; }
.about a { color: var(--accent-soft); text-decoration: none; }
.about a:hover { text-decoration: underline; }

@media (max-width: 760px) {
  .app { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; border-right: none; border-bottom: 1px solid var(--line-soft); }
  .main { padding: 24px 22px; }
  .opt-grid { grid-template-columns: 1fr; }
}
```

> 注: `.saved` は既定 `opacity:0`、`.is-saving` で表示（`options.js` の `pulseSaved` が `is-saving` を付ける）。旧コードは常時表示＋amberパルスだったが、静かな中立トーンに変更。旧 `saved-flash`/`flash` アニメは削除したので、§3 で `pulseSaved` の flash 分岐を簡略化する。

---

## 3. `extension/options.js` — 精密編集

id/保存ロジックは不変。**(A) i18n ローダ追加、(B) JS 内ハードコード英語の置換、(C) 削除要素(#buildNum・flash)への追随**の3点のみ。

### (A) 冒頭に i18n ローダ関数を追加
`const $ = (id) => document.getElementById(id)`（現 L1）の**直後**に以下を挿入:

```js
// ── i18n: replace [data-i18n*] with chrome.i18n messages (browser UI language) ──
function applyI18n() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const msg = chrome.i18n.getMessage(el.dataset.i18n)
    if (msg) el.textContent = msg
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const msg = chrome.i18n.getMessage(el.dataset.i18nPlaceholder)
    if (msg) el.setAttribute('placeholder', msg)
  }
  const title = chrome.i18n.getMessage('optDocTitle')
  if (title) document.title = title
  document.documentElement.lang = chrome.i18n.getUILanguage()
}
```

### (B) JS 内文字列の置換（3か所5行）
現 `applyIdleOpacityUi`（L46-53）内:
- L50 `if (percent === 0) label.textContent = '0% (HIDDEN UNTIL HOVER)'`
  → `if (percent === 0) label.textContent = chrome.i18n.getMessage('optIdleOpacityHidden')`
- L51 `else if (percent === 30) label.textContent = '30% (DEFAULT)'`
  → `else if (percent === 30) label.textContent = chrome.i18n.getMessage('optIdleOpacityDefault')`
- L52 `else label.textContent = percent + '%'` → **変更なし**（数値のみ）

現 `renderDisabledDomains`（L72-103）内:
- L78 `empty.textContent = 'NO SITES HIDDEN YET.'`
  → `empty.textContent = chrome.i18n.getMessage('optFloatingNoSites')`
- L91 `btn.textContent = 'REMOVE'`
  → `btn.textContent = chrome.i18n.getMessage('optFloatingRemove')`

### (C) 削除要素への追随
1. **`#buildNum` 削除に伴い** `applyVersion`（現 L196-204）の該当行を削る:
   - L200 `$('buildNum').textContent = String(m.version).replace(/\./g, '').padStart(4, '0')` → **この行を削除**（`#verNum` 行は残す）。
2. **`pulseSaved` の flash 簡略化**（現 L30-43）: 旧 CSS の `saved-flash`/`flash` を削除したので、flash 系を外し `is-saving` のみ点滅させる。関数全体を以下に置換:
```js
function pulseSaved(controlEl) {
  const card = controlEl && controlEl.closest('.card')
  const saved = card && card.querySelector('.saved')
  if (!saved) return
  saved.classList.add('is-saving')
  clearTimeout(saved._t)
  saved._t = setTimeout(() => saved.classList.remove('is-saving'), 1200)
}
```
3. **末尾に `applyI18n()` を呼ぶ**。現 L250-253:
```js
applyVersion()
applySavedCount()
setupNav()
load()
```
の**先頭**に `applyI18n()` を追加（`applyI18n()` を1行目に）。

> `#verNum` / `.saved-count` / `#nav`(setupNav の `.nav-item[data-target]`) / 全 input id は新 HTML に温存済みなので、他のハンドラ（L116-193, 207-248）は**無変更**。

---

## 4. `_locales/<lang>/messages.json` — 全キー定義（15言語）

### 4-1. キー一覧・英語原文・description（en が正本）
`extension/_locales/en/messages.json` は現在 `{}`。以下で上書き（**description は en のみ**。他14言語は `message` のみ＝Chrome 標準・パリティ検査もこの前提）。

```json
{
  "extName": { "message": "AllMarks", "description": "Extension name (brand, keep literal)." },
  "extDescription": { "message": "Save any URL to AllMarks as a beautiful visual collage card.", "description": "Store listing / manifest description." },
  "optDocTitle": { "message": "AllMarks settings", "description": "Options page <title> and H1." },
  "optAutosaveTitle": { "message": "Auto-save on SNS button", "description": "Card 01 title." },
  "optAutosaveLede": { "message": "When you press one of these buttons, the page is automatically saved to AllMarks. Already-saved URLs are skipped silently.", "description": "Card 01 description." },
  "optAutosaveXLike": { "message": "X (Twitter) — Like button", "description": "Keep 'X (Twitter)' literal; translate 'Like button'." },
  "optAutosaveNoteLike": { "message": "note — スキ button", "description": "Keep 'note' and 'スキ' literal; translate 'button'." },
  "optAutosaveXBookmark": { "message": "X (Twitter) — Bookmark button", "description": "Keep 'X (Twitter)' literal." },
  "optAutosaveVimeoLike": { "message": "Vimeo — Like button", "description": "Keep 'Vimeo' literal." },
  "optAutosaveYouTubeLike": { "message": "YouTube — Like button", "description": "Keep 'YouTube' literal." },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — Watch later button", "description": "Keep 'Vimeo' literal." },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — Watch later", "description": "Keep 'YouTube' literal." },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — Like button", "description": "Keep 'SoundCloud' literal." },
  "optCursorTitle": { "message": "Cursor pill position when no mouse data", "description": "Card 02 title." },
  "optCursorAtCursor": { "message": "At cursor", "description": "Card 02 radio A." },
  "optCursorBottomRight": { "message": "Bottom-right corner", "description": "Card 02 radio B." },
  "optFloatingTitle": { "message": "Floating save button", "description": "Card 03 title." },
  "optFloatingLede": { "message": "A small mark sits on the edge of every page. Click to save the page to AllMarks. Long-press to drag — it snaps to the nearest left or right edge. Already-saved pages show a permanent green check.", "description": "Card 03 description." },
  "optFloatingToggle": { "message": "Show floating save button on all pages", "description": "Card 03 toggle." },
  "optFloatingIdleOpacity": { "message": "Idle opacity", "description": "Card 03 slider label." },
  "optFloatingReset": { "message": "Reset position to right edge, middle", "description": "Card 03 reset button." },
  "optFloatingHideTitle": { "message": "Hide on specific sites", "description": "Card 03 sub-section title." },
  "optFloatingHideLede": { "message": "Add a domain (e.g. example.com) to hide the floating button on that site only. Other save shortcuts still work.", "description": "Keep 'example.com' literal." },
  "optFloatingAdd": { "message": "Add", "description": "Card 03 add-domain button." },
  "optFloatingNoSites": { "message": "No sites hidden yet.", "description": "Empty state for hidden-domain list (JS)." },
  "optFloatingRemove": { "message": "Remove", "description": "Remove a hidden domain (JS)." },
  "optIdleOpacityHidden": { "message": "0% (hidden until hover)", "description": "Keep '0%' literal (JS)." },
  "optIdleOpacityDefault": { "message": "30% (default)", "description": "Keep '30%' literal (JS)." },
  "optShortcutTitle": { "message": "Keyboard shortcut", "description": "Card 04 title." },
  "optShortcutDefault": { "message": "Default:", "description": "Card 04 label before the key chip." },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)", "description": "Keep the key combo literal." },
  "optShortcutCustomize": { "message": "Customize shortcuts", "description": "Card 04 button → chrome://extensions/shortcuts." },
  "optAboutTitle": { "message": "About", "description": "About section heading." },
  "optAboutBody": { "message": "AllMarks saves any URL — tweets, videos, articles — as a beautiful visual collage card. The extension keeps your bookmarks in your own browser and sends them to no server — no account, no tracking, no analytics.", "description": "About body." },
  "optAboutOpenBoard": { "message": "Open AllMarks board →", "description": "Keep 'AllMarks' literal; keep the arrow." },
  "optSaved": { "message": "Saved", "description": "Save-confirmation indicator on each card." },
  "popupOpenSettings": { "message": "Open settings", "description": "Popup button." },
  "popupHint": { "message": "Press Ctrl+Shift+B on any page to save.", "description": "Keep 'Ctrl+Shift+B' literal." }
}
```

> **翻訳者への注記（4-2〜4-15 全言語共通）**: `AllMarks / X (Twitter) / note / スキ / Vimeo / YouTube / SoundCloud / Ctrl+Shift+B / ⌘+Shift+B / Mac / example.com / 0% / 30% / →` はどの言語でもそのまま残す。以下の訳は AI 下書き。公開前にユーザー（母語話者 or レビュー）で最終確認する前提。runtime は未対応時 en にフォールバックするので、崩れても致命傷にはならない。

### 4-2. `_locales/ja/messages.json`
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "どんなURLも美しいビジュアルコラージュカードとしてAllMarksに保存。" },
  "optDocTitle": { "message": "AllMarks 設定" },
  "optAutosaveTitle": { "message": "SNSボタンで自動保存" },
  "optAutosaveLede": { "message": "これらのボタンを押すと、そのページが自動的にAllMarksに保存されます。すでに保存済みのURLは静かにスキップされます。" },
  "optAutosaveXLike": { "message": "X (Twitter) — いいねボタン" },
  "optAutosaveNoteLike": { "message": "note — スキ ボタン" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — ブックマークボタン" },
  "optAutosaveVimeoLike": { "message": "Vimeo — いいねボタン" },
  "optAutosaveYouTubeLike": { "message": "YouTube — 高評価ボタン" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — 後で見るボタン" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — 後で見る" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — いいねボタン" },
  "optCursorTitle": { "message": "マウス位置が不明なときのカーソルピル位置" },
  "optCursorAtCursor": { "message": "カーソル位置" },
  "optCursorBottomRight": { "message": "右下すみ" },
  "optFloatingTitle": { "message": "フローティング保存ボタン" },
  "optFloatingLede": { "message": "小さなマークがすべてのページの端に表示されます。クリックでそのページをAllMarksに保存。長押しでドラッグでき、左右いちばん近い端に吸着します。保存済みのページには緑のチェックが常に表示されます。" },
  "optFloatingToggle": { "message": "すべてのページでフローティング保存ボタンを表示" },
  "optFloatingIdleOpacity": { "message": "待機時の透明度" },
  "optFloatingReset": { "message": "位置を右端・中央にリセット" },
  "optFloatingHideTitle": { "message": "特定のサイトで非表示" },
  "optFloatingHideLede": { "message": "ドメイン（例: example.com）を追加すると、そのサイトだけフローティングボタンを非表示にできます。他の保存ショートカットは引き続き使えます。" },
  "optFloatingAdd": { "message": "追加" },
  "optFloatingNoSites": { "message": "まだ非表示のサイトはありません。" },
  "optFloatingRemove": { "message": "削除" },
  "optIdleOpacityHidden": { "message": "0%（ホバーするまで非表示）" },
  "optIdleOpacityDefault": { "message": "30%（既定）" },
  "optShortcutTitle": { "message": "キーボードショートカット" },
  "optShortcutDefault": { "message": "既定:" },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "ショートカットをカスタマイズ" },
  "optAboutTitle": { "message": "AllMarksについて" },
  "optAboutBody": { "message": "AllMarksは、ツイート・動画・記事など、どんなURLも美しいビジュアルコラージュカードとして保存します。この拡張機能はブックマークをあなた自身のブラウザ内に保管し、サーバーには一切送信しません。アカウント不要・追跡なし・解析なし。" },
  "optAboutOpenBoard": { "message": "AllMarksボードを開く →" },
  "optSaved": { "message": "保存しました" },
  "popupOpenSettings": { "message": "設定を開く" },
  "popupHint": { "message": "どのページでも Ctrl+Shift+B で保存できます。" }
}
```

### 4-3. `_locales/zh/messages.json`
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "将任何网址保存为精美的可视化拼贴卡片到 AllMarks。" },
  "optDocTitle": { "message": "AllMarks 设置" },
  "optAutosaveTitle": { "message": "在社交按钮上自动保存" },
  "optAutosaveLede": { "message": "当你按下这些按钮之一时，该页面会自动保存到 AllMarks。已保存的网址会被静默跳过。" },
  "optAutosaveXLike": { "message": "X (Twitter) — 点赞按钮" },
  "optAutosaveNoteLike": { "message": "note — スキ 按钮" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — 书签按钮" },
  "optAutosaveVimeoLike": { "message": "Vimeo — 点赞按钮" },
  "optAutosaveYouTubeLike": { "message": "YouTube — 点赞按钮" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — 稍后观看按钮" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — 稍后观看" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — 点赞按钮" },
  "optCursorTitle": { "message": "无鼠标数据时的光标胶囊位置" },
  "optCursorAtCursor": { "message": "在光标处" },
  "optCursorBottomRight": { "message": "右下角" },
  "optFloatingTitle": { "message": "悬浮保存按钮" },
  "optFloatingLede": { "message": "每个页面的边缘都会有一个小标记。点击即可将页面保存到 AllMarks。长按可拖动，它会吸附到最近的左侧或右侧边缘。已保存的页面会显示一个永久的绿色对勾。" },
  "optFloatingToggle": { "message": "在所有页面显示悬浮保存按钮" },
  "optFloatingIdleOpacity": { "message": "空闲时的不透明度" },
  "optFloatingReset": { "message": "将位置重置为右边缘居中" },
  "optFloatingHideTitle": { "message": "在特定网站隐藏" },
  "optFloatingHideLede": { "message": "添加一个域名（例如 example.com），仅在该网站隐藏悬浮按钮。其他保存快捷方式仍然有效。" },
  "optFloatingAdd": { "message": "添加" },
  "optFloatingNoSites": { "message": "尚未隐藏任何网站。" },
  "optFloatingRemove": { "message": "移除" },
  "optIdleOpacityHidden": { "message": "0%（悬停前隐藏）" },
  "optIdleOpacityDefault": { "message": "30%（默认）" },
  "optShortcutTitle": { "message": "键盘快捷键" },
  "optShortcutDefault": { "message": "默认:" },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "自定义快捷键" },
  "optAboutTitle": { "message": "关于" },
  "optAboutBody": { "message": "AllMarks 可将任何网址——推文、视频、文章——保存为精美的可视化拼贴卡片。此扩展将你的书签保存在你自己的浏览器中，不发送到任何服务器——无账户、无追踪、无分析。" },
  "optAboutOpenBoard": { "message": "打开 AllMarks 面板 →" },
  "optSaved": { "message": "已保存" },
  "popupOpenSettings": { "message": "打开设置" },
  "popupHint": { "message": "在任意页面按 Ctrl+Shift+B 即可保存。" }
}
```

### 4-4. `_locales/ko/messages.json`
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "모든 URL을 아름다운 비주얼 콜라주 카드로 AllMarks에 저장하세요." },
  "optDocTitle": { "message": "AllMarks 설정" },
  "optAutosaveTitle": { "message": "SNS 버튼에서 자동 저장" },
  "optAutosaveLede": { "message": "이 버튼 중 하나를 누르면 해당 페이지가 자동으로 AllMarks에 저장됩니다. 이미 저장된 URL은 조용히 건너뜁니다." },
  "optAutosaveXLike": { "message": "X (Twitter) — 좋아요 버튼" },
  "optAutosaveNoteLike": { "message": "note — スキ 버튼" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — 북마크 버튼" },
  "optAutosaveVimeoLike": { "message": "Vimeo — 좋아요 버튼" },
  "optAutosaveYouTubeLike": { "message": "YouTube — 좋아요 버튼" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — 나중에 보기 버튼" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — 나중에 보기" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — 좋아요 버튼" },
  "optCursorTitle": { "message": "마우스 데이터가 없을 때 커서 알약 위치" },
  "optCursorAtCursor": { "message": "커서 위치" },
  "optCursorBottomRight": { "message": "오른쪽 아래 모서리" },
  "optFloatingTitle": { "message": "플로팅 저장 버튼" },
  "optFloatingLede": { "message": "모든 페이지의 가장자리에 작은 마크가 표시됩니다. 클릭하면 페이지를 AllMarks에 저장합니다. 길게 눌러 드래그하면 가장 가까운 왼쪽 또는 오른쪽 가장자리에 붙습니다. 이미 저장된 페이지에는 초록색 체크가 항상 표시됩니다." },
  "optFloatingToggle": { "message": "모든 페이지에 플로팅 저장 버튼 표시" },
  "optFloatingIdleOpacity": { "message": "대기 시 불투명도" },
  "optFloatingReset": { "message": "위치를 오른쪽 가장자리 가운데로 초기화" },
  "optFloatingHideTitle": { "message": "특정 사이트에서 숨기기" },
  "optFloatingHideLede": { "message": "도메인(예: example.com)을 추가하면 해당 사이트에서만 플로팅 버튼을 숨깁니다. 다른 저장 단축키는 계속 작동합니다." },
  "optFloatingAdd": { "message": "추가" },
  "optFloatingNoSites": { "message": "아직 숨긴 사이트가 없습니다." },
  "optFloatingRemove": { "message": "제거" },
  "optIdleOpacityHidden": { "message": "0% (호버할 때까지 숨김)" },
  "optIdleOpacityDefault": { "message": "30% (기본값)" },
  "optShortcutTitle": { "message": "키보드 단축키" },
  "optShortcutDefault": { "message": "기본값:" },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "단축키 사용자 지정" },
  "optAboutTitle": { "message": "정보" },
  "optAboutBody": { "message": "AllMarks는 트윗, 동영상, 기사 등 모든 URL을 아름다운 비주얼 콜라주 카드로 저장합니다. 이 확장 프로그램은 북마크를 사용자 브라우저에 보관하며 어떤 서버로도 전송하지 않습니다. 계정 없음, 추적 없음, 분석 없음." },
  "optAboutOpenBoard": { "message": "AllMarks 보드 열기 →" },
  "optSaved": { "message": "저장됨" },
  "popupOpenSettings": { "message": "설정 열기" },
  "popupHint": { "message": "아무 페이지에서나 Ctrl+Shift+B를 눌러 저장하세요." }
}
```

### 4-5. `_locales/es/messages.json`
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "Guarda cualquier URL en AllMarks como una hermosa tarjeta de collage visual." },
  "optDocTitle": { "message": "Ajustes de AllMarks" },
  "optAutosaveTitle": { "message": "Guardado automático en botón de redes" },
  "optAutosaveLede": { "message": "Cuando pulsas uno de estos botones, la página se guarda automáticamente en AllMarks. Las URL ya guardadas se omiten en silencio." },
  "optAutosaveXLike": { "message": "X (Twitter) — botón Me gusta" },
  "optAutosaveNoteLike": { "message": "note — botón スキ" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — botón Guardar" },
  "optAutosaveVimeoLike": { "message": "Vimeo — botón Me gusta" },
  "optAutosaveYouTubeLike": { "message": "YouTube — botón Me gusta" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — botón Ver más tarde" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — Ver más tarde" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — botón Me gusta" },
  "optCursorTitle": { "message": "Posición de la píldora del cursor cuando no hay datos del ratón" },
  "optCursorAtCursor": { "message": "En el cursor" },
  "optCursorBottomRight": { "message": "Esquina inferior derecha" },
  "optFloatingTitle": { "message": "Botón flotante de guardado" },
  "optFloatingLede": { "message": "Una pequeña marca aparece en el borde de cada página. Haz clic para guardar la página en AllMarks. Mantén pulsado para arrastrar; se ajusta al borde izquierdo o derecho más cercano. Las páginas ya guardadas muestran una marca verde permanente." },
  "optFloatingToggle": { "message": "Mostrar el botón flotante de guardado en todas las páginas" },
  "optFloatingIdleOpacity": { "message": "Opacidad en reposo" },
  "optFloatingReset": { "message": "Restablecer posición al borde derecho, en el centro" },
  "optFloatingHideTitle": { "message": "Ocultar en sitios específicos" },
  "optFloatingHideLede": { "message": "Añade un dominio (p. ej. example.com) para ocultar el botón flotante solo en ese sitio. Los demás atajos de guardado siguen funcionando." },
  "optFloatingAdd": { "message": "Añadir" },
  "optFloatingNoSites": { "message": "Aún no hay sitios ocultos." },
  "optFloatingRemove": { "message": "Quitar" },
  "optIdleOpacityHidden": { "message": "0% (oculto hasta pasar el cursor)" },
  "optIdleOpacityDefault": { "message": "30% (predeterminado)" },
  "optShortcutTitle": { "message": "Atajo de teclado" },
  "optShortcutDefault": { "message": "Predeterminado:" },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "Personalizar atajos" },
  "optAboutTitle": { "message": "Acerca de" },
  "optAboutBody": { "message": "AllMarks guarda cualquier URL (tuits, vídeos, artículos) como una hermosa tarjeta de collage visual. La extensión mantiene tus marcadores en tu propio navegador y no los envía a ningún servidor: sin cuenta, sin seguimiento, sin analíticas." },
  "optAboutOpenBoard": { "message": "Abrir el tablero de AllMarks →" },
  "optSaved": { "message": "Guardado" },
  "popupOpenSettings": { "message": "Abrir ajustes" },
  "popupHint": { "message": "Pulsa Ctrl+Shift+B en cualquier página para guardar." }
}
```

### 4-6. `_locales/fr/messages.json`
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "Enregistrez n'importe quelle URL dans AllMarks sous forme d'une superbe carte collage visuelle." },
  "optDocTitle": { "message": "Paramètres AllMarks" },
  "optAutosaveTitle": { "message": "Enregistrement auto sur bouton de réseau" },
  "optAutosaveLede": { "message": "Lorsque vous appuyez sur l'un de ces boutons, la page est automatiquement enregistrée dans AllMarks. Les URL déjà enregistrées sont ignorées en silence." },
  "optAutosaveXLike": { "message": "X (Twitter) — bouton J'aime" },
  "optAutosaveNoteLike": { "message": "note — bouton スキ" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — bouton Signet" },
  "optAutosaveVimeoLike": { "message": "Vimeo — bouton J'aime" },
  "optAutosaveYouTubeLike": { "message": "YouTube — bouton J'aime" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — bouton À regarder plus tard" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — À regarder plus tard" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — bouton J'aime" },
  "optCursorTitle": { "message": "Position de la pastille du curseur en l'absence de données de souris" },
  "optCursorAtCursor": { "message": "Au curseur" },
  "optCursorBottomRight": { "message": "Coin inférieur droit" },
  "optFloatingTitle": { "message": "Bouton d'enregistrement flottant" },
  "optFloatingLede": { "message": "Une petite marque apparaît sur le bord de chaque page. Cliquez pour enregistrer la page dans AllMarks. Appuyez longuement pour la faire glisser ; elle se cale sur le bord gauche ou droit le plus proche. Les pages déjà enregistrées affichent une coche verte permanente." },
  "optFloatingToggle": { "message": "Afficher le bouton d'enregistrement flottant sur toutes les pages" },
  "optFloatingIdleOpacity": { "message": "Opacité au repos" },
  "optFloatingReset": { "message": "Réinitialiser la position au bord droit, au centre" },
  "optFloatingHideTitle": { "message": "Masquer sur des sites précis" },
  "optFloatingHideLede": { "message": "Ajoutez un domaine (p. ex. example.com) pour masquer le bouton flottant uniquement sur ce site. Les autres raccourcis d'enregistrement continuent de fonctionner." },
  "optFloatingAdd": { "message": "Ajouter" },
  "optFloatingNoSites": { "message": "Aucun site masqué pour l'instant." },
  "optFloatingRemove": { "message": "Retirer" },
  "optIdleOpacityHidden": { "message": "0% (masqué jusqu'au survol)" },
  "optIdleOpacityDefault": { "message": "30% (par défaut)" },
  "optShortcutTitle": { "message": "Raccourci clavier" },
  "optShortcutDefault": { "message": "Par défaut :" },
  "optShortcutMacNote": { "message": "(Mac : ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "Personnaliser les raccourcis" },
  "optAboutTitle": { "message": "À propos" },
  "optAboutBody": { "message": "AllMarks enregistre n'importe quelle URL (tweets, vidéos, articles) sous forme d'une superbe carte collage visuelle. L'extension conserve vos favoris dans votre propre navigateur et ne les envoie à aucun serveur : sans compte, sans suivi, sans analyse." },
  "optAboutOpenBoard": { "message": "Ouvrir le tableau AllMarks →" },
  "optSaved": { "message": "Enregistré" },
  "popupOpenSettings": { "message": "Ouvrir les paramètres" },
  "popupHint": { "message": "Appuyez sur Ctrl+Shift+B sur n'importe quelle page pour enregistrer." }
}
```

### 4-7. `_locales/de/messages.json`
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "Speichere jede URL als schöne visuelle Collage-Karte in AllMarks." },
  "optDocTitle": { "message": "AllMarks-Einstellungen" },
  "optAutosaveTitle": { "message": "Automatisch bei SNS-Button speichern" },
  "optAutosaveLede": { "message": "Wenn du eine dieser Schaltflächen drückst, wird die Seite automatisch in AllMarks gespeichert. Bereits gespeicherte URLs werden stillschweigend übersprungen." },
  "optAutosaveXLike": { "message": "X (Twitter) — Gefällt-mir-Button" },
  "optAutosaveNoteLike": { "message": "note — スキ-Button" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — Lesezeichen-Button" },
  "optAutosaveVimeoLike": { "message": "Vimeo — Gefällt-mir-Button" },
  "optAutosaveYouTubeLike": { "message": "YouTube — Gefällt-mir-Button" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — Später-ansehen-Button" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — Später ansehen" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — Gefällt-mir-Button" },
  "optCursorTitle": { "message": "Position der Cursor-Pille ohne Mausdaten" },
  "optCursorAtCursor": { "message": "Am Cursor" },
  "optCursorBottomRight": { "message": "Untere rechte Ecke" },
  "optFloatingTitle": { "message": "Schwebende Speichern-Schaltfläche" },
  "optFloatingLede": { "message": "Eine kleine Marke sitzt am Rand jeder Seite. Klicke, um die Seite in AllMarks zu speichern. Lange drücken zum Ziehen — sie rastet am nächsten linken oder rechten Rand ein. Bereits gespeicherte Seiten zeigen ein dauerhaftes grünes Häkchen." },
  "optFloatingToggle": { "message": "Schwebende Speichern-Schaltfläche auf allen Seiten anzeigen" },
  "optFloatingIdleOpacity": { "message": "Deckkraft im Ruhezustand" },
  "optFloatingReset": { "message": "Position auf rechten Rand, Mitte zurücksetzen" },
  "optFloatingHideTitle": { "message": "Auf bestimmten Seiten ausblenden" },
  "optFloatingHideLede": { "message": "Füge eine Domain hinzu (z. B. example.com), um die schwebende Schaltfläche nur auf dieser Seite auszublenden. Andere Speicher-Shortcuts funktionieren weiterhin." },
  "optFloatingAdd": { "message": "Hinzufügen" },
  "optFloatingNoSites": { "message": "Noch keine Seiten ausgeblendet." },
  "optFloatingRemove": { "message": "Entfernen" },
  "optIdleOpacityHidden": { "message": "0% (ausgeblendet bis zum Überfahren)" },
  "optIdleOpacityDefault": { "message": "30% (Standard)" },
  "optShortcutTitle": { "message": "Tastenkürzel" },
  "optShortcutDefault": { "message": "Standard:" },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "Tastenkürzel anpassen" },
  "optAboutTitle": { "message": "Über" },
  "optAboutBody": { "message": "AllMarks speichert jede URL – Tweets, Videos, Artikel – als schöne visuelle Collage-Karte. Die Erweiterung bewahrt deine Lesezeichen in deinem eigenen Browser auf und sendet sie an keinen Server – kein Konto, kein Tracking, keine Analyse." },
  "optAboutOpenBoard": { "message": "AllMarks-Board öffnen →" },
  "optSaved": { "message": "Gespeichert" },
  "popupOpenSettings": { "message": "Einstellungen öffnen" },
  "popupHint": { "message": "Drücke auf einer beliebigen Seite Ctrl+Shift+B zum Speichern." }
}
```

### 4-8. `_locales/pt/messages.json`
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "Salve qualquer URL no AllMarks como um lindo cartão de colagem visual." },
  "optDocTitle": { "message": "Configurações do AllMarks" },
  "optAutosaveTitle": { "message": "Salvar automaticamente no botão de rede social" },
  "optAutosaveLede": { "message": "Quando você pressiona um desses botões, a página é salva automaticamente no AllMarks. URLs já salvas são ignoradas silenciosamente." },
  "optAutosaveXLike": { "message": "X (Twitter) — botão Curtir" },
  "optAutosaveNoteLike": { "message": "note — botão スキ" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — botão Salvar" },
  "optAutosaveVimeoLike": { "message": "Vimeo — botão Curtir" },
  "optAutosaveYouTubeLike": { "message": "YouTube — botão Curtir" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — botão Assistir mais tarde" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — Assistir mais tarde" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — botão Curtir" },
  "optCursorTitle": { "message": "Posição da pílula do cursor quando não há dados do mouse" },
  "optCursorAtCursor": { "message": "No cursor" },
  "optCursorBottomRight": { "message": "Canto inferior direito" },
  "optFloatingTitle": { "message": "Botão flutuante de salvar" },
  "optFloatingLede": { "message": "Uma pequena marca fica na borda de cada página. Clique para salvar a página no AllMarks. Pressione e segure para arrastar — ela se encaixa na borda esquerda ou direita mais próxima. Páginas já salvas mostram uma marca verde permanente." },
  "optFloatingToggle": { "message": "Mostrar o botão flutuante de salvar em todas as páginas" },
  "optFloatingIdleOpacity": { "message": "Opacidade em repouso" },
  "optFloatingReset": { "message": "Redefinir posição para a borda direita, no centro" },
  "optFloatingHideTitle": { "message": "Ocultar em sites específicos" },
  "optFloatingHideLede": { "message": "Adicione um domínio (ex.: example.com) para ocultar o botão flutuante apenas nesse site. Outros atalhos de salvar continuam funcionando." },
  "optFloatingAdd": { "message": "Adicionar" },
  "optFloatingNoSites": { "message": "Nenhum site oculto ainda." },
  "optFloatingRemove": { "message": "Remover" },
  "optIdleOpacityHidden": { "message": "0% (oculto até passar o cursor)" },
  "optIdleOpacityDefault": { "message": "30% (padrão)" },
  "optShortcutTitle": { "message": "Atalho de teclado" },
  "optShortcutDefault": { "message": "Padrão:" },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "Personalizar atalhos" },
  "optAboutTitle": { "message": "Sobre" },
  "optAboutBody": { "message": "O AllMarks salva qualquer URL — tweets, vídeos, artigos — como um lindo cartão de colagem visual. A extensão mantém seus favoritos no seu próprio navegador e não os envia a nenhum servidor — sem conta, sem rastreamento, sem análises." },
  "optAboutOpenBoard": { "message": "Abrir o quadro do AllMarks →" },
  "optSaved": { "message": "Salvo" },
  "popupOpenSettings": { "message": "Abrir configurações" },
  "popupHint": { "message": "Pressione Ctrl+Shift+B em qualquer página para salvar." }
}
```

### 4-9. `_locales/it/messages.json`
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "Salva qualsiasi URL su AllMarks come una splendida scheda collage visiva." },
  "optDocTitle": { "message": "Impostazioni di AllMarks" },
  "optAutosaveTitle": { "message": "Salvataggio automatico sul pulsante social" },
  "optAutosaveLede": { "message": "Quando premi uno di questi pulsanti, la pagina viene salvata automaticamente su AllMarks. Gli URL già salvati vengono ignorati in silenzio." },
  "optAutosaveXLike": { "message": "X (Twitter) — pulsante Mi piace" },
  "optAutosaveNoteLike": { "message": "note — pulsante スキ" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — pulsante Segnalibro" },
  "optAutosaveVimeoLike": { "message": "Vimeo — pulsante Mi piace" },
  "optAutosaveYouTubeLike": { "message": "YouTube — pulsante Mi piace" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — pulsante Guarda più tardi" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — Guarda più tardi" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — pulsante Mi piace" },
  "optCursorTitle": { "message": "Posizione della pillola del cursore quando mancano i dati del mouse" },
  "optCursorAtCursor": { "message": "Al cursore" },
  "optCursorBottomRight": { "message": "Angolo in basso a destra" },
  "optFloatingTitle": { "message": "Pulsante di salvataggio fluttuante" },
  "optFloatingLede": { "message": "Un piccolo segno resta sul bordo di ogni pagina. Clicca per salvare la pagina su AllMarks. Tieni premuto per trascinare: si aggancia al bordo sinistro o destro più vicino. Le pagine già salvate mostrano un segno di spunta verde permanente." },
  "optFloatingToggle": { "message": "Mostra il pulsante di salvataggio fluttuante su tutte le pagine" },
  "optFloatingIdleOpacity": { "message": "Opacità a riposo" },
  "optFloatingReset": { "message": "Ripristina la posizione al bordo destro, al centro" },
  "optFloatingHideTitle": { "message": "Nascondi su siti specifici" },
  "optFloatingHideLede": { "message": "Aggiungi un dominio (es. example.com) per nascondere il pulsante fluttuante solo su quel sito. Le altre scorciatoie di salvataggio continuano a funzionare." },
  "optFloatingAdd": { "message": "Aggiungi" },
  "optFloatingNoSites": { "message": "Nessun sito ancora nascosto." },
  "optFloatingRemove": { "message": "Rimuovi" },
  "optIdleOpacityHidden": { "message": "0% (nascosto fino al passaggio del mouse)" },
  "optIdleOpacityDefault": { "message": "30% (predefinito)" },
  "optShortcutTitle": { "message": "Scorciatoia da tastiera" },
  "optShortcutDefault": { "message": "Predefinito:" },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "Personalizza le scorciatoie" },
  "optAboutTitle": { "message": "Informazioni" },
  "optAboutBody": { "message": "AllMarks salva qualsiasi URL — tweet, video, articoli — come una splendida scheda collage visiva. L'estensione conserva i tuoi segnalibri nel tuo browser e non li invia a nessun server: nessun account, nessun tracciamento, nessuna analisi." },
  "optAboutOpenBoard": { "message": "Apri la bacheca di AllMarks →" },
  "optSaved": { "message": "Salvato" },
  "popupOpenSettings": { "message": "Apri le impostazioni" },
  "popupHint": { "message": "Premi Ctrl+Shift+B su qualsiasi pagina per salvare." }
}
```

### 4-10. `_locales/nl/messages.json`
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "Bewaar elke URL in AllMarks als een mooie visuele collagekaart." },
  "optDocTitle": { "message": "AllMarks-instellingen" },
  "optAutosaveTitle": { "message": "Automatisch opslaan bij SNS-knop" },
  "optAutosaveLede": { "message": "Wanneer je op een van deze knoppen drukt, wordt de pagina automatisch in AllMarks opgeslagen. Al opgeslagen URL's worden stil overgeslagen." },
  "optAutosaveXLike": { "message": "X (Twitter) — Like-knop" },
  "optAutosaveNoteLike": { "message": "note — スキ-knop" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — Bladwijzer-knop" },
  "optAutosaveVimeoLike": { "message": "Vimeo — Like-knop" },
  "optAutosaveYouTubeLike": { "message": "YouTube — Like-knop" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — Later bekijken-knop" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — Later bekijken" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — Like-knop" },
  "optCursorTitle": { "message": "Positie van cursorpil zonder muisgegevens" },
  "optCursorAtCursor": { "message": "Bij de cursor" },
  "optCursorBottomRight": { "message": "Rechteronderhoek" },
  "optFloatingTitle": { "message": "Zwevende opslaan-knop" },
  "optFloatingLede": { "message": "Een klein merkteken staat aan de rand van elke pagina. Klik om de pagina in AllMarks op te slaan. Houd ingedrukt om te slepen — het klikt vast aan de dichtstbijzijnde linker- of rechterrand. Al opgeslagen pagina's tonen een permanent groen vinkje." },
  "optFloatingToggle": { "message": "Toon de zwevende opslaan-knop op alle pagina's" },
  "optFloatingIdleOpacity": { "message": "Dekking in rust" },
  "optFloatingReset": { "message": "Positie terugzetten naar rechterrand, midden" },
  "optFloatingHideTitle": { "message": "Verbergen op specifieke sites" },
  "optFloatingHideLede": { "message": "Voeg een domein toe (bijv. example.com) om de zwevende knop alleen op die site te verbergen. Andere opslaan-sneltoetsen blijven werken." },
  "optFloatingAdd": { "message": "Toevoegen" },
  "optFloatingNoSites": { "message": "Nog geen sites verborgen." },
  "optFloatingRemove": { "message": "Verwijderen" },
  "optIdleOpacityHidden": { "message": "0% (verborgen tot hover)" },
  "optIdleOpacityDefault": { "message": "30% (standaard)" },
  "optShortcutTitle": { "message": "Sneltoets" },
  "optShortcutDefault": { "message": "Standaard:" },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "Sneltoetsen aanpassen" },
  "optAboutTitle": { "message": "Over" },
  "optAboutBody": { "message": "AllMarks bewaart elke URL — tweets, video's, artikelen — als een mooie visuele collagekaart. De extensie houdt je bladwijzers in je eigen browser en stuurt ze naar geen enkele server — geen account, geen tracking, geen analyse." },
  "optAboutOpenBoard": { "message": "AllMarks-bord openen →" },
  "optSaved": { "message": "Opgeslagen" },
  "popupOpenSettings": { "message": "Instellingen openen" },
  "popupHint": { "message": "Druk op elke pagina op Ctrl+Shift+B om op te slaan." }
}
```

### 4-11. `_locales/tr/messages.json`
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "Herhangi bir URL'yi AllMarks'a güzel bir görsel kolaj kartı olarak kaydedin." },
  "optDocTitle": { "message": "AllMarks ayarları" },
  "optAutosaveTitle": { "message": "SNS düğmesinde otomatik kaydetme" },
  "optAutosaveLede": { "message": "Bu düğmelerden birine bastığınızda sayfa otomatik olarak AllMarks'a kaydedilir. Zaten kaydedilmiş URL'ler sessizce atlanır." },
  "optAutosaveXLike": { "message": "X (Twitter) — Beğen düğmesi" },
  "optAutosaveNoteLike": { "message": "note — スキ düğmesi" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — Yer İşareti düğmesi" },
  "optAutosaveVimeoLike": { "message": "Vimeo — Beğen düğmesi" },
  "optAutosaveYouTubeLike": { "message": "YouTube — Beğen düğmesi" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — Sonra İzle düğmesi" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — Sonra İzle" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — Beğen düğmesi" },
  "optCursorTitle": { "message": "Fare verisi yokken imleç hapının konumu" },
  "optCursorAtCursor": { "message": "İmlecin yanında" },
  "optCursorBottomRight": { "message": "Sağ alt köşe" },
  "optFloatingTitle": { "message": "Yüzen kaydetme düğmesi" },
  "optFloatingLede": { "message": "Her sayfanın kenarında küçük bir işaret durur. Sayfayı AllMarks'a kaydetmek için tıklayın. Sürüklemek için uzun basın — en yakın sol veya sağ kenara yapışır. Zaten kaydedilmiş sayfalarda kalıcı yeşil bir onay işareti görünür." },
  "optFloatingToggle": { "message": "Yüzen kaydetme düğmesini tüm sayfalarda göster" },
  "optFloatingIdleOpacity": { "message": "Boştayken saydamlık" },
  "optFloatingReset": { "message": "Konumu sağ kenar ortaya sıfırla" },
  "optFloatingHideTitle": { "message": "Belirli sitelerde gizle" },
  "optFloatingHideLede": { "message": "Yüzen düğmeyi yalnızca o sitede gizlemek için bir alan adı ekleyin (ör. example.com). Diğer kaydetme kısayolları çalışmaya devam eder." },
  "optFloatingAdd": { "message": "Ekle" },
  "optFloatingNoSites": { "message": "Henüz gizlenmiş site yok." },
  "optFloatingRemove": { "message": "Kaldır" },
  "optIdleOpacityHidden": { "message": "0% (üzerine gelene kadar gizli)" },
  "optIdleOpacityDefault": { "message": "30% (varsayılan)" },
  "optShortcutTitle": { "message": "Klavye kısayolu" },
  "optShortcutDefault": { "message": "Varsayılan:" },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "Kısayolları özelleştir" },
  "optAboutTitle": { "message": "Hakkında" },
  "optAboutBody": { "message": "AllMarks, herhangi bir URL'yi — tweetler, videolar, makaleler — güzel bir görsel kolaj kartı olarak kaydeder. Uzantı, yer imlerinizi kendi tarayıcınızda tutar ve hiçbir sunucuya göndermez — hesap yok, izleme yok, analiz yok." },
  "optAboutOpenBoard": { "message": "AllMarks panosunu aç →" },
  "optSaved": { "message": "Kaydedildi" },
  "popupOpenSettings": { "message": "Ayarları aç" },
  "popupHint": { "message": "Kaydetmek için herhangi bir sayfada Ctrl+Shift+B tuşlarına basın." }
}
```

### 4-12. `_locales/ru/messages.json`
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "Сохраняйте любой URL в AllMarks как красивую визуальную карточку-коллаж." },
  "optDocTitle": { "message": "Настройки AllMarks" },
  "optAutosaveTitle": { "message": "Автосохранение по кнопке соцсети" },
  "optAutosaveLede": { "message": "Когда вы нажимаете одну из этих кнопок, страница автоматически сохраняется в AllMarks. Уже сохранённые URL тихо пропускаются." },
  "optAutosaveXLike": { "message": "X (Twitter) — кнопка «Нравится»" },
  "optAutosaveNoteLike": { "message": "note — кнопка スキ" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — кнопка «Закладка»" },
  "optAutosaveVimeoLike": { "message": "Vimeo — кнопка «Нравится»" },
  "optAutosaveYouTubeLike": { "message": "YouTube — кнопка «Нравится»" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — кнопка «Посмотреть позже»" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — Посмотреть позже" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — кнопка «Нравится»" },
  "optCursorTitle": { "message": "Положение пилюли курсора при отсутствии данных о мыши" },
  "optCursorAtCursor": { "message": "У курсора" },
  "optCursorBottomRight": { "message": "Нижний правый угол" },
  "optFloatingTitle": { "message": "Плавающая кнопка сохранения" },
  "optFloatingLede": { "message": "Небольшая метка находится у края каждой страницы. Нажмите, чтобы сохранить страницу в AllMarks. Удерживайте, чтобы перетащить — она примагничивается к ближайшему левому или правому краю. На уже сохранённых страницах отображается постоянная зелёная галочка." },
  "optFloatingToggle": { "message": "Показывать плавающую кнопку сохранения на всех страницах" },
  "optFloatingIdleOpacity": { "message": "Прозрачность в покое" },
  "optFloatingReset": { "message": "Сбросить положение к правому краю, по центру" },
  "optFloatingHideTitle": { "message": "Скрывать на определённых сайтах" },
  "optFloatingHideLede": { "message": "Добавьте домен (например, example.com), чтобы скрыть плавающую кнопку только на этом сайте. Другие сочетания для сохранения продолжат работать." },
  "optFloatingAdd": { "message": "Добавить" },
  "optFloatingNoSites": { "message": "Пока нет скрытых сайтов." },
  "optFloatingRemove": { "message": "Удалить" },
  "optIdleOpacityHidden": { "message": "0% (скрыто до наведения)" },
  "optIdleOpacityDefault": { "message": "30% (по умолчанию)" },
  "optShortcutTitle": { "message": "Сочетание клавиш" },
  "optShortcutDefault": { "message": "По умолчанию:" },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "Настроить сочетания клавиш" },
  "optAboutTitle": { "message": "О расширении" },
  "optAboutBody": { "message": "AllMarks сохраняет любой URL — твиты, видео, статьи — как красивую визуальную карточку-коллаж. Расширение хранит ваши закладки в вашем собственном браузере и не отправляет их ни на один сервер — без аккаунта, без отслеживания, без аналитики." },
  "optAboutOpenBoard": { "message": "Открыть доску AllMarks →" },
  "optSaved": { "message": "Сохранено" },
  "popupOpenSettings": { "message": "Открыть настройки" },
  "popupHint": { "message": "Нажмите Ctrl+Shift+B на любой странице, чтобы сохранить." }
}
```

### 4-13. `_locales/ar/messages.json`
> ar は RTL。文言は下記で置換。表示方向は §8 の追記（`dir` 属性）を参照。
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "احفظ أي رابط في AllMarks كبطاقة كولاج بصرية جميلة." },
  "optDocTitle": { "message": "إعدادات AllMarks" },
  "optAutosaveTitle": { "message": "الحفظ التلقائي عند زر التواصل الاجتماعي" },
  "optAutosaveLede": { "message": "عند الضغط على أحد هذه الأزرار، تُحفظ الصفحة تلقائيًا في AllMarks. تُتجاهل الروابط المحفوظة مسبقًا بصمت." },
  "optAutosaveXLike": { "message": "X (Twitter) — زر الإعجاب" },
  "optAutosaveNoteLike": { "message": "note — زر スキ" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — زر الإشارة المرجعية" },
  "optAutosaveVimeoLike": { "message": "Vimeo — زر الإعجاب" },
  "optAutosaveYouTubeLike": { "message": "YouTube — زر الإعجاب" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — زر المشاهدة لاحقًا" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — المشاهدة لاحقًا" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — زر الإعجاب" },
  "optCursorTitle": { "message": "موضع كبسولة المؤشر عند عدم توفر بيانات الفأرة" },
  "optCursorAtCursor": { "message": "عند المؤشر" },
  "optCursorBottomRight": { "message": "الزاوية السفلية اليمنى" },
  "optFloatingTitle": { "message": "زر الحفظ العائم" },
  "optFloatingLede": { "message": "توجد علامة صغيرة على حافة كل صفحة. انقر لحفظ الصفحة في AllMarks. اضغط مطولًا للسحب — تلتصق بأقرب حافة يسرى أو يمنى. تعرض الصفحات المحفوظة مسبقًا علامة صح خضراء دائمة." },
  "optFloatingToggle": { "message": "إظهار زر الحفظ العائم في جميع الصفحات" },
  "optFloatingIdleOpacity": { "message": "الشفافية عند الخمول" },
  "optFloatingReset": { "message": "إعادة تعيين الموضع إلى الحافة اليمنى، الوسط" },
  "optFloatingHideTitle": { "message": "الإخفاء في مواقع محددة" },
  "optFloatingHideLede": { "message": "أضف نطاقًا (مثل example.com) لإخفاء الزر العائم في هذا الموقع فقط. تظل اختصارات الحفظ الأخرى تعمل." },
  "optFloatingAdd": { "message": "إضافة" },
  "optFloatingNoSites": { "message": "لا توجد مواقع مخفية بعد." },
  "optFloatingRemove": { "message": "إزالة" },
  "optIdleOpacityHidden": { "message": "0% (مخفي حتى التمرير)" },
  "optIdleOpacityDefault": { "message": "30% (افتراضي)" },
  "optShortcutTitle": { "message": "اختصار لوحة المفاتيح" },
  "optShortcutDefault": { "message": "الافتراضي:" },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "تخصيص الاختصارات" },
  "optAboutTitle": { "message": "حول" },
  "optAboutBody": { "message": "يحفظ AllMarks أي رابط — التغريدات ومقاطع الفيديو والمقالات — كبطاقة كولاج بصرية جميلة. يحتفظ الامتداد بإشاراتك المرجعية داخل متصفحك ولا يرسلها إلى أي خادم — بلا حساب، بلا تتبع، بلا تحليلات." },
  "optAboutOpenBoard": { "message": "فتح لوحة AllMarks →" },
  "optSaved": { "message": "تم الحفظ" },
  "popupOpenSettings": { "message": "فتح الإعدادات" },
  "popupHint": { "message": "اضغط Ctrl+Shift+B في أي صفحة للحفظ." }
}
```

### 4-14. `_locales/th/messages.json`
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "บันทึก URL ใดก็ได้ลงใน AllMarks เป็นการ์ดคอลลาจภาพที่สวยงาม" },
  "optDocTitle": { "message": "การตั้งค่า AllMarks" },
  "optAutosaveTitle": { "message": "บันทึกอัตโนมัติที่ปุ่มโซเชียล" },
  "optAutosaveLede": { "message": "เมื่อคุณกดปุ่มใดปุ่มหนึ่งเหล่านี้ หน้าเว็บจะถูกบันทึกลงใน AllMarks โดยอัตโนมัติ URL ที่บันทึกไว้แล้วจะถูกข้ามไปอย่างเงียบ ๆ" },
  "optAutosaveXLike": { "message": "X (Twitter) — ปุ่มถูกใจ" },
  "optAutosaveNoteLike": { "message": "note — ปุ่ม スキ" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — ปุ่มบุ๊กมาร์ก" },
  "optAutosaveVimeoLike": { "message": "Vimeo — ปุ่มถูกใจ" },
  "optAutosaveYouTubeLike": { "message": "YouTube — ปุ่มถูกใจ" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — ปุ่มดูภายหลัง" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — ดูภายหลัง" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — ปุ่มถูกใจ" },
  "optCursorTitle": { "message": "ตำแหน่งของแคปซูลเคอร์เซอร์เมื่อไม่มีข้อมูลเมาส์" },
  "optCursorAtCursor": { "message": "ที่เคอร์เซอร์" },
  "optCursorBottomRight": { "message": "มุมขวาล่าง" },
  "optFloatingTitle": { "message": "ปุ่มบันทึกแบบลอย" },
  "optFloatingLede": { "message": "เครื่องหมายเล็ก ๆ จะอยู่ที่ขอบของทุกหน้า คลิกเพื่อบันทึกหน้านั้นลงใน AllMarks กดค้างเพื่อลาก — มันจะดูดเข้าหาขอบซ้ายหรือขวาที่ใกล้ที่สุด หน้าที่บันทึกไว้แล้วจะแสดงเครื่องหมายถูกสีเขียวถาวร" },
  "optFloatingToggle": { "message": "แสดงปุ่มบันทึกแบบลอยในทุกหน้า" },
  "optFloatingIdleOpacity": { "message": "ความทึบขณะไม่ใช้งาน" },
  "optFloatingReset": { "message": "รีเซ็ตตำแหน่งไปที่ขอบขวา ตรงกลาง" },
  "optFloatingHideTitle": { "message": "ซ่อนในบางเว็บไซต์" },
  "optFloatingHideLede": { "message": "เพิ่มโดเมน (เช่น example.com) เพื่อซ่อนปุ่มลอยเฉพาะบนเว็บไซต์นั้น ทางลัดการบันทึกอื่น ๆ ยังคงใช้งานได้" },
  "optFloatingAdd": { "message": "เพิ่ม" },
  "optFloatingNoSites": { "message": "ยังไม่มีเว็บไซต์ที่ซ่อนไว้" },
  "optFloatingRemove": { "message": "นำออก" },
  "optIdleOpacityHidden": { "message": "0% (ซ่อนจนกว่าจะชี้เมาส์)" },
  "optIdleOpacityDefault": { "message": "30% (ค่าเริ่มต้น)" },
  "optShortcutTitle": { "message": "ทางลัดแป้นพิมพ์" },
  "optShortcutDefault": { "message": "ค่าเริ่มต้น:" },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "ปรับแต่งทางลัด" },
  "optAboutTitle": { "message": "เกี่ยวกับ" },
  "optAboutBody": { "message": "AllMarks บันทึก URL ใดก็ได้ — ทวีต วิดีโอ บทความ — เป็นการ์ดคอลลาจภาพที่สวยงาม ส่วนขยายนี้เก็บบุ๊กมาร์กของคุณไว้ในเบราว์เซอร์ของคุณเองและไม่ส่งไปยังเซิร์ฟเวอร์ใด ๆ — ไม่มีบัญชี ไม่มีการติดตาม ไม่มีการวิเคราะห์" },
  "optAboutOpenBoard": { "message": "เปิดบอร์ด AllMarks →" },
  "optSaved": { "message": "บันทึกแล้ว" },
  "popupOpenSettings": { "message": "เปิดการตั้งค่า" },
  "popupHint": { "message": "กด Ctrl+Shift+B ในหน้าใดก็ได้เพื่อบันทึก" }
}
```

### 4-15. `_locales/vi/messages.json`
```json
{
  "extName": { "message": "AllMarks" },
  "extDescription": { "message": "Lưu bất kỳ URL nào vào AllMarks dưới dạng thẻ cắt dán trực quan đẹp mắt." },
  "optDocTitle": { "message": "Cài đặt AllMarks" },
  "optAutosaveTitle": { "message": "Tự động lưu ở nút mạng xã hội" },
  "optAutosaveLede": { "message": "Khi bạn nhấn một trong các nút này, trang sẽ tự động được lưu vào AllMarks. Các URL đã lưu sẽ được bỏ qua âm thầm." },
  "optAutosaveXLike": { "message": "X (Twitter) — nút Thích" },
  "optAutosaveNoteLike": { "message": "note — nút スキ" },
  "optAutosaveXBookmark": { "message": "X (Twitter) — nút Dấu trang" },
  "optAutosaveVimeoLike": { "message": "Vimeo — nút Thích" },
  "optAutosaveYouTubeLike": { "message": "YouTube — nút Thích" },
  "optAutosaveVimeoWatchLater": { "message": "Vimeo — nút Xem sau" },
  "optAutosaveYouTubeWatchLater": { "message": "YouTube — Xem sau" },
  "optAutosaveSoundCloudLike": { "message": "SoundCloud — nút Thích" },
  "optCursorTitle": { "message": "Vị trí viên con trỏ khi không có dữ liệu chuột" },
  "optCursorAtCursor": { "message": "Tại con trỏ" },
  "optCursorBottomRight": { "message": "Góc dưới bên phải" },
  "optFloatingTitle": { "message": "Nút lưu nổi" },
  "optFloatingLede": { "message": "Một dấu nhỏ nằm ở mép mỗi trang. Nhấp để lưu trang vào AllMarks. Nhấn giữ để kéo — nó sẽ hút vào mép trái hoặc phải gần nhất. Các trang đã lưu hiển thị dấu tích xanh cố định." },
  "optFloatingToggle": { "message": "Hiển thị nút lưu nổi trên mọi trang" },
  "optFloatingIdleOpacity": { "message": "Độ mờ khi nhàn rỗi" },
  "optFloatingReset": { "message": "Đặt lại vị trí về mép phải, chính giữa" },
  "optFloatingHideTitle": { "message": "Ẩn trên các trang cụ thể" },
  "optFloatingHideLede": { "message": "Thêm một tên miền (ví dụ: example.com) để ẩn nút nổi chỉ trên trang đó. Các phím tắt lưu khác vẫn hoạt động." },
  "optFloatingAdd": { "message": "Thêm" },
  "optFloatingNoSites": { "message": "Chưa ẩn trang nào." },
  "optFloatingRemove": { "message": "Xóa" },
  "optIdleOpacityHidden": { "message": "0% (ẩn cho đến khi di chuột)" },
  "optIdleOpacityDefault": { "message": "30% (mặc định)" },
  "optShortcutTitle": { "message": "Phím tắt bàn phím" },
  "optShortcutDefault": { "message": "Mặc định:" },
  "optShortcutMacNote": { "message": "(Mac: ⌘+Shift+B)" },
  "optShortcutCustomize": { "message": "Tùy chỉnh phím tắt" },
  "optAboutTitle": { "message": "Giới thiệu" },
  "optAboutBody": { "message": "AllMarks lưu bất kỳ URL nào — tweet, video, bài viết — dưới dạng thẻ cắt dán trực quan đẹp mắt. Tiện ích giữ dấu trang của bạn trong trình duyệt của chính bạn và không gửi chúng đến bất kỳ máy chủ nào — không tài khoản, không theo dõi, không phân tích." },
  "optAboutOpenBoard": { "message": "Mở bảng AllMarks →" },
  "optSaved": { "message": "Đã lưu" },
  "popupOpenSettings": { "message": "Mở cài đặt" },
  "popupHint": { "message": "Nhấn Ctrl+Shift+B trên bất kỳ trang nào để lưu." }
}
```

> **注**: 上記に加えて en/messages.json（§4-1）が正本＝合計15ファイル。ディレクトリは `extension/_locales/<code>/messages.json`。

---

## 5. `popup.html` / `popup.js` の i18n 化

### `extension/popup.html`（現13行）を以下で全置換
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <div class="brand">AllMarks</div>
  <button id="settings" data-i18n="popupOpenSettings">Open settings</button>
  <p class="hint" data-i18n="popupHint">Press Ctrl+Shift+B on any page to save.</p>
  <script src="popup.js"></script>
</body>
</html>
```
> 変更点: `<button>Open settings</button>` → `data-i18n="popupOpenSettings"`、hint の `<kbd>Ctrl+Shift+B</kbd>` を**プレーンテキスト** `Ctrl+Shift+B` に変更し `data-i18n="popupHint"` を付与（`textContent` 置換のため `<kbd>` は使えない。i18n を優先しキー装飾を捨てる判断）。`popup.css` の `kbd{}`（現L15）は未使用になるが残置で害なし。

### `extension/popup.js`（現3行）を以下で全置換
```js
for (const el of document.querySelectorAll('[data-i18n]')) {
  const msg = chrome.i18n.getMessage(el.dataset.i18n)
  if (msg) el.textContent = msg
}
document.documentElement.lang = chrome.i18n.getUILanguage()
document.getElementById('settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
})
```

---

## 6. `manifest.json` の扱い（name / description）

- **`name`**: `"AllMarks"` は**ブランド＝リテラルのまま**（`__MSG__` 化しない）。
- **`description`**: L5 を localize する。以下に変更:
  - 変更前: `"description": "Save any URL to AllMarks as a beautiful visual collage card.",`
  - 変更後: `"description": "__MSG_extDescription__",`
- **`default_locale`**: L100 に `"default_locale": "en"` は既存 → 変更不要（`__MSG__` を使う条件を満たす）。
- `extName`/`extDescription` キーは §4-1 で全15言語に定義済み（`extName` は将来 name も localize したくなった時のために置くが、今回 name は使わない）。
- **確認**: `__MSG_extDescription__` を使うと Chrome は各ロケールの messages.json から description を引く。en に必ず存在させること（§4-1 にあり）。他ロケール欠落時は en フォールバック。

---

## 7. パリティ検査テスト（新設）

`tests/extension/locales-parity.test.ts` を新設。盤面 `messages/all-keys-parity.test.ts` のフラット構造版。`_locales` は tsconfig paths 外なので **`readFileSync + JSON.parse`** で読む（`import ... from` は使わない）。vitest 設定（`vitest.config.ts`）は `tests/e2e/**` のみ除外＝この新テストは自動で拾われる。

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Chrome i18n の _locales は盤面 messages/*.json とは別系統（フラット {key:{message,...}}）。
// このテストは 15 ロケールの messages.json が「en と同じキー集合・全 message 非空」で
// 揃っていることを保証する（欠損キーがあると options 画面がそのキーだけ英語 or 空に落ちる）。
const LOCALES = ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'tr', 'ru', 'ar', 'th', 'vi'] as const

function load(locale: string): Record<string, { message: string }> {
  const p = resolve(__dirname, '../../extension/_locales', locale, 'messages.json')
  return JSON.parse(readFileSync(p, 'utf8'))
}

describe('拡張 _locales のパリティ', () => {
  const en = load('en')
  const enKeys = Object.keys(en).sort()

  it('15 ロケールすべての messages.json が存在する', () => {
    for (const l of LOCALES) {
      const p = resolve(__dirname, '../../extension/_locales', l, 'messages.json')
      expect(existsSync(p), `${l}/messages.json missing`).toBe(true)
    }
  })

  it('en は下限キー数を満たす (リグレッション検知)', () => {
    expect(enKeys.length).toBeGreaterThan(30)
  })

  for (const locale of LOCALES) {
    if (locale === 'en') continue
    it(`${locale}: キー集合が en と完全一致 (欠損・余剰ゼロ)`, () => {
      const keys = Object.keys(load(locale)).sort()
      const missing = enKeys.filter((k) => !keys.includes(k))
      const extra = keys.filter((k) => !enKeys.includes(k))
      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] })
    })
    it(`${locale}: 全 message が非空文字列`, () => {
      const m = load(locale)
      for (const k of enKeys) {
        expect(typeof m[k]?.message, `${locale}.${k}.message must be string`).toBe('string')
        expect((m[k]?.message ?? '').length, `${locale}.${k}.message must be non-empty`).toBeGreaterThan(0)
      }
    })
  }
})
```

---

## 8. 検証手順（この順で確認・合格するまで完了宣言しない）

1. **JSON 構文**: 全16ファイル（en+14+テスト対象）が有効な JSON か。
   `node -e "for(const l of ['ja','en','zh','ko','es','fr','de','pt','it','nl','tr','ru','ar','th','vi'])JSON.parse(require('fs').readFileSync('extension/_locales/'+l+'/messages.json','utf8'))" && echo OK`
2. **パリティテスト**: `rtk vitest run tests/extension/locales-parity.test.ts`（15言語×キー一致・非空）。
3. **JS 構文**: 拡張 JS は tsc 対象外なので `node --check extension/options.js && node --check extension/popup.js`（reference: content-script は node --check で検査する掟）。
4. **既存拡張テスト回帰**: `rtk vitest run tests/extension/`（auto-save-config 等が壊れていないこと）。
5. **パッケージ検査**: `node scripts/package-extension.mjs` が通る（required 配列に `_locales/en/messages.json` があり存在。`Compress-Archive -Path 'extension/*'` は `_locales/` サブフォルダを再帰圧縮するので15言語追加で手順変更不要）。
6. **手動ロード確認（ユーザー）**: `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」で `extension/` を指定 → 設定ページを開き (a) サウンド演出が消えている (b) ブラウザUI言語を切り替えると文言が追従 (c) 各設定の保存が効く、を目視。ブラウザ言語が未対応なら英語表示になることも確認。

---

## 9. 新設・改修ファイル一覧（チェックリスト）

**新設（16）**:
- [ ] `extension/_locales/{ja,zh,ko,es,fr,de,pt,it,nl,tr,ru,ar,th,vi}/messages.json`（14）
- [ ] `tests/extension/locales-parity.test.ts`（1）
- [ ] （en は既存を実体化＝新規ではないが中身は全書き換え）

**改修（6）**:
- [ ] `extension/_locales/en/messages.json`（`{}` → §4-1 全キー）
- [ ] `extension/options.html`（§1 全置換）
- [ ] `extension/options.css`（§2 全置換）
- [ ] `extension/options.js`（§3 の A/B/C 編集）
- [ ] `extension/popup.html` / `extension/popup.js`（§5 全置換）
- [ ] `extension/manifest.json`（§6 description を `__MSG_extDescription__` に）

**任意**:
- [ ] `scripts/package-extension.mjs` の `required`（L15-38）に代表ロケール（例 `_locales/ja/messages.json`）を追加して欠落検知を強化。

---

## 10. フラット中立デザインの方向性メモ

- **狙い（spec §5「静かで清潔なパネル」）**: オシロ/フェーダー/EQ/globe は「音テーマの舞台装置」であって設定機能ではない。剥がしても**設定は1つも失われない**（§1-2 で id 温存）。フラット化＝無味乾燥ではなく、**タイポグラフィ（Geist / Geist Mono 維持）と余白で構成美**を出す。
- **AIっぽさ回避**（MEMORY: feedback_design_quality）: テンプレ然としたグレー羅列を避けるため、①左レール nav の active インジケータ（緑の縦バー）②チェック時のみ緑（A-mark green `#28f100`）という**1点だけの強いアクセント**で無機質さを崩す。色数は絞る（中立＝グレー階調＋緑1色）。
- **このアプリは表現ツールだが、設定画面は「道具の設定」**（§3 の原則＝拡張は道具の面で中立）。盤面の華やかさとは意図的に差別化し、静かで読みやすくする。
- **多言語での崩れ対策**: `.card-title`/`.card-sub`/`.about h2` のみ `text-transform: uppercase`＋`letter-spacing` を残すが、**本文（`.lede`/`.opt`）は通常ケース**で語長が伸びる ru/de/vi/th に耐える。`.opt-grid` は狭幅で1カラムに落ちる（既存の 760px メディアクエリ維持）。
- **ar（RTL）**: `applyI18n()` で `document.documentElement.lang` はセットするが `dir` は未設定。ar を綺麗に出すなら options.js の `applyI18n()` 末尾に次を足す（任意・レビューで判断）:
  ```js
  const rtl = ['ar', 'he', 'fa', 'ur']
  document.documentElement.dir = rtl.includes(chrome.i18n.getUILanguage().split('-')[0]) ? 'rtl' : 'ltr'
  ```
  CSS は論理プロパティ未使用（left/right 直書き）なので、完全な RTL 反転を求めるなら追加調整が要る＝**今回は lang のみ設定し、dir 対応は任意項目**として明示。
- **翻訳品質**: §4-2〜4-15 は AI 下書き。公開前にユーザー確認を推奨（runtime は en フォールバックがあるため未確認でも壊れはしない）。
