# BULK-IMPORT 第1弾: 拡張の一括取り込み（X ブックマーク全件＋YouTube 高評価/後で見る）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユーザーのログイン済みブラウザで、`x.com/i/bookmarks`（X ブックマーク全件）と `youtube.com/playlist?list=LL`（高評価）/ `?list=WL`（後で見る）を自動スクロールで収穫し、既存の保存経路（重複排除つき）へ流し込む「IMPORT ALL」パネルを拡張に足す。キュー＋進捗表示＋中断再開＋保存レート制御つき。

**Architecture:** 新 content script `bulk-import.js`（自己完結・対象 URL でのみパネルを出す）が、①ページを段階スクロールして item を収穫（**2 段階方式: 先に全部収穫 → 古い順に保存**。ボードは新しい順表示なので、古い順に保存すると X/YouTube 上の並びがボードでも再現される）②収穫 item を 1 件ずつ新メッセージ `booklage:bulk-save` で background に送る。background は新関数 `dispatchBulkSave`（`dispatchSave` からピル/クイックタグ演出を抜いた版）で既存の offscreen→save-iframe→`saveBookmarkDeduped` 経路に流し、結果（saved/duplicate/error）を返す。**1 件ずつ await ＋ 250ms 間隔**が自然なレート制御になる（ツイートの syndication 補完も同じペースに律速される）。実行状態は `chrome.storage.local` に永続化し、PAUSE / タブ閉じ / リロードから RESUME できる。ロジックは `extension/lib/bulk-*.js`（vitest 対象）に置き、content script は inline 複製（`dispatch.js` の ogp.js 方式と同じ「NOTE: keep in sync」慣行）。

**Tech Stack:** Chrome 拡張 MV3（plain JS content script / ES module lib+background）/ vitest / 既存 offscreen 保存ブリッジ

**⚠ s49 Pinterest の教訓（この計画の掟）:** **実 DOM を採取するまで selector を確定させない**。Task 0（ユーザー協働の DOM 採取）が完了し、Task 2 で採取物からフィクスチャを作って selector 仮説を検証するまで、収穫コードを commit しない。仮説 selector が採取物と食い違ったら**採取物に合わせて直す**（仮説を信じない）。

## 設計判断（確定済み）

- **方針（ユーザー確定 s186）**: 「対応サイトは基本全部、拡張で一括取り込み」。第1弾＝X ブクマ＋YouTube LL/WL（量が大きい）。第2弾＝note/Vimeo/SoundCloud（同じエンジンにアダプタを足すだけの設計にしておく）。Instagram は対象外。
- **本人のログイン済みブラウザで本人のデータを読む**型＝既存 per-site 連動と同じ位置づけ。サーバー不要・鍵も持たない。
- **2 段階（収穫→保存）**: 保存順を「古い→新しい」にするため（ボードの orderIndex は新しい順表示。新しいものを最後に保存すると盤面の一番上に来る＝元サイトの並びが保たれる）。収穫中に保存を並走させない。
- **自動保存トグル（autoSaveXBookmark 等）にはゲートさせない**: あれは「クリック連動の自動保存」の設定。一括取り込みはユーザーが START を押す明示操作。
- **ピル/フローティングボタン演出は出さない**: 数百〜数千回チカチカする。進捗はパネルだけが出す（`dispatchBulkSave` は演出メッセージを送らない）。
- **URL は既存保存経路と同じ canonical 形に揃える**（重複排除がアプリ側「生 URL 完全一致」なので死活問題）: tweet = `https://x.com/{handle}/status/{id}`（twitter.js の `extractTweetUrl` と同形）、YouTube = `https://www.youtube.com/watch?v={id}`（`list=`/`index=` を落とす）。canonical 形は normalize-安定（`per-site-mirror-invariant.test.ts` の掟）。
- **panel の UI 文言は英語リテラル**（拡張の既存慣行。i18n は別 sprint）。
- **Chrome 再審査はこの計画では行わない**: manifest version を 0.1.25 に上げて sideload 検証まで。ストア提出は N-28（Pinterest）/ N-29（options 導線）と束ねて 1 回（ロードマップ §4）。

## Global Constraints

- content script（`bulk-import.js`）は **plain JS・import 禁止・自己完結**（既存 twitter.js と同じ）。共有したいロジックは `extension/lib/` に source of truth を置き、content script に inline 複製＋`NOTE: keep in sync with extension/lib/...` コメント（dispatch.js 内 `extractOgpFromTab` の確立済み慣行）
- `chrome.*` を触る前に `isExtensionAlive()` ガード＋try/catch（twitter.js L13-15 の慣行）
- `booklage:*` メッセージ型は安定契約（リネーム禁止）。新型は `booklage:bulk-save` の 1 つだけ
- 拡張 UI 文言は英語リテラル。押せるものは十分大きく（パネルのボタンは高さ 36px 以上）
- アプリ側（Next.js）のコードは**一切変更しない**（保存の着地は既存 save-iframe / `saveBookmarkDeduped` のまま）
- 検証: `rtk vitest run` ＋ `node --check extension/bulk-import.js`（plain JS の構文検査）＋ `pnpm package:extension` の存在チェックが通ること
- **実 DOM の採取物（dumps）は `docs/private/dom-dumps/` に置く**（gitignored・ユーザーのブクマ内容＝個人情報）。commit するフィクスチャは**必ず匿名化**（本文・ハンドル・動画タイトルをダミーに置換。構造と属性は保つ）
- git は `rtk` 前置。`--no-verify` 絶対禁止

## 事実の索引（s187 調査済み・行番号つき）

- **manifest**（`extension/manifest.json`、version `0.1.24`）: content_scripts ブロック 3 = `https://x.com/*` 等 → `twitter.js`、ブロック 4 = `https://www.youtube.com/*` 等 → `youtube.js`。**`x.com/i/bookmarks` と `youtube.com/playlist` は既存 matches に含まれる**
- **保存経路**: content → `chrome.runtime.sendMessage({type:'booklage:auto-save', source, ogp})` → `background.js:58-70` → `dispatchSave`（`extension/lib/dispatch.js:91-177`）→ `ensureOffscreen`(:12-26) → envelope `{type:'booklage:save', payload:{...ogp, nonce, skipIfDuplicate:true}}`(:110-113) → `postToOffscreen`(:82-89) → offscreen.js が 250ms 再投函（`lib/offscreen-repost.js`）→ save-iframe（`app/save-iframe/SaveIframeClient.tsx:252-261`）→ `saveBookmarkDeduped`（1 トランザクションで生 URL 完全一致 dedup、`lib/storage/indexeddb.ts:1022-1053`）
- **結果の翻訳**: `!result?.ok`→error / `result.skipped`→duplicate / それ以外→saved（dispatch.js:141-144）。timeout/undefined は `recreateOffscreenIfAlone`＋別 nonce で 1 回だけリトライ（:131-136）。成功/重複は `mirrorAddUrl(normalizeUrl(url))`（:154-156）
- **offscreenInFlight**（dispatch.js:10, 99, 138）: 共有 offscreen を並行操作から守る参照カウント。**新関数も同じ規律で increment/decrement する**
- **ミラー**: `savedUrlsMirror`（storage.local・キーは normalizeUrl 済み・MAX 50000）。content 側は snapshot Set＋onChanged 追従（twitter.js:56-77 の型をそのまま使う）
- **canonical URL**: tweet = `extractTweetUrl`（twitter.js:83-93、`a[href*="/status/"] time` の closest a → `new URL(href, location.origin).href`）。この形は normalize-安定（`tests/extension/per-site-mirror-invariant.test.ts:21-28`）
- **ツイートのメタ**: 保存時は DOM 由来の title（`userName + ': ' + text` 全文、twitter.js:123）/ description（text.slice(0,200)）/ image（`img[src*="pbs.twimg.com/media"]` → `video[poster]` → amplify、:105-115）/ favicon `https://abs.twimg.com/favicons/twitter.3.ico` / siteName `'X'`。**photos/mediaSlots は保存直後に save-iframe が syndication で補完**（SaveIframeClient.tsx:304-317）＋ボード側 backfill もある＝一括でも追加実装不要
- **YouTube のタイル収穫の先例**: `youtube.js` に `VIDEO_TILE_SELECTOR`(:138-148) / `extractTileOgp`(:165-188) / `captureVideoFromTile`(:190-203) が既にある（「後で見る」ボタンのタイル保存用）。**favicon/siteName の値は extractTileOgp のものをそのまま流用する**
- **auto-save は enabled ゲートあり**（background.js:62）— bulk はこのゲートを通らない別ハンドラにする
- **テスト**: `tests/extension/*.test.ts` が `extension/lib/*.js` を直接 import（vitest）。content script 本体はテスト対象外（ロジックを lib に切り出す）。`pnpm package:extension` は `scripts/package-extension.mjs` の `required` 配列で存在チェック
- **レート制限は上流に無い**（`/api/ogp`・`/api/tweet-meta` とも）→ クライアント側で直列＋間隔を空けるのが必須（この計画は 1 件 await ＋ 250ms）

---

### Task 0: 実 DOM の採取（ユーザー協働・selector 確定の前提） 【どのモデルでも可・ユーザーに依頼】

**⚠ このタスクが終わるまで Task 2 以降の収穫コードを書かない。**

- [ ] **Step 1: ユーザーに以下を依頼する（コピペで渡す）**

````
一括取り込みの下ごしらえとして、ログイン済みの Chrome で 3 ページの構造を採取させてください。
各ページで F12 → Console に下のコードを貼って Enter（ファイルが 1 個ダウンロードされます）。
さらに、そのページを 2〜3 画面ぶん下にスクロールしてから、もう一度同じコードを実行してください
（計 2 ファイル/ページ。スクロールで古い項目が DOM から消えるかを見ます）。

対象ページ:
1. https://x.com/i/bookmarks
2. https://www.youtube.com/playlist?list=WL   （後で見る）
3. https://www.youtube.com/playlist?list=LL   （高評価）

貼るコード:

(() => {
  const CANDIDATES = [
    'article[data-testid="tweet"]',
    '[data-testid="cellInnerDiv"]',
    'ytd-playlist-video-renderer',
    'ytd-continuation-item-renderer',
    'a#video-title',
  ]
  const lines = []
  lines.push('URL: ' + location.href)
  const se = document.scrollingElement
  lines.push('scrollingElement=' + (se ? se.tagName : 'none') + ' scrollHeight=' + (se ? se.scrollHeight : 0) + ' innerHeight=' + innerHeight + ' scrollY=' + scrollY)
  for (const sel of CANDIDATES) lines.push('COUNT ' + sel + ' = ' + document.querySelectorAll(sel).length)
  for (const sel of CANDIDATES) {
    const els = Array.from(document.querySelectorAll(sel)).slice(0, 2)
    for (const el of els) { lines.push('===== SAMPLE ' + sel + ' ====='); lines.push(el.outerHTML) }
  }
  const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'dom-dump.txt'
  a.click()
})()

できた 6 ファイルを教えてください（名前を x-bookmarks-1.txt / x-bookmarks-2.txt /
yt-wl-1.txt / yt-wl-2.txt / yt-ll-1.txt / yt-ll-2.txt に変えてもらえると助かります）。
````

- [ ] **Step 2: 受け取ったファイルを `docs/private/dom-dumps/2026-07-bulk-import/` に置く**（gitignored であることを `rtk git status` で確認。tracked に出たら即中止して置き場を直す）

- [ ] **Step 3: 採取物から次の問いに答え、結果を Task 2 の selector 確定に使う**（このステップの答えを plan 実行ログに書き残す）:
  1. X ブクマ一覧に `article[data-testid="tweet"]` は存在するか。tweet の permalink（`a[href*="/status/"] time`）・本文（`[data-testid="tweetText"]`）・作者（`[data-testid="User-Name"]`）・画像（`img[src*="pbs.twimg.com/media"]`）は twitter.js と同じ testid で取れるか
  2. スクロール後のダンプで「1 回目にあった項目が DOM から消えている」か（= 仮想化の有無。消えるなら段階スクロール収穫が必須＝この計画の既定どおり）
  3. YouTube プレイリストの項目は `ytd-playlist-video-renderer` か。動画リンクとタイトルは `a#video-title` で取れるか（href の形も記録: `/watch?v=ID&list=WL&index=N` のはず）
  4. 「もっと読み込む」の目印 `ytd-continuation-item-renderer` は末尾に居るか
  5. 両サイトとも window スクロール（scrollingElement=HTML）か

---

### Task 1: 実行状態の純関数 `extension/lib/bulk-run.js`（キュー・進捗・再開） 【Haiku 可】

**Files:**
- Create: `extension/lib/bulk-run.js`
- Test: `tests/extension/bulk-run.test.ts`

**Interfaces:**
- Produces（全部 pure・storage への読み書きは呼び出し側）:
  - `createRun(site)` → run オブジェクト
  - `addHarvested(run, items)` → 新規追加数（run を in-place 更新。url で重複排除・収穫順を保持）
  - `markScrollDone(run)` / `nextPendingUrl(run)`（**保存順＝収穫の逆順**: 配列末尾＝一番古い項目から返す）
  - `markOutcome(run, url, outcome)`（outcome: `'saved' | 'duplicate' | 'error'`）
  - `summarize(run)` → `{ found, saved, duplicate, error, pending }`
  - `isFinished(run)`（scrollDone かつ pending 0）
  - `STORAGE_KEY_PREFIX = 'bulkImportRun:'`（保存キーは `bulkImportRun:${site}`）

- [ ] **Step 1: Write the failing test**

`tests/extension/bulk-run.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  addHarvested,
  createRun,
  isFinished,
  markOutcome,
  markScrollDone,
  nextPendingUrl,
  summarize,
} from '../../extension/lib/bulk-run.js'

const item = (n: number) => ({
  url: `https://x.com/u/status/${n}`,
  title: `t${n}`,
  description: '',
  image: '',
  favicon: '',
  siteName: 'X',
})

describe('bulk-run state machine', () => {
  it('dedupes harvested items by url and keeps harvest order', () => {
    const run = createRun('x-bookmarks')
    expect(addHarvested(run, [item(1), item(2)])).toBe(2)
    expect(addHarvested(run, [item(2), item(3)])).toBe(1)
    expect(summarize(run)).toEqual({ found: 3, saved: 0, duplicate: 0, error: 0, pending: 3 })
  })

  it('drains pending in REVERSE harvest order (oldest first → newest ends on top of the board)', () => {
    const run = createRun('x-bookmarks')
    addHarvested(run, [item(1), item(2), item(3)]) // 1 = 一覧の先頭 = 一番新しい
    markScrollDone(run)
    expect(nextPendingUrl(run)).toBe(item(3).url)
    markOutcome(run, item(3).url, 'saved')
    expect(nextPendingUrl(run)).toBe(item(2).url)
    markOutcome(run, item(2).url, 'duplicate')
    expect(nextPendingUrl(run)).toBe(item(1).url)
    markOutcome(run, item(1).url, 'error')
    expect(nextPendingUrl(run)).toBeNull()
    expect(summarize(run)).toEqual({ found: 3, saved: 1, duplicate: 1, error: 1, pending: 0 })
    expect(isFinished(run)).toBe(true)
  })

  it('is not finished while scrolling is still in progress, even with zero pending', () => {
    const run = createRun('yt-wl')
    expect(isFinished(run)).toBe(false)
  })

  it('survives a JSON round-trip (storage.local persistence)', () => {
    const run = createRun('yt-ll')
    addHarvested(run, [item(1), item(2)])
    markScrollDone(run)
    markOutcome(run, item(2).url, 'saved')
    const revived = JSON.parse(JSON.stringify(run))
    expect(nextPendingUrl(revived)).toBe(item(1).url)
    expect(summarize(revived)).toEqual({ found: 2, saved: 1, duplicate: 0, error: 0, pending: 1 })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
rtk npx vitest run tests/extension/bulk-run.test.ts
```

- [ ] **Step 3: Implement**

`extension/lib/bulk-run.js`:

```js
// Bulk-import run state (pure data + pure transitions). The content script
// (extension/bulk-import.js) persists this object as-is into
// chrome.storage.local under `bulkImportRun:${site}` so a paused/closed run
// can RESUME. Everything here must stay JSON-serializable.
//
// Save order: REVERSE of harvest order. The list pages render newest-first;
// the board renders newest-save-first. Saving oldest-first makes the imported
// batch appear on the board in the same order as on the source site.

export const STORAGE_KEY_PREFIX = 'bulkImportRun:'

export function createRun(site) {
  return {
    site,                 // 'x-bookmarks' | 'yt-wl' | 'yt-ll'
    scrollDone: false,
    order: [],            // harvest order (newest first, as rendered)
    items: {},            // url -> { payload, state: 'pending'|'saved'|'duplicate'|'error' }
  }
}

export function addHarvested(run, items) {
  let added = 0
  for (const payload of items) {
    if (!payload || typeof payload.url !== 'string' || !payload.url) continue
    if (run.items[payload.url]) continue
    run.items[payload.url] = { payload, state: 'pending' }
    run.order.push(payload.url)
    added++
  }
  return added
}

export function markScrollDone(run) {
  run.scrollDone = true
}

export function nextPendingUrl(run) {
  for (let i = run.order.length - 1; i >= 0; i--) {
    const url = run.order[i]
    if (run.items[url] && run.items[url].state === 'pending') return url
  }
  return null
}

export function markOutcome(run, url, outcome) {
  const entry = run.items[url]
  if (!entry) return
  if (outcome === 'saved' || outcome === 'duplicate' || outcome === 'error') entry.state = outcome
}

export function summarize(run) {
  const s = { found: run.order.length, saved: 0, duplicate: 0, error: 0, pending: 0 }
  for (const url of run.order) {
    const st = run.items[url].state
    if (st === 'saved') s.saved++
    else if (st === 'duplicate') s.duplicate++
    else if (st === 'error') s.error++
    else s.pending++
  }
  return s
}

export function isFinished(run) {
  return run.scrollDone === true && nextPendingUrl(run) === null
}
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
rtk npx vitest run tests/extension/bulk-run.test.ts
rtk git add extension/lib/bulk-run.js tests/extension/bulk-run.test.ts
rtk git commit -m "feat(extension): bulk-import run state machine (queue/progress/resume)"
```

---

### Task 2: 収穫ロジック `extension/lib/bulk-harvest.js` ＋ 匿名化フィクスチャ検証 【Sonnet 推奨（採取物の読み解きを含む）】

**⚠ 前提: Task 0 完了。selector は必ず採取物で検証してから確定。以下のコードは「仮説の初期値」であり、採取物と食い違ったら採取物に合わせて書き換えること（そのときはこの計画書の該当行も更新する）。**

**Files:**
- Create: `extension/lib/bulk-harvest.js`
- Create: `tests/extension/fixtures/bulk/x-bookmarks.html`（採取物から**匿名化**して作る）
- Create: `tests/extension/fixtures/bulk/yt-playlist.html`（同上）
- Test: `tests/extension/bulk-harvest.test.ts`

**Interfaces:**
- Produces:
  - `detectBulkPage(href)` → `{ site: 'x-bookmarks' } | { site: 'yt-wl' } | { site: 'yt-ll' } | null`
  - `canonicalWatchUrl(href)` → `'https://www.youtube.com/watch?v=<id>'` | null
  - `harvestXBookmarks(root)` → payload[]（root は Document または Element）
  - `harvestYtPlaylist(root)` → payload[]
  - payload 形 = `{ url, title, description, image, favicon, siteName }`（save envelope と同形）

- [ ] **Step 1: 匿名化フィクスチャを作る**

採取物（`docs/private/dom-dumps/2026-07-bulk-import/`）の SAMPLE ブロックから、**item コンテナ 2〜3 個ぶん**を `tests/extension/fixtures/bulk/*.html` にコピーし、次を必ず置換する（構造・class・data-testid・タグはそのまま）:
- ツイート本文・表示名 → `Dummy body text one` / `Dummy Author`、ハンドル → `dummyuser`
- status ID → `1000000000000000001` から連番、動画 ID → `AAAAAAAAAAA` / `BBBBBBBBBBB`
- 画像 URL のパス末尾 → `https://pbs.twimg.com/media/DUMMY1?format=jpg`（ホストは保つ）
- 動画タイトル → `Dummy Video One` 等

置換後、`rtk grep -i "自分のハンドルや実タイトルの断片" tests/extension/fixtures/` で漏れゼロを確認。

- [ ] **Step 2: Write the failing test**

`tests/extension/bulk-harvest.test.ts`（**jsdom で fixture を食わせる**）:

```ts
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  canonicalWatchUrl,
  detectBulkPage,
  harvestXBookmarks,
  harvestYtPlaylist,
} from '../../extension/lib/bulk-harvest.js'

function fixtureRoot(name: string): HTMLElement {
  const html = readFileSync(join(__dirname, 'fixtures', 'bulk', name), 'utf8')
  const div = document.createElement('div')
  div.innerHTML = html
  return div
}

describe('detectBulkPage', () => {
  it('matches exactly the three supported list pages', () => {
    expect(detectBulkPage('https://x.com/i/bookmarks')).toEqual({ site: 'x-bookmarks' })
    expect(detectBulkPage('https://x.com/i/bookmarks?foo=1')).toEqual({ site: 'x-bookmarks' })
    expect(detectBulkPage('https://www.youtube.com/playlist?list=WL')).toEqual({ site: 'yt-wl' })
    expect(detectBulkPage('https://www.youtube.com/playlist?list=LL')).toEqual({ site: 'yt-ll' })
    expect(detectBulkPage('https://x.com/home')).toBeNull()
    expect(detectBulkPage('https://www.youtube.com/playlist?list=PLabc')).toBeNull()
    expect(detectBulkPage('https://www.youtube.com/watch?v=abc')).toBeNull()
  })
})

describe('canonicalWatchUrl', () => {
  it('strips list/index and keeps only v=', () => {
    expect(canonicalWatchUrl('/watch?v=AAAAAAAAAAA&list=WL&index=3')).toBe('https://www.youtube.com/watch?v=AAAAAAAAAAA')
    expect(canonicalWatchUrl('https://www.youtube.com/watch?v=BBBBBBBBBBB&pp=x')).toBe('https://www.youtube.com/watch?v=BBBBBBBBBBB')
    expect(canonicalWatchUrl('/playlist?list=WL')).toBeNull()
  })
})

describe('harvestXBookmarks (fixture from the real bookmarks page)', () => {
  it('extracts canonical tweet urls + DOM metadata', () => {
    const items = harvestXBookmarks(fixtureRoot('x-bookmarks.html'))
    expect(items.length).toBeGreaterThanOrEqual(2)
    for (const it of items) {
      expect(it.url).toMatch(/^https:\/\/x\.com\/[^/]+\/status\/\d+$/)
      expect(it.siteName).toBe('X')
      expect(it.favicon).toBe('https://abs.twimg.com/favicons/twitter.3.ico')
      expect(typeof it.title).toBe('string')
      expect(it.title.length).toBeGreaterThan(0)
    }
  })
})

describe('harvestYtPlaylist (fixture from the real WL/LL page)', () => {
  it('extracts canonical watch urls + titles + derivable thumbnails', () => {
    const items = harvestYtPlaylist(fixtureRoot('yt-playlist.html'))
    expect(items.length).toBeGreaterThanOrEqual(2)
    for (const it of items) {
      expect(it.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/)
      expect(it.image).toMatch(/^https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\//)
      expect(it.title.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 3: Run to verify it fails**

```bash
rtk npx vitest run tests/extension/bulk-harvest.test.ts
```

- [ ] **Step 4: Implement（selector は採取物で検証済みのものに差し替えてから commit）**

`extension/lib/bulk-harvest.js`:

```js
// Harvest logic for the bulk importer. Source of truth for the inline copies
// in extension/bulk-import.js (content scripts can't import — same convention
// as extractOgpFromTab in lib/dispatch.js).
//
// SELECTORS were verified against real DOM dumps on 2026-07-XX
// (docs/private/dom-dumps/2026-07-bulk-import/ — see Task 0 of the plan).
// If a site breaks, re-dump BEFORE editing selectors (s49 lesson).

export function detectBulkPage(href) {
  let u
  try { u = new URL(href) } catch (_) { return null }
  const host = u.hostname.toLowerCase()
  if ((host === 'x.com' || host === 'twitter.com') && u.pathname === '/i/bookmarks') {
    return { site: 'x-bookmarks' }
  }
  if ((host === 'www.youtube.com' || host === 'm.youtube.com') && u.pathname === '/playlist') {
    const list = u.searchParams.get('list')
    if (list === 'WL') return { site: 'yt-wl' }
    if (list === 'LL') return { site: 'yt-ll' }
  }
  return null
}

export function canonicalWatchUrl(href) {
  let u
  try { u = new URL(href, 'https://www.youtube.com') } catch (_) { return null }
  if (u.pathname !== '/watch') return null
  const v = u.searchParams.get('v')
  if (!v) return null
  return 'https://www.youtube.com/watch?v=' + v
}

// --- X bookmarks -----------------------------------------------------------
// Same per-tweet selectors as extension/twitter.js (verified to hold on the
// /i/bookmarks timeline by the Task 0 dump): the permalink is the <a> that
// wraps the <time>, body is [data-testid="tweetText"], author is the first
// line of [data-testid="User-Name"], media priority mirrors extractTweetOgp.
export function harvestXBookmarks(root) {
  const out = []
  const articles = root.querySelectorAll('article[data-testid="tweet"]')
  for (const article of articles) {
    const timeEl = article.querySelector('a[href*="/status/"] time')
    const link = timeEl ? timeEl.closest('a') : null
    const href = link ? link.getAttribute('href') : null
    if (!href) continue
    let url
    try { url = new URL(href, 'https://x.com').href } catch (_) { continue }
    const textEl = article.querySelector('[data-testid="tweetText"]')
    const text = (textEl && textEl.textContent ? textEl.textContent : '').trim()
    const userNameEl = article.querySelector('[data-testid="User-Name"]')
    const userNameRaw = userNameEl && userNameEl.textContent ? userNameEl.textContent : ''
    const userName = userNameRaw.split('\n')[0].trim()
    let image = ''
    const mediaImg = article.querySelector('img[src*="pbs.twimg.com/media"]')
    if (mediaImg) image = mediaImg.getAttribute('src') || ''
    if (!image) {
      const videoEl = article.querySelector('video[poster]')
      if (videoEl) image = videoEl.getAttribute('poster') || ''
    }
    if (!image) {
      const ampImg = article.querySelector('img[src*="amplify_video_thumb"], img[src*="ext_tw_video_thumb"]')
      if (ampImg) image = ampImg.getAttribute('src') || ''
    }
    const title = userName && text ? userName + ': ' + text : (text || userName || url)
    out.push({
      url,
      title,
      description: text.slice(0, 200),
      image,
      favicon: 'https://abs.twimg.com/favicons/twitter.3.ico',
      siteName: 'X',
    })
  }
  return out
}

// --- YouTube playlist (WL / LL) --------------------------------------------
// Item container + title anchor verified by the Task 0 dump. The thumbnail is
// DERIVED from the video id (i.ytimg.com) instead of scraping <img> — playlist
// thumbs lazy-load and would often be empty at harvest time.
export function harvestYtPlaylist(root) {
  const out = []
  const tiles = root.querySelectorAll('ytd-playlist-video-renderer')
  for (const tile of tiles) {
    const a = tile.querySelector('a#video-title')
    const href = a ? a.getAttribute('href') : null
    const url = href ? canonicalWatchUrl(href) : null
    if (!url) continue
    const videoId = url.slice(url.indexOf('v=') + 2)
    const title = (a.textContent || '').trim() || url
    out.push({
      url,
      title,
      description: '',
      image: 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg',
      favicon: 'https://www.youtube.com/favicon.ico',
      siteName: 'YouTube',
    })
  }
  return out
}
```

※ **favicon/siteName は `extension/youtube.js` の `extractTileOgp`（L165-188）の実値と一致させる**こと（読んで確認。違ったらそちらに合わせ、このテストの期待値も直す）。

- [ ] **Step 5: canonical 形の normalize-安定を invariant テストに追加**

`tests/extension/per-site-mirror-invariant.test.ts` の `CANONICAL_EXTRACTED_URLS` 配列に追記:

```ts
    'https://x.com/handle/status/1000000000000000001', // bulk-import (X bookmarks)
    'https://www.youtube.com/watch?v=AAAAAAAAAAA',     // bulk-import (YT playlist)
```

- [ ] **Step 6: Run to verify it passes → Commit**

```bash
rtk npx vitest run tests/extension/bulk-harvest.test.ts tests/extension/per-site-mirror-invariant.test.ts
rtk git add extension/lib/bulk-harvest.js tests/extension/bulk-harvest.test.ts tests/extension/fixtures/bulk tests/extension/per-site-mirror-invariant.test.ts
rtk git commit -m "feat(extension): bulk harvest logic verified against real DOM dumps (X bookmarks + YT playlists)"
```

---

### Task 3: `dispatchBulkSave` ＋ background 配線（演出なし・結果を返す保存） 【Haiku 可】

**Files:**
- Modify: `extension/lib/dispatch.js`（末尾に 1 関数追加）
- Modify: `extension/background.js`（onMessage に 1 分岐追加）
- Test: `tests/extension/bulk-dispatch-contract.test.ts`（import 可能性＋契約の smoke）

**Interfaces:**
- Consumes: dispatch.js のモジュール内部（`ensureOffscreen` / `postToOffscreen` / `makeNonce` / `recreateOffscreenIfAlone` / `offscreenInFlight` / `mirrorAddUrl` / `normalizeUrl`）
- Produces:
  - `dispatchBulkSave(ogp): Promise<'saved' | 'duplicate' | 'error'>`
  - message `booklage:bulk-save`（content→BG、`{ type, ogp }`、**sendResponse で `{ outcome }` を返す**）

- [ ] **Step 1: Write the failing test**

`tests/extension/bulk-dispatch-contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import * as dispatch from '../../extension/lib/dispatch.js'

// dispatch.js is not unit-tested (chrome.* globals), but it IS an ES module we
// can import under node — this smoke test pins (1) the module stays importable
// (syntax guard for plain-JS edits) and (2) the bulk entry point exists.
describe('bulk-save dispatch contract', () => {
  it('exports dispatchBulkSave alongside the existing dispatchers', () => {
    expect(typeof dispatch.dispatchSave).toBe('function')
    expect(typeof dispatch.dispatchBulkSave).toBe('function')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
rtk npx vitest run tests/extension/bulk-dispatch-contract.test.ts
```

- [ ] **Step 3: Implement — dispatch.js 末尾（`dispatchAddNewTag` の後）に追加**

```js
// Bulk-import save: same offscreen bridge + skipIfDuplicate + one-shot
// self-heal as dispatchSave, but (1) the OGP payload comes fully harvested
// from the list-page DOM (no executeScript), and (2) NO pill / floating-button
// / quick-tag messages — a bulk run would flash them hundreds of times; the
// importer panel is the only progress surface. Returns the outcome so the
// content script can drive its queue with per-item backpressure.
export async function dispatchBulkSave(ogp) {
  if (!ogp || typeof ogp.url !== 'string' || !ogp.url) return 'error'
  offscreenInFlight++
  let result
  try {
    await ensureOffscreen()
    const nonce = makeNonce('bulk')
    const envelope = {
      type: 'booklage:save',
      payload: { ...ogp, nonce, skipIfDuplicate: true },
    }
    result = await postToOffscreen(envelope, nonce)
    if (!result?.ok && (result?.error === 'timeout' || result == null)) {
      await recreateOffscreenIfAlone()
      const retryNonce = makeNonce('bulk-retry')
      result = await postToOffscreen({ ...envelope, payload: { ...envelope.payload, nonce: retryNonce } }, retryNonce)
    }
  } finally {
    offscreenInFlight--
  }
  let finalState
  if (!result?.ok) finalState = 'error'
  else if (result.skipped) finalState = 'duplicate'
  else finalState = 'saved'
  if (finalState === 'saved' || finalState === 'duplicate') {
    try { await mirrorAddUrl(normalizeUrl(ogp.url), chrome.storage.local) } catch (_) {}
  }
  return finalState
}
```

- [ ] **Step 4: Implement — background.js**

import 行（L1）を変更:

```js
import { dispatchSave, dispatchAddTag, dispatchAddNewTag, dispatchBulkSave } from './lib/dispatch.js'
```

`chrome.runtime.onMessage.addListener((msg, sender) => {` のリスナーに **第 3 引数 `sendResponse` を追加**し（`(msg, sender, sendResponse) => {`）、`booklage:auto-save` 分岐の直前に追加:

```js
  if (msg.type === 'booklage:bulk-save') {
    if (!msg.ogp || typeof msg.ogp.url !== 'string' || !msg.ogp.url) return
    void (async () => {
      let outcome = 'error'
      try {
        outcome = await dispatchBulkSave(msg.ogp)
      } catch (e) {
        console.warn('[booklage] bulk-save failed:', e)
      }
      try { sendResponse({ outcome }) } catch (_) { /* tab gone mid-save */ }
    })()
    return true // keep the message channel open for the async sendResponse
  }
```

※ 他の分岐の `return`（undefined）はそのまま＝既存挙動不変。`return true` はこの分岐だけ。

- [ ] **Step 5: Run to verify it passes → Commit**

```bash
rtk npx vitest run tests/extension/bulk-dispatch-contract.test.ts
node --check extension/background.js
rtk git add extension/lib/dispatch.js extension/background.js tests/extension/bulk-dispatch-contract.test.ts
rtk git commit -m "feat(extension): dispatchBulkSave — quiet bulk save path returning per-item outcome"
```

※ `node --check extension/background.js` は import 構文で失敗する場合がある（module 扱いされない環境）。失敗したら vitest の import smoke（Step 1 のテストが background の import 先 dispatch.js を通す）と Chrome への sideload 読込みで代替し、先へ進んでよい。

---

### Task 4: content script `extension/bulk-import.js` ＋ パネル CSS 【Sonnet 推奨】

**Files:**
- Create: `extension/bulk-import.js`
- Create: `extension/bulk-import.css`

**Interfaces:**
- Consumes: Task 1〜3 の全部（lib は **inline 複製**・`booklage:bulk-save`）
- Produces: 対象 3 ページに「IMPORT ALL」パネル（collapsed pill → 展開）。START / PAUSE / RESUME / ✕、進捗行、完了サマリ

- [ ] **Step 1: Implement — `extension/bulk-import.js`（全文）**

```js
// extension/bulk-import.js
// Bulk importer for list pages the user already owns:
//   x.com/i/bookmarks            → every X bookmark
//   youtube.com/playlist?list=WL → Watch later
//   youtube.com/playlist?list=LL → Liked videos
// Two phases: (1) step-scroll the page and harvest items incrementally
// (X virtualizes its timeline — items leave the DOM, so we harvest every
// step), then (2) save oldest-first through booklage:bulk-save, one item
// at a time with a fixed interval = natural rate limiting for the save
// bridge and the tweet-syndication backfill behind it.
//
// NOTE: keep the harvest/run helpers below in sync with
// extension/lib/bulk-harvest.js and extension/lib/bulk-run.js (source of
// truth for unit tests — content scripts cannot import).

const SAVE_INTERVAL_MS = 250
const SCROLL_SETTLE_MS = 1200
const SCROLL_IDLE_ROUNDS = 3
const PERSIST_EVERY_MS = 1000
const STORAGE_KEY_PREFIX = 'bulkImportRun:'

function isExtensionAlive() {
  try { return !!(chrome && chrome.runtime && chrome.runtime.id) } catch (_) { return false }
}

// === Mirror snapshot（twitter.js と同じ型・NOTE: keep in sync） ===
const savedUrlMirror = new Set()
function refreshMirrorSnapshot(mirror) {
  savedUrlMirror.clear()
  if (!mirror) return
  for (const k of Object.keys(mirror)) savedUrlMirror.add(k)
}
if (isExtensionAlive()) {
  try {
    chrome.storage.local.get({ savedUrlsMirror: {} }).then((stored) => {
      refreshMirrorSnapshot(stored.savedUrlsMirror)
    }).catch(() => {})
  } catch (_) {}
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.savedUrlsMirror) return
      refreshMirrorSnapshot(changes.savedUrlsMirror.newValue)
    })
  } catch (_) {}
}

// === lib/bulk-harvest.js の inline 複製（NOTE: keep in sync） ===
function detectBulkPage(href) {
  let u
  try { u = new URL(href) } catch (_) { return null }
  const host = u.hostname.toLowerCase()
  if ((host === 'x.com' || host === 'twitter.com') && u.pathname === '/i/bookmarks') {
    return { site: 'x-bookmarks' }
  }
  if ((host === 'www.youtube.com' || host === 'm.youtube.com') && u.pathname === '/playlist') {
    const list = u.searchParams.get('list')
    if (list === 'WL') return { site: 'yt-wl' }
    if (list === 'LL') return { site: 'yt-ll' }
  }
  return null
}

function canonicalWatchUrl(href) {
  let u
  try { u = new URL(href, 'https://www.youtube.com') } catch (_) { return null }
  if (u.pathname !== '/watch') return null
  const v = u.searchParams.get('v')
  if (!v) return null
  return 'https://www.youtube.com/watch?v=' + v
}

function harvestXBookmarks(root) {
  const out = []
  const articles = root.querySelectorAll('article[data-testid="tweet"]')
  for (const article of articles) {
    const timeEl = article.querySelector('a[href*="/status/"] time')
    const link = timeEl ? timeEl.closest('a') : null
    const href = link ? link.getAttribute('href') : null
    if (!href) continue
    let url
    try { url = new URL(href, 'https://x.com').href } catch (_) { continue }
    const textEl = article.querySelector('[data-testid="tweetText"]')
    const text = (textEl && textEl.innerText ? textEl.innerText : '').trim()
    const userNameEl = article.querySelector('[data-testid="User-Name"]')
    const userNameRaw = userNameEl && userNameEl.innerText ? userNameEl.innerText : ''
    const userName = userNameRaw.split('\n')[0].trim()
    let image = ''
    const mediaImg = article.querySelector('img[src*="pbs.twimg.com/media"]')
    if (mediaImg) image = mediaImg.getAttribute('src') || ''
    if (!image) {
      const videoEl = article.querySelector('video[poster]')
      if (videoEl) image = videoEl.getAttribute('poster') || ''
    }
    if (!image) {
      const ampImg = article.querySelector('img[src*="amplify_video_thumb"], img[src*="ext_tw_video_thumb"]')
      if (ampImg) image = ampImg.getAttribute('src') || ''
    }
    const title = userName && text ? userName + ': ' + text : (text || userName || url)
    out.push({ url, title, description: text.slice(0, 200), image, favicon: 'https://abs.twimg.com/favicons/twitter.3.ico', siteName: 'X' })
  }
  return out
}

function harvestYtPlaylist(root) {
  const out = []
  const tiles = root.querySelectorAll('ytd-playlist-video-renderer')
  for (const tile of tiles) {
    const a = tile.querySelector('a#video-title')
    const href = a ? a.getAttribute('href') : null
    const url = href ? canonicalWatchUrl(href) : null
    if (!url) continue
    const videoId = url.slice(url.indexOf('v=') + 2)
    const title = (a.textContent || '').trim() || url
    out.push({ url, title, description: '', image: 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg', favicon: 'https://www.youtube.com/favicon.ico', siteName: 'YouTube' })
  }
  return out
}

// === lib/bulk-run.js の inline 複製（NOTE: keep in sync） ===
function createRun(site) {
  return { site, scrollDone: false, order: [], items: {} }
}
function addHarvested(run, items) {
  let added = 0
  for (const payload of items) {
    if (!payload || typeof payload.url !== 'string' || !payload.url) continue
    if (run.items[payload.url]) continue
    run.items[payload.url] = { payload, state: 'pending' }
    run.order.push(payload.url)
    added++
  }
  return added
}
function nextPendingUrl(run) {
  for (let i = run.order.length - 1; i >= 0; i--) {
    const url = run.order[i]
    if (run.items[url] && run.items[url].state === 'pending') return url
  }
  return null
}
function markOutcome(run, url, outcome) {
  const entry = run.items[url]
  if (!entry) return
  if (outcome === 'saved' || outcome === 'duplicate' || outcome === 'error') entry.state = outcome
}
function summarize(run) {
  const s = { found: run.order.length, saved: 0, duplicate: 0, error: 0, pending: 0 }
  for (const url of run.order) {
    const st = run.items[url].state
    if (st === 'saved') s.saved++
    else if (st === 'duplicate') s.duplicate++
    else if (st === 'error') s.error++
    else s.pending++
  }
  return s
}
function isFinished(run) {
  return run.scrollDone === true && nextPendingUrl(run) === null
}

// === Engine ===
let panel = null
let run = null
let running = false
let currentSite = null
let lastPersist = 0

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function storageKey(site) {
  return STORAGE_KEY_PREFIX + site
}

async function persistRun(force) {
  if (!run || !isExtensionAlive()) return
  const now = Date.now()
  if (!force && now - lastPersist < PERSIST_EVERY_MS) return
  lastPersist = now
  try { await chrome.storage.local.set({ [storageKey(run.site)]: run }) } catch (_) {}
}

async function loadPersistedRun(site) {
  if (!isExtensionAlive()) return null
  try {
    const stored = await chrome.storage.local.get(storageKey(site))
    return stored[storageKey(site)] || null
  } catch (_) { return null }
}

async function clearPersistedRun(site) {
  if (!isExtensionAlive()) return
  try { await chrome.storage.local.remove(storageKey(site)) } catch (_) {}
}

function harvestNow() {
  const items = currentSite === 'x-bookmarks' ? harvestXBookmarks(document) : harvestYtPlaylist(document)
  return addHarvested(run, items)
}

async function scrollPhase() {
  let idleRounds = 0
  while (running && idleRounds < SCROLL_IDLE_ROUNDS) {
    const added = harvestNow()
    renderProgress()
    await persistRun(false)
    const se = document.scrollingElement
    const beforeHeight = se ? se.scrollHeight : 0
    window.scrollBy(0, Math.round(window.innerHeight * 0.9))
    await sleep(SCROLL_SETTLE_MS)
    const afterHeight = se ? se.scrollHeight : 0
    const atBottom = se ? window.scrollY + window.innerHeight >= se.scrollHeight - 2 : true
    if (added === 0 && afterHeight <= beforeHeight && atBottom) idleRounds++
    else idleRounds = 0
  }
  if (!running) return
  harvestNow()
  run.scrollDone = true
  await persistRun(true)
}

async function savePhase() {
  while (running) {
    const url = nextPendingUrl(run)
    if (url === null) break
    const entry = run.items[url]
    if (savedUrlMirror.has(url)) {
      markOutcome(run, url, 'duplicate')
      renderProgress()
      await persistRun(false)
      continue
    }
    let outcome = 'error'
    if (isExtensionAlive()) {
      try {
        const res = await chrome.runtime.sendMessage({ type: 'booklage:bulk-save', ogp: entry.payload })
        if (res && (res.outcome === 'saved' || res.outcome === 'duplicate' || res.outcome === 'error')) outcome = res.outcome
      } catch (_) { outcome = 'error' }
    }
    markOutcome(run, url, outcome)
    renderProgress()
    await persistRun(false)
    await sleep(SAVE_INTERVAL_MS)
  }
  await persistRun(true)
}

async function startEngine() {
  if (running) return
  running = true
  renderProgress()
  if (!run.scrollDone) await scrollPhase()
  if (running && run.scrollDone) await savePhase()
  running = false
  if (run && isFinished(run)) {
    renderProgress()
    await clearPersistedRun(run.site) // 完了した run は消す（次回はまっさらから）
  } else {
    renderProgress() // paused
  }
}

function pauseEngine() {
  running = false
}

// === Panel UI（英語リテラル・拡張の既存慣行） ===
const SITE_TITLES = {
  'x-bookmarks': 'IMPORT X BOOKMARKS',
  'yt-wl': 'IMPORT WATCH LATER',
  'yt-ll': 'IMPORT LIKED VIDEOS',
}

function renderProgress() {
  if (!panel || !run) return
  const s = summarize(run)
  const status = panel.querySelector('[data-bulk-status]')
  const actions = panel.querySelector('[data-bulk-actions]')
  const phase = !run.scrollDone
    ? (running ? 'SCANNING PAGE…' : (s.found > 0 ? 'PAUSED (SCAN)' : 'READY'))
    : (s.pending > 0 ? (running ? 'SAVING…' : 'PAUSED (SAVE)') : (s.found === 0 ? 'NOTHING FOUND — ARE YOU LOGGED IN?' : 'DONE'))
  status.textContent = phase + '\nFOUND ' + s.found + ' — SAVED ' + s.saved + ' — ALREADY IN ALLMARKS ' + s.duplicate + (s.error > 0 ? ' — FAILED ' + s.error : '')
  const finished = run.scrollDone && s.pending === 0
  actions.innerHTML = ''
  if (running) {
    actions.appendChild(makeButton('PAUSE', () => { pauseEngine(); renderProgress() }))
  } else if (finished) {
    actions.appendChild(makeButton(s.found === 0 ? 'RESCAN' : 'IMPORT AGAIN', () => { run = createRun(currentSite); void startEngine() }))
  } else if (s.found > 0 || run.scrollDone) {
    actions.appendChild(makeButton('RESUME', () => { void startEngine() }))
  } else {
    actions.appendChild(makeButton('START', () => { void startEngine() }))
  }
}

function makeButton(label, onClick) {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'bulk-import-btn'
  b.textContent = label
  b.addEventListener('click', onClick)
  return b
}

function buildPanel() {
  const el = document.createElement('div')
  el.id = 'booklage-bulk-import'
  el.innerHTML =
    '<div class="bulk-import-head">' +
    '<span data-bulk-title></span>' +
    '<button type="button" class="bulk-import-close" title="Hide">×</button>' +
    '</div>' +
    '<div class="bulk-import-status" data-bulk-status>READY</div>' +
    '<div class="bulk-import-actions" data-bulk-actions></div>'
  el.querySelector('.bulk-import-close').addEventListener('click', () => {
    pauseEngine()
    el.remove()
    panel = null
  })
  document.documentElement.appendChild(el)
  return el
}

async function mountForSite(site) {
  currentSite = site
  const persisted = await loadPersistedRun(site)
  run = persisted && persisted.site === site ? persisted : createRun(site)
  if (!panel) panel = buildPanel()
  panel.querySelector('[data-bulk-title]').textContent = SITE_TITLES[site] || 'IMPORT ALL'
  renderProgress()
}

function unmount() {
  pauseEngine()
  if (panel) { panel.remove(); panel = null }
  run = null
  currentSite = null
}

// === SPA ナビ追従（1s ポーリング。floating-button.js が polling-only を選んだ理由と同じ:
//     webNavigation 権限の「閲覧履歴を読む」プロンプトを避ける） ===
let lastHref = ''
function checkPage() {
  if (location.href === lastHref) return
  lastHref = location.href
  const page = detectBulkPage(location.href)
  if (page && page.site !== currentSite) {
    unmount()
    void mountForSite(page.site)
  } else if (!page && currentSite) {
    unmount()
  }
}
checkPage()
setInterval(checkPage, 1000)
```

- [ ] **Step 2: Implement — `extension/bulk-import.css`（全文）**

```css
/* Bulk importer panel — dark, quiet, out of the page's way. Bottom-LEFT so it
   never collides with the AllMarks floating save button (bottom-right). */
#booklage-bulk-import {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 2147483600;
  width: 300px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(14, 14, 17, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.92);
  font: 500 11px/1.5 ui-monospace, 'SF Mono', 'Cascadia Mono', Consolas, monospace;
  letter-spacing: 0.04em;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
}

#booklage-bulk-import .bulk-import-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 700;
  margin-bottom: 6px;
}

#booklage-bulk-import .bulk-import-close {
  all: unset;
  cursor: pointer;
  width: 32px;
  height: 32px;
  text-align: center;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
}
#booklage-bulk-import .bulk-import-close:hover { color: #fff; }

#booklage-bulk-import .bulk-import-status {
  white-space: pre-line;
  color: rgba(255, 255, 255, 0.72);
  margin-bottom: 10px;
}

#booklage-bulk-import .bulk-import-actions { display: flex; gap: 8px; }

#booklage-bulk-import .bulk-import-btn {
  all: unset;
  cursor: pointer;
  flex: 1;
  height: 36px;
  text-align: center;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-weight: 700;
  letter-spacing: 0.08em;
}
#booklage-bulk-import .bulk-import-btn:hover { background: rgba(255, 255, 255, 0.18); }
```

- [ ] **Step 3: 構文検査**

```bash
node --check extension/bulk-import.js
```

Expected: 出力なし（エラーなし）。

- [ ] **Step 4: Commit**

```bash
rtk git add extension/bulk-import.js extension/bulk-import.css
rtk git commit -m "feat(extension): bulk-import content script — scan + queue + progress + resume panel"
```

---

### Task 5: manifest 追加・version 0.1.25・package 必須ファイル 【Haiku 可】

**Files:**
- Modify: `extension/manifest.json`
- Modify: `scripts/package-extension.mjs`

- [ ] **Step 1: manifest**

1. `"version": "0.1.24"` → `"version": "0.1.25"`
2. content_scripts の **X ブロック**（matches に `https://x.com/*` を含むブロック）の `"js"` 配列に `"bulk-import.js"` を追加し、`"css"` 配列（無ければ新設）に `"bulk-import.css"` を追加
3. content_scripts の **YouTube ブロック**（matches に `https://www.youtube.com/*` を含むブロック）にも同様に追加

※ `bulk-import.js` は URL ゲート（`detectBulkPage`）を持つので、`x.com/*` 全域に注入されても対象 3 ページ以外では 1 秒ポーリング以外何もしない。

- [ ] **Step 2: package スクリプトの存在チェック**

`scripts/package-extension.mjs` の `required` 配列に `'bulk-import.js'` と `'bulk-import.css'` を追加。

- [ ] **Step 3: 検証 → Commit**

```bash
rtk vitest run
pnpm package:extension
rtk git add extension/manifest.json scripts/package-extension.mjs
rtk git commit -m "chore(extension): register bulk-import content script, bump to 0.1.25"
```

Expected: vitest 全緑 / `dist/booklage-extension-0.1.25.zip` 生成（200KB 警告が出ないこと）。

---

### Task 6: 実ブラウザ検証（sideload・ユーザー協働） 【Sonnet 推奨＋ユーザー実操作】

- [ ] **Step 1: sideload 手順をユーザーに渡す（コピペ）**

```
1. chrome://extensions を開く → デベロッパーモード ON → 「パッケージ化されていない拡張機能を読み込む」
   → リポジトリの extension/ フォルダを選ぶ（既に読み込み済みなら 🔄 更新ボタン）
2. https://x.com/i/bookmarks を開く → 左下に「IMPORT X BOOKMARKS」パネルが出るか
3. START → 画面がひとりでに下へスクロールし FOUND が増えるか
   → スキャン後 SAVED が増え始めるか（1 秒に 3〜4 件ペース）
4. 途中で PAUSE → タブを閉じる → もう一度開く → RESUME で続きから再開するか
5. 完了後 https://allmarks.app をハードリロード → 取り込んだツイートがカードになっているか
   （画像つきツイートのサムネ・本文。保存直後は数枚が後追いで画像に差し替わるのは正常＝syndication 補完）
6. https://www.youtube.com/playlist?list=WL と ?list=LL でも 2〜5 を確認
7. すでに保存済みだったものは ALREADY IN ALLMARKS に数えられ、重複カードが増えていないこと
```

- [ ] **Step 2: 結果の記録** — 件数（FOUND/SAVED/ALREADY/FAILED）と所要時間を TODO.md の BULK-IMPORT 節に記録。FAILED が 1% を超えるようなら原因（DOM 変化 / offscreen timeout）を切り分けてから次へ。

- [ ] **Step 3: ストア提出はしない** — 再審査は N-28（Pinterest・実 DOM ダンプから）/ N-29（options 導線）とまとめて 1 回（ロードマップ §4）。`docs/extension-store-submission.md` の権限正当化に「一括取り込み（本人の一覧ページを本人のブラウザで読む）」の 1 段落を足すのはその束のときにやる。

---

## Self-Review 済みの注意点（実装者へ）

- **アプリ側のコードは 1 行も変えない**。保存の着地・重複排除・ツイートの syndication 補完は全部既存のまま。一括の負荷制御は「1 件 await ＋ 250ms」の直列ポンプが担う（offscreen は単一共有コンテキストなので並列に投げない）。
- **`dispatchBulkSave` は `offscreenInFlight` の increment/decrement を必ず dispatchSave と同じ位置（ensureOffscreen の前 / finally）で行う**。守らないと並行中の通常保存の offscreen が足元から閉じられる（rank13 回帰）。
- **X の一覧は仮想化されている**（Task 0 のダンプで確認する想定）: 一気に最下部へ飛ばず viewport の 0.9 倍ずつスクロールする。飛ばすと中間の項目が一度も DOM に現れず取りこぼす。
- **収穫 URL は canonical 形**（tweet: クエリなし・YouTube: `v=` のみ）。`per-site-mirror-invariant.test.ts` に追加した 2 形が normalize-安定の砦。
- 一覧ページの `article[data-testid="tweet"]` には**引用ツイート内の status リンクも入り得る**が、permalink は `<time>` を包む `<a>` に限定しているので引用先を誤収穫しない（twitter.js と同じ防御）。
- YouTube のサムネは `i.ytimg.com/vi/<id>/hqdefault.jpg` を**導出**する（タイル `<img>` は lazy-load で空が多い）。hqdefault はどの動画にも存在する（maxres は無いことがある）。
- RESUME の再スキャンは重複排除（`addHarvested`）があるので安全。スキャン途中で中断した run の再開はスキャンからやり直すが、既収穫分は数え直さない。
- パネルは**左下**（フローティング保存ボタンが右側のため）。z-index はページ何より上（2147483600）だが、パネル以外の DOM・イベントには一切触らない。
- 大量 run の storage.local サイズ: 1 件 ≈ 300B（title 全文込み）× 5000 件 ≈ 1.5MB → 10MB クォータ内。50000 件級はミラーの MAX と同格なので想定外（そのときは savePhase 完了分から `items` を間引く改修を検討）。
- 第2弾（note スキ / Vimeo likes / SoundCloud likes）は `detectBulkPage` に URL を、`harvest*` にアダプタを 1 つずつ足すだけの構造になっている。**必ずそのサイトの実 DOM ダンプから**（この計画の Task 0 をテンプレにする）。
