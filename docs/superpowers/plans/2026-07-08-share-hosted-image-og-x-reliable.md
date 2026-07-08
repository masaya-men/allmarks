# 共有画像の一時保管（画像＋リンク・X 確実表示）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** ユーザーが撮った手動スクショを共有リンクに載せ、`/s/<id>` のプレビューが本物のコラージュ画像になる（X でも確実に表示）ようにする。

**Architecture:** 保管路（`create.ts` → KV+R2 SHARE_OG）は無改造。新規は (a) 非 `/api/` の静的風 OG 配信ルート `/og/<id>`（200 直接・無リダイレクト）、(b) `patch-share-html` の OG 画像向き先変更、(c) ユーザー画像を 1200×630 JPEG data-URL に正規化する純関数、(d) アレンジモードの貼付/ドロップ受け口＋作成＋アクション（COPY LINK / POST TO X / Web Share）＋キャッシュ温め。

**Tech Stack:** Cloudflare Pages Functions (TS), Next static export, React 'use client', vitest, Playwright。R2 binding `SHARE_OG`、KV `SHARE_KV`。

## Global Constraints

- 金額表記なし機能（該当なし）。UI テキストは globally-clear English（[feedback_globally_clear_english]）。
- **UI の見た目変更は実装前にユーザー承認**（`.claude/rules/ui-design.md`）→ Task 6 は実装直前にデザインを prose で提示し合意。
- TypeScript strict / `any` 禁止 / return type 明示 / Vanilla CSS module。
- `content.js` 等は tsc 外なので該当時 `node --check`（本 plan では該当なし）。
- OG 画像は **1200×630**（declared meta と一致）、JPEG、`Content-Type: image/jpeg`。
- 新 OG ルートは **絶対にリダイレクトしない**（常に 200 バイト直接）。`Cache-Control: public, max-age=31536000, immutable`。
- `createShare` の thumb 正規表現：`^data:image/(jpeg|webp);base64,(.+)$`（[create.ts]）。正規化出力は必ずこれに適合。
- デプロイは `pnpm build` → `wrangler pages deploy out/ --project-name=allmarks --branch=master`。

---

### Task 1: 非 `/api/` OG 配信ルート `/og/<id>`（200 直接・無リダイレクト）

**Files:**
- Create: `functions/og/[id].ts`
- Test: `functions/og/[id].test.ts`

**Interfaces:**
- Produces: `onRequestGet(ctx: { request: Request; env: { SHARE_OG: R2Bucket; ASSETS: Fetcher }; params: { id: string } }): Promise<Response>`
- Consumes: `isValidShareId` from `lib/share/kv-id.ts`（`/^[A-Za-z0-9]{6}$/`）。

**Behavior:**
- `id` から末尾 `.jpg`/`.jpeg`/`.png` があれば剥がす → `isValidShareId` 検証（不正なら 404）。
- `SHARE_OG.get(id)` ヒット → 200・`Content-Type = httpMetadata.contentType ?? 'image/jpeg'`・immutable cache。
- ミス → **`ASSETS.fetch(new URL('/og.png', request.url))` の bytes を 200 で返す**（リダイレクトしない）。取得失敗時は 200 で 1x1 透明 GIF or 既定 bytes（フォールバックの最終手段）。実際は og.png は必ず存在するので通常ミス時も 200。

- [ ] **Step 1: 失敗するテストを書く** — `functions/og/[id].test.ts`

```ts
import { describe, it, expect, vi } from 'vitest'
import { onRequestGet } from './[id]'

function makeCtx(id: string, r2Obj: { arrayBuffer: () => Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null, assetsBody = 'DEFAULT') {
  return {
    request: new Request(`https://allmarks.app/og/${id}`),
    env: {
      SHARE_OG: { get: vi.fn().mockResolvedValue(r2Obj) },
      ASSETS: { fetch: vi.fn().mockResolvedValue(new Response(assetsBody, { status: 200, headers: { 'Content-Type': 'image/png' } })) },
    },
    params: { id },
  } as unknown as Parameters<typeof onRequestGet>[0]
}

describe('GET /og/<id>', () => {
  it('serves R2 image bytes at 200 (no redirect)', async () => {
    const bytes = new TextEncoder().encode('IMGBYTES').buffer
    const res = await onRequestGet(makeCtx('abc123', { arrayBuffer: async () => bytes, httpMetadata: { contentType: 'image/jpeg' } }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(res.headers.get('Cache-Control')).toContain('immutable')
    expect(await res.text()).toBe('IMGBYTES')
  })
  it('strips a .jpg extension before validating the id', async () => {
    const bytes = new TextEncoder().encode('X').buffer
    const ctx = makeCtx('abc123.jpg', { arrayBuffer: async () => bytes })
    // params.id carries the extension; the route must strip it and still hit R2 with 'abc123'
    const res = await onRequestGet({ ...ctx, params: { id: 'abc123.jpg' } } as typeof ctx)
    expect(res.status).toBe(200)
  })
  it('on R2 miss serves default og.png bytes at 200 — NEVER a redirect', async () => {
    const res = await onRequestGet(makeCtx('abc123', null, 'DEFAULTPNG'))
    expect(res.status).toBe(200) // not 301/302
    expect([301, 302, 307, 308]).not.toContain(res.status)
    expect(await res.text()).toBe('DEFAULTPNG')
  })
  it('404 for an invalid id', async () => {
    const res = await onRequestGet(makeCtx('!!', null))
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: 失敗確認** — `rtk vitest run functions/og` → FAIL（module not found）
- [ ] **Step 3: 実装** — `functions/og/[id].ts`（`functions/api/share/[id]/og.ts` の R2 分岐を土台に、ミス時を 302 → `ASSETS.fetch('/og.png')` の 200 直接に置換。KV thumb 後方互換は不要＝30日TTLで旧データ消滅済）。R2/Fetcher の最小 interface をローカル宣言（既存 og.ts に倣う）。
- [ ] **Step 4: 通過確認** — `rtk vitest run functions/og` → PASS
- [ ] **Step 5: commit** — `rtk git add functions/og && rtk git commit -m "feat(share): direct-200 /og/<id> OG route (non-/api, no redirect)"`

---

### Task 2: `patch-share-html` の OG 画像を `/og/<id>.jpg` に向け直す

**Files:**
- Modify: `functions/s/patch-share-html.ts:42,69-72`
- Modify: `functions/s/patch-share-html.test.ts`
- Check (no change expected): `scripts/assert-share-template.mjs`（REQUIRED_ANCHORS は不変。og:type 注入・head 等は据え置き）

**Behavior:** `ogImage = ${baseUrl}/og/${id}.jpg`（旧 `/api/share/${id}/og` から変更）。`og:image:height` を `628` → `630`。og:image は依然 1個だけ（既存 strip ロジック維持）。

- [ ] **Step 1: テスト更新（RED）** — 既存テストの期待値を新 URL に：
```ts
expect(out).toContain('property="og:image" content="https://booklage.pages.dev/og/k3p9xv.jpg"')
expect(out).toMatch(/<meta\s+name="twitter:image"\s+content="https:\/\/booklage\.pages\.dev\/og\/k3p9xv\.jpg"/)
// 単一 og:image ガード（B3）と height=630 も確認
expect(out).toContain('property="og:image:height" content="630"')
```
- [ ] **Step 2: 失敗確認** — `rtk vitest run functions/s/patch-share-html` → FAIL
- [ ] **Step 3: 実装** — `ogImage` を `${baseUrl}/og/${id}.jpg` に、height を 630 に変更。
- [ ] **Step 4: 通過確認** — `rtk vitest run functions/s/patch-share-html` → PASS。加えて `node scripts/assert-share-template.mjs`（out/ 未生成なら build 時に走るので skip 可）。
- [ ] **Step 5: commit** — `rtk git commit -am "feat(share): point og:image/twitter:image at /og/<id>.jpg (LoPo X recipe)"`

---

### Task 3: 画像正規化 純関数 `lib/share/normalize-shot.ts`

**Files:**
- Create: `lib/share/normalize-shot.ts`
- Test: `lib/share/normalize-shot.test.ts`

**Interfaces:**
- Produces:
  - `computeCoverRect(srcW: number, srcH: number, dstW: number, dstH: number): { sx: number; sy: number; sw: number; sh: number }` — src からの cover 切り出し矩形（純・テスト対象の中核）。
  - `normalizeShotToJpegDataUrl(source: Blob | HTMLImageElement, opts?: { width?: number; height?: number; targetBytes?: number; startQuality?: number; minQuality?: number }): Promise<string | null>` — 1200×630 に cover 描画 → JPEG data-URL。canvas 不能環境（jsdom）や汚染時は `null`。既定 width=1200,height=630,targetBytes=180*1024,startQuality=0.85,minQuality=0.4。
- Consumes: `canvasToJpegUnderTarget`（[capture-mirror.ts]。export されていれば再利用、無ければ本ファイルに同等の品質降下ループを内包）。

- [ ] **Step 1: テスト（RED）**
```ts
import { describe, it, expect } from 'vitest'
import { computeCoverRect } from './normalize-shot'
describe('computeCoverRect', () => {
  it('wider-than-target source crops left/right, keeps full height', () => {
    const r = computeCoverRect(2000, 1000, 1200, 630) // src 2:1, dst ~1.905:1 → src is taller-ratio? 2.0>1.905 → crop width
    expect(r.sh).toBe(1000)
    expect(r.sw).toBeCloseTo(1000 * (1200 / 630), 1)
    expect(r.sy).toBe(0)
    expect(r.sx).toBeCloseTo((2000 - r.sw) / 2, 1)
  })
  it('taller-than-target source crops top/bottom, keeps full width', () => {
    const r = computeCoverRect(1200, 1200, 1200, 630) // src 1:1 < 1.905 → crop height
    expect(r.sw).toBe(1200)
    expect(r.sh).toBeCloseTo(1200 * (630 / 1200), 1)
    expect(r.sx).toBe(0)
    expect(r.sy).toBeCloseTo((1200 - r.sh) / 2, 1)
  })
  it('exact-ratio source is uncropped', () => {
    const r = computeCoverRect(1200, 630, 1200, 630)
    expect(r).toEqual({ sx: 0, sy: 0, sw: 1200, sh: 630 })
  })
})
```
- [ ] **Step 2: 失敗確認** — `rtk vitest run lib/share/normalize-shot` → FAIL
- [ ] **Step 3: 実装** — `computeCoverRect`（ratio 比較で長辺方向を切る）＋ `normalizeShotToJpegDataUrl`（`document.createElement('canvas')` を try、無ければ null；`drawImage(img, sx,sy,sw,sh, 0,0,1200,630)`；`canvasToJpegUnderTarget` で圧縮）。Blob 入力は `createImageBitmap`/`<img>.decode()` で読み込み。
- [ ] **Step 4: 通過確認** — `rtk vitest run lib/share/normalize-shot` → PASS
- [ ] **Step 5: commit** — `rtk git commit -am "feat(share): normalize-shot (user screenshot → 1200x630 JPEG data-url)"`

---

### Task 4: 作成＋温め 純ヘルパー `lib/share/create-hosted-share.ts`

**Files:**
- Create: `lib/share/create-hosted-share.ts`
- Test: `lib/share/create-hosted-share.test.ts`

**Interfaces:**
- Produces:
  - `createHostedShare(deps: { buildShare: () => ShareDataV2; thumb?: string; createShare: (e: { share: ShareDataV2; thumb?: string }) => Promise<ApiResult<CreateShareResponse>>; origin: string; warm?: (url: string) => void }): Promise<{ ok: true; url: string; ogUrl: string } | { ok: false; message: string }>`
  - 動作：buildShare（throw は ok:false 化）→ `createShare({ share, thumb })` → `url = ${origin}/s/<id>`、`ogUrl = ${origin}/og/<id>.jpg` → `warm?.(ogUrl)` を fire-and-forget 実行 → 返す。
- Consumes: `ApiResult`（api-client）、`ShareDataV2`/`CreateShareResponse`（types-v2）。

- [ ] **Step 1: テスト（RED）**
```ts
import { describe, it, expect, vi } from 'vitest'
import { createHostedShare } from './create-hosted-share'
const share = { v: 2, cards: [], createdAt: 0 } as any
it('creates with thumb, returns /s and /og urls, warms the og url', async () => {
  const createShare = vi.fn().mockResolvedValue({ ok: true, data: { id: 'k3p9xv', expiresAt: 1 } })
  const warm = vi.fn()
  const r = await createHostedShare({ buildShare: () => share, thumb: 'data:image/jpeg;base64,AAAA', createShare, origin: 'https://allmarks.app', warm })
  expect(createShare).toHaveBeenCalledWith({ share, thumb: 'data:image/jpeg;base64,AAAA' })
  expect(r).toEqual({ ok: true, url: 'https://allmarks.app/s/k3p9xv', ogUrl: 'https://allmarks.app/og/k3p9xv.jpg' })
  expect(warm).toHaveBeenCalledWith('https://allmarks.app/og/k3p9xv.jpg')
})
it('surfaces a buildShare throw as ok:false', async () => {
  const r = await createHostedShare({ buildShare: () => { throw new Error('boom') }, createShare: vi.fn(), origin: 'x' })
  expect(r).toEqual({ ok: false, message: 'boom' })
})
it('surfaces a createShare failure', async () => {
  const createShare = vi.fn().mockResolvedValue({ ok: false, error: 'server', message: 'too big' })
  const r = await createHostedShare({ buildShare: () => share, createShare, origin: 'x' })
  expect(r).toEqual({ ok: false, message: 'too big' })
})
```
- [ ] **Step 2: 失敗確認** — `rtk vitest run lib/share/create-hosted-share` → FAIL
- [ ] **Step 3: 実装**（copy-share-link.ts の堅牢化パターンを踏襲）。
- [ ] **Step 4: 通過確認** — PASS
- [ ] **Step 5: commit** — `rtk git commit -am "feat(share): create-hosted-share helper (create + cache-warm)"`

---

### Task 5: Web Share / POST TO X 純ヘルパー `lib/share/share-actions.ts`

**Files:**
- Create: `lib/share/share-actions.ts`
- Test: `lib/share/share-actions.test.ts`

**Interfaces:**
- `buildTweetIntentUrl(shareUrl: string, text?: string): string` → `https://twitter.com/intent/tweet?...`（url encode）。
- `dataUrlToFile(dataUrl: string, filename: string): File | null`（正規化 JPEG → File、失敗 null）。
- `canWebShareFiles(nav: Pick<Navigator,'canShare'>, file: File): boolean`。

- [ ] **Step 1: テスト（RED）** — intent URL の encode／dataUrl→File の type=image/jpeg／canShare 判定。
- [ ] **Step 2: 失敗確認** → FAIL
- [ ] **Step 3: 実装**（SenderShareModal の intent/`<a download>` パターンを純化して移植）。
- [ ] **Step 4: 通過確認** → PASS
- [ ] **Step 5: commit** — `rtk git commit -am "feat(share): share-actions (tweet intent + web-share file helpers)"`

---

### Task 6: アレンジモードの受け口 UI ＋ アクション（★実装前にデザイン合意）

> `.claude/rules/ui-design.md` 準拠：**この Task の着手前に、見た目（受け口の見え方・ボタン配置・文言）を prose でユーザーに提示し承認を得る**。既存 `ShareToast` の視覚言語（`secondaryBtn`/`primaryBtn`・`.bar`）を流用し新規の派手要素は作らない方針を提案する。

**Files:**
- Modify: `components/board/ShareToast.tsx`（props 追加：`hasImage`, `onPasteImage`(内部で paste/drop 受理), `onCreate`, `createState`, `shareUrl`, `onPostToX`, `onWebShare?`）
- Modify: `components/board/ShareToast.module.css`（受け口＋新ボタンの最小スタイル）
- Test: `components/board/ShareToast.test.tsx`（追加ケース）

**Behavior（承認後に確定）:**
- 画像未添付：hint「①こう撮る → ②ここに貼る(Ctrl+V)/ドロップ」。ペースト/ドロップで画像を受理 → `hasImage=true`。
- 画像添付済：`CREATE LINK` primary が有効。押下→`onCreate`（作成中はラベル `CREATING…`）。
- 作成後（`shareUrl` あり）：`COPY LINK` / `POST TO X` / （対応時）`SHARE`（Web Share）表示。
- 画像なしでも `COPY LINK` は従来どおり可（§C4）。

- [ ] **Step 0: デザイン提示＋承認**（prose）。
- [ ] **Step 1: テスト（RED）** — hasImage=false で CREATE 無効・true で有効／shareUrl 有りで POST TO X 出現／paste イベントで onPasteImage 発火。
- [ ] **Step 2: 失敗確認** → FAIL
- [ ] **Step 3: 実装**（承認済みデザインで）。
- [ ] **Step 4: 通過確認** → PASS
- [ ] **Step 5: commit** — `rtk git commit -am "feat(share): arrange-mode screenshot intake + hosted-share actions UI"`

---

### Task 7: BoardRoot 配線

**Files:**
- Modify: `components/board/BoardRoot.tsx`（arrange 描画部 3155-3183 付近／`handleCopyShareLink` 2282-2311 付近）

**Behavior:**
- state：`shotDataUrl: string | null`（正規化済み JPEG）、`hostedShareUrl: string | null`、`createState`。
- paste/drop 受理 → `normalizeShotToJpegDataUrl` → `setShotDataUrl`。
- `onCreate` → `createHostedShare({ buildShare: <既存 handleCopyShareLink と同じ buildShareDataFromBoard>, thumb: shotDataUrl ?? undefined, createShare, origin, warm: (u)=>{ void fetch(u).catch(()=>{}) } })` → `setHostedShareUrl(url)`。
- `onPostToX` → `window.open(buildTweetIntentUrl(url), '_blank', 'noopener,noreferrer')`。
- `onWebShare` → `dataUrlToFile` → `navigator.share({ files:[file], url })`。
- arrange 退出（DONE/RESELECT/Esc）で state リセット。
- **既存 COPY LINK 経路（copyShareLink）は温存**（画像なし時のフォールバック）。

- [ ] **Step 1:** 既存 `handleCopyShareLink` の `buildShareDataFromBoard` 呼び出しを実測して同じ builder を共有（読取確認）。
- [ ] **Step 2:** 配線実装（型明示・any 禁止）。
- [ ] **Step 3:** `rtk tsc` → 0 errors。
- [ ] **Step 4: commit** — `rtk git commit -am "feat(share): wire screenshot intake → hosted-share create + actions in BoardRoot"`

---

### Task 8: 統合検証 ＋ デプロイ ＋ ルーティング実機確認

- [ ] **Step 1:** `rtk tsc`（0）／`rtk vitest run`（全緑・件数記録）。
- [ ] **Step 2:** クリーンビルド `rm -rf .next out && rtk pnpm build`（`assert-share-template.mjs` が通ること＝OG アンカー健在）。
- [ ] **Step 3: Playwright（out/ ローカル）** — アレンジ到達（[reference_playwright_board_share_verify]：IDB 事前投入→SELECT ALL→ARRANGE）→ `paste` イベントでテスト画像注入 → CREATE → URL 取得。
- [ ] **Step 4: デプロイ** — `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`。
- [ ] **Step 5: ★ルーティング実機確認（.webp scar 対策）** — `curl -sI https://allmarks.app/og/<既存id>.jpg` が **200 image/jpeg**（Next 404 HTML でない）ことを確認。404 なら patch-share-html/ルートを**無拡張 `/og/<id>`** に退避して再デプロイ。
- [ ] **Step 6: OG メタ実機確認** — `curl -s https://allmarks.app/s/<id> | grep -E 'og:image|twitter:(card|image)'` で `/og/<id>.jpg` と `summary_large_image` を確認。
- [ ] **Step 7:** ユーザーに「実際に X へ1回貼って大きい画像カードが出るか」を依頼（自動不可の最終確認）。

---

## Self-Review

- **Spec coverage:** §3 X recipe→Task1/2/8-Step5、§4.2 C2→Task3、C3→Task4、アクション→Task5、UI→Task6、配線→Task7、C4 フォールバック→Task7 温存、§8 テスト→各Task+Task8。全カバー。
- **Placeholder scan:** Task6 の Behavior は「承認後に確定」だが、これは ui-design.md ルール由来の意図的ゲート（プレースホルダではなく承認待ち）。他に TBD 無し。
- **Type consistency:** `createShare({share, thumb})` は KVShareEntry と一致（api-client）。`createHostedShare` の createShare 引数型と一致。`normalizeShotToJpegDataUrl` 出力（jpeg data-url）は create.ts regex 適合。`/og/<id>.jpg` は Task1 route・Task2 meta・Task8 検証で同一。
