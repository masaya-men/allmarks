# SHARE 手動スクショ仕上げ ＋ COPY LINK（再構成なし）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 配置(arrange)画面の共有体験を「メーター重なり解消・撮る範囲をクリーンに・OS判定の撮り方1行・COPY LINK（画像を一切作らずに `/s` リンクをコピー）」に仕上げる。

**Architecture:** 純ロジックは `lib/` の純関数に切り出して TDD（`shouldShowScrollMeter` / `detectSharePlatform` / `pickScreenshotHint` / `copyShareLink`）。UI は `ShareToast` に hint 文言と COPY LINK ボタンを足すだけ。COPY LINK は選択(`selectedIds`)から `buildShareDataFromBoard` で v2 ペイロードを組み、**thumb 無し**で `createShare` を呼ぶ。サーバーは `create.ts`(thumb 任意化) と `og.ts`(既定OGフォールバック) の小変更2ファイル。**画像の再構成（`captureMirrorToWebP`/`renderShareImage`）は新経路から一切呼ばない。**

**Tech Stack:** Next.js 14 App Router (static export) / TypeScript strict / Vanilla CSS Modules / Cloudflare Pages Functions (KV + R2) / vitest / Playwright。

## Global Constraints

- TypeScript `strict`。`any` 禁止（`unknown` + ガード）。**Return type 常に明示**。
- **Vanilla CSS Modules のみ**（Tailwind 禁止）。z-index は `BOARD_Z_INDEX` 定数。
- **UI ラベル・撮り方文言は globally-clear English**（`DONE`/`RESELECT`/`COPY LINK` と同調・memory `feedback_globally_clear_english`）。i18n(15言語)は本計画スコープ外。
- **画像の再構成は禁止**：新規コードから `captureMirrorToWebP` / `renderShareImage` を呼ばない（決定B・レプリカ完全排除）。
- **配置画面のレイアウトを変えない・全画面化しない**（決定C）。撮影ガイドは既存パネル縁の一瞬のハイライトのみ、永続枠なし。
- **受け取り側 `/s`（SharedBoard）は無変更**。COPY LINK のペイロードは選択カードを**盤面順（新しい順）**＝s157 選択的シェアと同一・`filter: null`。
- デプロイ前ゲート：`rtk tsc && rtk vitest run && rtk pnpm build`。見た目検証前は `rm -rf .next out` でクリーンビルド（Next 増分キャッシュの stale JS 回避）。
- 正本 spec: [docs/superpowers/specs/2026-07-07-share-manual-screenshot-polish-and-copy-link-design.md](../specs/2026-07-07-share-manual-screenshot-polish-and-copy-link-design.md)。

---

## File Structure

| File | 役割 | 種別 |
|------|------|------|
| `lib/board/scroll-meter-visibility.ts` | `shouldShowScrollMeter` 純関数 | 新規 |
| `lib/board/scroll-meter-visibility.test.ts` | 同テスト | 新規 |
| `lib/share/screenshot-hint.ts` | `detectSharePlatform` / `pickScreenshotHint` 純関数 | 新規 |
| `lib/share/screenshot-hint.test.ts` | 同テスト | 新規 |
| `lib/share/copy-share-link.ts` | `copyShareLink` オーケストレータ（DI・再構成なし） | 新規 |
| `lib/share/copy-share-link.test.ts` | 同テスト | 新規 |
| `components/board/ShareToast.tsx` | `hint` prop・COPY LINK ボタン・コピー状態 | 変更 |
| `components/board/ShareToast.module.css` | COPY LINK ボタンの見た目（既存 secondaryBtn 流用可） | 変更 |
| `components/board/ShareToast.test.tsx` | hint 描画・COPY LINK 状態遷移テスト | 変更 |
| `components/board/BoardRoot.tsx` | ScrollMeter 表示条件・hint 算出・`handleCopyShareLink`・edge-glow | 変更 |
| `components/board/BoardRoot.module.css` | arrange edge-glow keyframe（任意・Task 8） | 変更 |
| `functions/api/share/create.ts` | thumb 任意化（無ければ R2 put スキップ） | 変更 |
| `functions/api/share/create.test.ts` | thumb 無し 200・R2 未呼び出しテスト | 変更 |
| `functions/api/share/[id]/og.ts` | thumb 無し → `/og.png` へ 302 | 変更 |
| `functions/api/share/[id]/og.test.ts` | thumb 無し → 302・genuinely-missing → 404 テスト | 変更 |

---

## Task 1: ScrollMeter を arrange で隠す（重なり解消）

**Files:**
- Create: `lib/board/scroll-meter-visibility.ts`
- Test: `lib/board/scroll-meter-visibility.test.ts`
- Modify: `components/board/BoardRoot.tsx:2760`

**Interfaces:**
- Produces: `shouldShowScrollMeter(showOnboarding: boolean, sharePhase: 'select' | 'arrange' | null): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// lib/board/scroll-meter-visibility.test.ts
import { describe, it, expect } from 'vitest'
import { shouldShowScrollMeter } from './scroll-meter-visibility'

describe('shouldShowScrollMeter', () => {
  it('hides while onboarding', () => {
    expect(shouldShowScrollMeter(true, null)).toBe(false)
    expect(shouldShowScrollMeter(true, 'select')).toBe(false)
  })
  it('hides in arrange stage (collage is not scrollable)', () => {
    expect(shouldShowScrollMeter(false, 'arrange')).toBe(false)
  })
  it('shows in select stage (grid still scrolls) and normal board', () => {
    expect(shouldShowScrollMeter(false, 'select')).toBe(true)
    expect(shouldShowScrollMeter(false, null)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run lib/board/scroll-meter-visibility.test.ts`
Expected: FAIL — `shouldShowScrollMeter` is not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/board/scroll-meter-visibility.ts
/** The scroll meter is meaningful only when the board (or select-stage grid) can
 *  scroll. It is hidden during onboarding (the tutorial owns the screen bottom)
 *  and during the arrange stage, where the collage is a fixed, non-scrollable
 *  layout AND the meter (z:400) would otherwise overlap the ShareToast (z:116). */
export function shouldShowScrollMeter(
  showOnboarding: boolean,
  sharePhase: 'select' | 'arrange' | null,
): boolean {
  return !showOnboarding && sharePhase !== 'arrange'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run lib/board/scroll-meter-visibility.test.ts`
Expected: PASS (4 assertions).

- [ ] **Step 5: Wire into BoardRoot**

In `components/board/BoardRoot.tsx`, add the import near the other `@/lib/board/*` imports:

```ts
import { shouldShowScrollMeter } from '@/lib/board/scroll-meter-visibility'
```

Change the ScrollMeter render guard at line ~2760 from:

```tsx
{!showOnboarding && (
  <ScrollMeter
```

to:

```tsx
{shouldShowScrollMeter(showOnboarding, sharePhase) && (
  <ScrollMeter
```

- [ ] **Step 6: Verify tsc + full unit suite**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0 errors; vitest all green (prior count + 4 new).

- [ ] **Step 7: Commit**

```bash
rtk git add lib/board/scroll-meter-visibility.ts lib/board/scroll-meter-visibility.test.ts components/board/BoardRoot.tsx
rtk git commit -m "fix(share): hide scroll meter in arrange stage (overlap fix)"
```

---

## Task 2: 撮り方文言の純関数（OS 判定）

**Files:**
- Create: `lib/share/screenshot-hint.ts`
- Test: `lib/share/screenshot-hint.test.ts`

**Interfaces:**
- Produces:
  - `type SharePlatform = 'windows' | 'mac' | 'mobile' | 'other'`
  - `detectSharePlatform(userAgent: string, uaDataPlatform?: string): SharePlatform`
  - `pickScreenshotHint(platform: SharePlatform): string`

- [ ] **Step 1: Write the failing test**

```ts
// lib/share/screenshot-hint.test.ts
import { describe, it, expect } from 'vitest'
import { detectSharePlatform, pickScreenshotHint } from './screenshot-hint'

describe('detectSharePlatform', () => {
  it('detects windows', () => {
    expect(detectSharePlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows')
    expect(detectSharePlatform('irrelevant', 'Windows')).toBe('windows')
  })
  it('detects mac', () => {
    expect(detectSharePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('mac')
    expect(detectSharePlatform('irrelevant', 'macOS')).toBe('mac')
  })
  it('detects mobile before desktop os tokens', () => {
    expect(detectSharePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('mobile')
    expect(detectSharePlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('mobile')
  })
  it('falls back to other', () => {
    expect(detectSharePlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('other')
  })
})

describe('pickScreenshotHint', () => {
  it('gives an OS-specific single line', () => {
    expect(pickScreenshotHint('windows')).toContain('Win+Shift+S')
    expect(pickScreenshotHint('mac')).toContain('Shift+4')
    expect(pickScreenshotHint('mobile')).toContain('screenshot')
    expect(pickScreenshotHint('other')).toContain('Screenshot')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run lib/share/screenshot-hint.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/share/screenshot-hint.ts
export type SharePlatform = 'windows' | 'mac' | 'mobile' | 'other'

/** Classify the viewer's platform for the screenshot hint. Mobile is checked
 *  first because iOS UAs contain "like Mac OS X". `uaDataPlatform` is the
 *  high-entropy `navigator.userAgentData.platform` when present (more reliable
 *  than the UA string); the UA string is the fallback. */
export function detectSharePlatform(userAgent: string, uaDataPlatform?: string): SharePlatform {
  if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) return 'mobile'
  const platform = (uaDataPlatform ?? '').toLowerCase()
  const ua = userAgent.toLowerCase()
  if (platform.includes('win') || ua.includes('windows')) return 'windows'
  if (platform.includes('mac') || ua.includes('mac os') || ua.includes('macintosh')) return 'mac'
  return 'other'
}

/** One short, globally-clear English line telling the viewer how to screenshot
 *  the collage. Kept English to match the DONE / RESELECT / COPY LINK chrome. */
export function pickScreenshotHint(platform: SharePlatform): string {
  switch (platform) {
    case 'windows': return 'Press Win+Shift+S, then drag the collage area.'
    case 'mac': return 'Press ⌘+Shift+4, then drag the collage area.'
    case 'mobile': return 'Take a screenshot, then post it with the link.'
    default: return 'Screenshot the collage area, then post it with the link.'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run lib/share/screenshot-hint.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add lib/share/screenshot-hint.ts lib/share/screenshot-hint.test.ts
rtk git commit -m "feat(share): OS-aware screenshot hint pure functions"
```

---

## Task 3: ShareToast に hint を注入・BoardRoot で算出

**Files:**
- Modify: `components/board/ShareToast.tsx`
- Modify: `components/board/ShareToast.test.tsx`
- Modify: `components/board/BoardRoot.tsx` (ShareToast 呼び出し ~2943 付近)

**Interfaces:**
- Consumes: `pickScreenshotHint` / `detectSharePlatform` (Task 2)
- Produces: `ShareToast` prop `hint: string` を新設（従来のハードコード文言を置換）

- [ ] **Step 1: Write the failing test**

Add to `components/board/ShareToast.test.tsx`:

```tsx
it('renders the injected OS hint instead of a hardcoded string', () => {
  render(<ShareToast count={3} hint="Press Win+Shift+S, then drag the collage area." onReselect={() => {}} onDone={() => {}} />)
  expect(screen.getByText('Press Win+Shift+S, then drag the collage area.')).toBeInTheDocument()
})
```

(If the existing tests construct `ShareToast` without `hint`, add `hint=""` to those call sites so the file type-checks.)

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run components/board/ShareToast.test.tsx`
Expected: FAIL — `hint` prop does not exist / text not found.

- [ ] **Step 3: Add the `hint` prop to ShareToast**

In `components/board/ShareToast.tsx`, extend `Props` and replace the hardcoded hint:

```tsx
type Props = {
  /** Number of cards currently in the shared collage. */
  readonly count: number
  /** OS-aware one-line screenshot instruction (from pickScreenshotHint). */
  readonly hint: string
  /** Back to the first stage (card selection). */
  readonly onReselect: () => void
  /** Leave SHARE mode entirely. */
  readonly onDone: () => void
}

export function ShareToast({ count, hint, onReselect, onDone }: Props): ReactElement {
```

And replace the hardcoded `<span className={styles.hint}>…</span>` body with:

```tsx
        <span className={styles.hint}>{hint}</span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run components/board/ShareToast.test.tsx`
Expected: PASS.

- [ ] **Step 5: Compute + pass hint in BoardRoot**

In `components/board/BoardRoot.tsx`, add imports:

```ts
import { detectSharePlatform, pickScreenshotHint } from '@/lib/share/screenshot-hint'
```

Add a memoized hint (client-only; guard `navigator`). Place it near other `useMemo`s in the render body:

```ts
const screenshotHint = useMemo((): string => {
  if (typeof navigator === 'undefined') return pickScreenshotHint('other')
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  return pickScreenshotHint(detectSharePlatform(navigator.userAgent, nav.userAgentData?.platform))
}, [])
```

Then pass it into the `<ShareToast>` render (~line 2943):

```tsx
<ShareToast
  count={selectedIds.size}
  hint={screenshotHint}
  onReselect={(): void => setSharePhase('select')}
  onDone={handleExitShareMode}
/>
```

- [ ] **Step 6: Verify tsc + suites**

Run: `rtk tsc && rtk vitest run components/board/ShareToast.test.tsx`
Expected: tsc 0; ShareToast tests green.

- [ ] **Step 7: Commit**

```bash
rtk git add components/board/ShareToast.tsx components/board/ShareToast.test.tsx components/board/BoardRoot.tsx
rtk git commit -m "feat(share): OS-aware one-line screenshot hint in ShareToast"
```

---

## Task 4: サーバー `create.ts` の thumb を任意化

**Files:**
- Modify: `functions/api/share/create.ts:110-159`
- Modify: `functions/api/share/create.test.ts`

**Interfaces:**
- Produces: `POST /api/share/create` が `thumb` 無しの `{ share }` で 200 を返し、KV に書く（R2 put はしない）。`thumb` があれば従来どおり R2 put（後方互換）。

- [ ] **Step 1: Write the failing test**

Add to `functions/api/share/create.test.ts` (mirror the existing harness — reuse its mock `SHARE_KV` / `SHARE_OG` fakes and `onRequestPost` import):

```ts
it('accepts a share with no thumb: writes KV, skips R2', async () => {
  const kv = makeKV()          // existing helper in this test file
  const r2 = makeR2()          // existing helper; exposes .put spy / stored map
  const body = JSON.stringify({ share: validShareV2 }) // existing fixture, no thumb
  const res = await onRequestPost(makeCtx(body, { SHARE_KV: kv, SHARE_OG: r2 }))
  expect(res.status).toBe(200)
  const json = await res.json() as { id: string }
  expect(typeof json.id).toBe('string')
  expect(await kv.get(json.id)).not.toBeNull()   // KV written
  expect(r2.putCount).toBe(0)                    // R2 NOT written
})
```

> If the existing test file uses different helper names, match them — the point is: POST `{ share }` with no `thumb` → 200, KV has the entry, R2.put was never called.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run functions/api/share/create.test.ts`
Expected: FAIL — current code returns 400 ("missing share or thumb field").

- [ ] **Step 3: Make thumb optional**

In `functions/api/share/create.ts`, replace the block from the `if (!bodyObj.share …)` check through the `thumbBytes` decode (currently lines ~110-129) with:

```ts
  const bodyObj = body as Partial<KVShareEntry>
  if (!bodyObj.share) {
    return errResponse(400, 'invalid', 'missing share field')
  }

  // thumb は任意。 有る場合だけ検証して R2 用の bytes を用意する。 無ければ OG は
  // 既定カード (/og.png) に fall back する (= COPY LINK は画像を再構成しない)。
  let thumbBytes: Uint8Array | null = null
  let contentType: 'image/jpeg' | 'image/webp' = 'image/jpeg'
  if (typeof bodyObj.thumb === 'string' && bodyObj.thumb.length > 0) {
    if (bodyObj.thumb.length > SHARE_LIMITS_V2.MAX_THUMB_BYTES * 2) {
      return errResponse(413, 'invalid', 'thumbnail too large')
    }
    const thumbMatch = bodyObj.thumb.match(/^data:image\/(jpeg|webp);base64,(.+)$/)
    if (!thumbMatch || !thumbMatch[2]) {
      return errResponse(400, 'invalid', 'thumb must be a jpeg/webp data URL')
    }
    contentType = thumbMatch[1] === 'webp' ? 'image/webp' : 'image/jpeg'
    try {
      thumbBytes = base64ToBytes(thumbMatch[2])
    } catch {
      return errResponse(400, 'invalid', 'thumb base64 decode failed')
    }
  }
```

Then change the R2 put block (currently lines ~154-159) to only run when a thumb was provided:

```ts
  // 画像がある時だけ R2 へ。 無ければ og.ts が /og.png に fall back する。
  if (thumbBytes) {
    try {
      await ctx.env.SHARE_OG.put(id, thumbBytes, { httpMetadata: { contentType } })
    } catch {
      return errResponse(500, 'server', 'image upload failed')
    }
  }

  await ctx.env.SHARE_KV.put(id, encoded, { expirationTtl: SHARE_LIMITS_V2.TTL_SECONDS })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run functions/api/share/create.test.ts`
Expected: PASS — new "no thumb" test green AND existing "with thumb" tests still green (R2 put still happens when thumb present).

- [ ] **Step 5: Commit**

```bash
rtk git add functions/api/share/create.ts functions/api/share/create.test.ts
rtk git commit -m "feat(share): make create route thumb optional (skip R2 when absent)"
```

---

## Task 5: サーバー `og.ts` を既定カードにフォールバック

**Files:**
- Modify: `functions/api/share/[id]/og.ts:62-66`
- Modify: `functions/api/share/[id]/og.test.ts`

**Interfaces:**
- Produces: `GET /api/share/<id>/og` — R2 にも KV thumb にも画像が無い**が KV エントリは存在する**共有では、404 ではなく `/og.png` へ 302 リダイレクト。存在しない id は従来どおり 404。

- [ ] **Step 1: Write the failing test**

Add to `functions/api/share/[id]/og.test.ts`:

```ts
it('falls back to the default OG card when a share carries no thumb', async () => {
  const r2 = makeR2()                 // .get returns null (no object)
  const kv = makeKV()                 // existing helper
  await kv.put('abc123', await encodeNoThumbEntry())  // KV entry exists, decoded.data.thumb === undefined
  const req = new Request('https://allmarks.app/api/share/abc123/og')
  const res = await onRequestGet({ request: req, env: { SHARE_KV: kv, SHARE_OG: r2 }, params: { id: 'abc123' } })
  expect(res.status).toBe(302)
  expect(res.headers.get('location')).toBe('https://allmarks.app/og.png')
})

it('still 404s a genuinely missing id', async () => {
  const r2 = makeR2()                 // .get -> null
  const kv = makeKV()                 // .get -> null (no entry)
  const req = new Request('https://allmarks.app/api/share/missing/og')
  const res = await onRequestGet({ request: req, env: { SHARE_KV: kv, SHARE_OG: r2 }, params: { id: 'missing' } })
  expect(res.status).toBe(404)
})
```

> `encodeNoThumbEntry()` = build a KV payload whose decoded `thumb` is undefined, using the same `encodeKVPayload` the create route uses (import from `lib/share/encode-v2`) with `{ share: validShareV2 }`. Reuse the file's existing share fixture.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run "functions/api/share/[id]/og.test.ts"`
Expected: FAIL — current code returns 404 on the no-thumb path.

- [ ] **Step 3: Add the fallback**

In `functions/api/share/[id]/og.ts`, replace the no-thumb branch (currently lines ~62-66):

```ts
  const thumb = decoded.data.thumb
  if (!thumb) {
    // No custom OG image (COPY LINK shares carry no reconstructed thumb).
    // Fall back to the site's default social card so the link still unfurls.
    const origin = new URL(ctx.request.url).origin
    return Response.redirect(`${origin}/og.png`, 302)
  }
```

(Keep the earlier `if (encoded === null) return 404` — a genuinely missing / expired id must still 404.)

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run "functions/api/share/[id]/og.test.ts"`
Expected: PASS — 302-to-default for no-thumb, 404 for missing id, and existing R2-hit test still serves bytes.

- [ ] **Step 5: Commit**

```bash
rtk git add "functions/api/share/[id]/og.ts" "functions/api/share/[id]/og.test.ts"
rtk git commit -m "feat(share): og route falls back to /og.png when no per-share thumb"
```

---

## Task 6: COPY LINK オーケストレータ（再構成なし・DI）

**Files:**
- Create: `lib/share/copy-share-link.ts`
- Test: `lib/share/copy-share-link.test.ts`

**Interfaces:**
- Consumes: `ApiResult` / `createShare` の戻り型（[lib/share/api-client.ts](../../../lib/share/api-client.ts)）、`ShareDataV2` / `CreateShareResponse`（[lib/share/types-v2.ts](../../../lib/share/types-v2.ts)）
- Produces:
  - `type CopyShareLinkResult = { ok: true; url: string } | { ok: false; message: string }`
  - `copyShareLink(deps: CopyShareLinkDeps): Promise<CopyShareLinkResult>`

- [ ] **Step 1: Write the failing test**

```ts
// lib/share/copy-share-link.test.ts
import { describe, it, expect, vi } from 'vitest'
import { copyShareLink } from './copy-share-link'
import type { ShareDataV2 } from './types-v2'

const share = { v: 2, cards: [], createdAt: 0 } as unknown as ShareDataV2

describe('copyShareLink', () => {
  it('copies origin + /s/<id> on success', async () => {
    const writeClipboard = vi.fn<(t: string) => Promise<void>>().mockResolvedValue(undefined)
    const res = await copyShareLink({
      buildShare: () => share,
      createShare: async () => ({ ok: true, data: { id: 'abc', expiresAt: 1 } }),
      writeClipboard,
      origin: 'https://allmarks.app',
    })
    expect(res).toEqual({ ok: true, url: 'https://allmarks.app/s/abc' })
    expect(writeClipboard).toHaveBeenCalledWith('https://allmarks.app/s/abc')
  })

  it('never generates an image (createShare receives share only, no thumb)', async () => {
    const createShare = vi.fn(async () => ({ ok: true as const, data: { id: 'x', expiresAt: 1 } }))
    await copyShareLink({ buildShare: () => share, createShare, writeClipboard: async () => {}, origin: 'https://allmarks.app' })
    expect(createShare).toHaveBeenCalledWith({ share })
  })

  it('returns not-ok when createShare fails', async () => {
    const res = await copyShareLink({
      buildShare: () => share,
      createShare: async () => ({ ok: false, error: 'server', message: 'boom' }),
      writeClipboard: async () => {},
      origin: 'https://allmarks.app',
    })
    expect(res).toEqual({ ok: false, message: 'boom' })
  })

  it('returns not-ok when clipboard write throws', async () => {
    const res = await copyShareLink({
      buildShare: () => share,
      createShare: async () => ({ ok: true, data: { id: 'abc', expiresAt: 1 } }),
      writeClipboard: async () => { throw new Error('denied') },
      origin: 'https://allmarks.app',
    })
    expect(res).toEqual({ ok: false, message: 'denied' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run lib/share/copy-share-link.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/share/copy-share-link.ts
import type { ApiResult } from './api-client'
import type { CreateShareResponse, ShareDataV2 } from './types-v2'

export type CopyShareLinkResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly message: string }

export type CopyShareLinkDeps = {
  /** Build the v2 payload from the current selection (board order, filter:null). */
  readonly buildShare: () => ShareDataV2
  /** POST /api/share/create — called with { share } ONLY (no thumb; no image is
   *  ever reconstructed for COPY LINK). */
  readonly createShare: (entry: { share: ShareDataV2 }) => Promise<ApiResult<CreateShareResponse>>
  /** navigator.clipboard.writeText wrapper (injected for testability). */
  readonly writeClipboard: (text: string) => Promise<void>
  /** window.location.origin. */
  readonly origin: string
}

/** Create a /s share link for the current selection and copy its URL to the
 *  clipboard. Generates NO image (decision B: no replica). */
export async function copyShareLink(deps: CopyShareLinkDeps): Promise<CopyShareLinkResult> {
  const share = deps.buildShare()
  const result = await deps.createShare({ share })
  if (!result.ok) {
    return { ok: false, message: result.message }
  }
  const url = `${deps.origin}/s/${result.data.id}`
  try {
    await deps.writeClipboard(url)
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'clipboard error' }
  }
  return { ok: true, url }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run lib/share/copy-share-link.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/share/copy-share-link.ts lib/share/copy-share-link.test.ts
rtk git commit -m "feat(share): copyShareLink orchestrator (no image reconstruction)"
```

---

## Task 7: COPY LINK ボタン＋BoardRoot 配線

**Files:**
- Modify: `components/board/ShareToast.tsx`
- Modify: `components/board/ShareToast.module.css`
- Modify: `components/board/ShareToast.test.tsx`
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: `copyShareLink` (Task 6)、`buildShareDataFromBoard`（[lib/share/board-to-share.ts](../../../lib/share/board-to-share.ts)）、`createShare`（api-client）、`selectedInBoardOrder`（[lib/share/selection.ts](../../../lib/share/selection.ts)、既に BoardRoot が import 済）
- Produces: `ShareToast` prop `onCopyLink?: () => Promise<boolean>`。BoardRoot ハンドラ `handleCopyShareLink(): Promise<boolean>`（`selectedIds` から盤面順ペイロードを組む・`filter:null`・thumb なし）

- [ ] **Step 1: Write the failing test**

Add to `components/board/ShareToast.test.tsx`:

```tsx
it('shows COPY LINK, then LINK COPIED on success', async () => {
  const onCopyLink = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)
  render(<ShareToast count={2} hint="" onCopyLink={onCopyLink} onReselect={() => {}} onDone={() => {}} />)
  const btn = screen.getByTestId('share-toast-copy-link')
  expect(btn).toHaveTextContent('COPY LINK')
  fireEvent.click(btn)
  await waitFor(() => expect(onCopyLink).toHaveBeenCalled())
  await screen.findByText('LINK COPIED', { exact: false })
})

it('shows an error label when copy fails', async () => {
  const onCopyLink = vi.fn<() => Promise<boolean>>().mockResolvedValue(false)
  render(<ShareToast count={2} hint="" onCopyLink={onCopyLink} onReselect={() => {}} onDone={() => {}} />)
  fireEvent.click(screen.getByTestId('share-toast-copy-link'))
  await screen.findByText("COULDN'T COPY", { exact: false })
})
```

(Ensure `fireEvent`, `waitFor` are imported from `@testing-library/react` and `vi` from `vitest` in this test file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run components/board/ShareToast.test.tsx`
Expected: FAIL — no `share-toast-copy-link` element.

- [ ] **Step 3: Add COPY LINK to ShareToast**

In `components/board/ShareToast.tsx`, add `useCallback`, `useRef`, `useState` imports and extend the component:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './ShareToast.module.css'

type Props = {
  readonly count: number
  readonly hint: string
  /** Copy the /s link for the current selection. Resolves true on success.
   *  Omitted → the COPY LINK button is not rendered. */
  readonly onCopyLink?: () => Promise<boolean>
  readonly onReselect: () => void
  readonly onDone: () => void
}

type CopyState = 'idle' | 'copied' | 'error'

export function ShareToast({ count, hint, onCopyLink, onReselect, onDone }: Props): ReactElement {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const timerRef = useRef<number | null>(null)
  useEffect((): (() => void) => (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  const handleCopy = useCallback(async (): Promise<void> => {
    if (!onCopyLink) return
    const ok = await onCopyLink()
    setCopyState(ok ? 'copied' : 'error')
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout((): void => setCopyState('idle'), 1600)
  }, [onCopyLink])

  const copyLabel = copyState === 'copied' ? 'LINK COPIED ✓' : copyState === 'error' ? "COULDN'T COPY" : 'COPY LINK'

  return (
    <div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.SHARE_TOAST }} role="toolbar" aria-label="Sharing">
      <div className={styles.bar}>
        <span className={styles.counter} data-testid="share-toast-count">
          SHARING… {count}
        </span>
        <span className={styles.hint}>{hint}</span>
        <div className={styles.actions}>
          {onCopyLink && (
            <button type="button" className={styles.secondaryBtn} onClick={(): void => { void handleCopy() }} data-testid="share-toast-copy-link">
              {copyLabel}
            </button>
          )}
          <button type="button" className={styles.secondaryBtn} onClick={onReselect} data-testid="share-toast-reselect">
            RESELECT
          </button>
          <button type="button" className={styles.primaryBtn} onClick={onDone} data-testid="share-toast-done">
            DONE
          </button>
        </div>
      </div>
    </div>
  )
}
```

(No CSS change strictly required — COPY LINK reuses `.secondaryBtn`. If a subtle visual distinction is wanted, add a `.copyBtn` modifier in `ShareToast.module.css`; otherwise leave the module unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run components/board/ShareToast.test.tsx`
Expected: PASS (hint + copy-success + copy-error).

- [ ] **Step 5: Wire `handleCopyShareLink` in BoardRoot**

In `components/board/BoardRoot.tsx`, add imports:

```ts
import { copyShareLink } from '@/lib/share/copy-share-link'
import { createShare } from '@/lib/share/api-client'
```

(`buildShareDataFromBoard` and `selectedInBoardOrder` are already imported.) Add the handler near `buildShareData`:

```ts
// COPY LINK (arrange stage): build the /s payload from the ARRANGE selection
// (selectedIds — NOT shareSelectedItems, which is null here) in board order,
// filter:null. Generates NO image (thumb-less createShare); the /s OG falls
// back to the default card server-side.
const handleCopyShareLink = useCallback(async (): Promise<boolean> => {
  const chosen = selectedInBoardOrder(items, selectedIds)
  if (chosen.length === 0) return false
  const buildShare = (): ShareDataV2 => buildShareDataFromBoard({
    items: chosen.map((it) => ({
      bookmarkId: it.bookmarkId,
      url: it.url,
      title: it.title,
      description: it.description ?? undefined,
      thumbnail: it.thumbnail ?? undefined,
      aspectRatio: it.aspectRatio,
      tags: it.tags,
      cardWidth: customWidths[it.bookmarkId] ?? cardWidthPx,
    })),
    tags: tags.map((tg) => ({ id: tg.id, name: tg.name, color: tg.color })),
    filter: null,
    now: Date.now(),
    themeId,
    custom: resolvedCustom ?? undefined,
    gap: cardGapPx,
    defaultWidth: cardWidthPx,
  })
  const res = await copyShareLink({
    buildShare,
    createShare,
    writeClipboard: (t: string): Promise<void> => navigator.clipboard.writeText(t),
    origin: typeof window !== 'undefined' ? window.location.origin : 'https://allmarks.app',
  })
  return res.ok
}, [items, selectedIds, customWidths, cardWidthPx, tags, themeId, resolvedCustom, cardGapPx])
```

> Verify `selectedInBoardOrder(items, selectedIds)` returns objects exposing `bookmarkId/url/title/description/thumbnail/aspectRatio/tags` — it is the same helper feeding `shareSelectedItems` at BoardRoot ~1949, which flows into `buildShareData`'s identical mapping, so the shape matches. If `ShareDataV2` is not already imported, add it to the existing `@/lib/share/types-v2` import.

Then pass `onCopyLink` into `<ShareToast>`:

```tsx
<ShareToast
  count={selectedIds.size}
  hint={screenshotHint}
  onCopyLink={handleCopyShareLink}
  onReselect={(): void => setSharePhase('select')}
  onDone={handleExitShareMode}
/>
```

- [ ] **Step 6: Verify tsc + suites**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0; all vitest green.

- [ ] **Step 7: Commit**

```bash
rtk git add components/board/ShareToast.tsx components/board/ShareToast.module.css components/board/ShareToast.test.tsx components/board/BoardRoot.tsx
rtk git commit -m "feat(share): COPY LINK in arrange toast (thumb-less /s link, board-order selection)"
```

---

## Task 8: 撮影ガイド＝パネル縁の一瞬グロー（任意・見た目のみ）

> **付加価値・過剰にしない**（spec ②）。レイアウトは変えない・永続枠なし・全画面化しない。Playwright 不可＝手動目視。この Task は skip 可能（コアは Task 1〜7）。

**Files:**
- Modify: `components/board/BoardRoot.module.css`
- Modify: `components/board/BoardRoot.tsx`

- [ ] **Step 1: Add a one-shot edge-pulse keyframe (CSS)**

In `components/board/BoardRoot.module.css`, add (near the `.canvas` rules):

```css
@keyframes arrangeEdgePulse {
  0%   { box-shadow: 0 0 0 0 rgba(40, 241, 0, 0); }
  30%  { box-shadow: 0 0 0 2px rgba(40, 241, 0, 0.35), 0 0 24px rgba(40, 241, 0, 0.22); }
  100% { box-shadow: 0 0 0 0 rgba(40, 241, 0, 0); }
}
/* One-shot on arrange entry: shows the capture rectangle (the existing panel
   edge) then fades — gone before the user screenshots, so it never appears in
   the shot. No layout change. */
.canvasArrangeGuide {
  animation: arrangeEdgePulse 900ms ease-out 1;
}
```

- [ ] **Step 2: Toggle the class for ~900ms when entering arrange (BoardRoot)**

Add an effect that adds `styles.canvasArrangeGuide` to the `.canvas` element (via a ref or by composing className) when `sharePhase` transitions to `'arrange'`, and removes it after 900ms. Use the existing canvas ref if present; otherwise compose the class conditionally with a short-lived state:

```ts
const [arrangeGuidePulse, setArrangeGuidePulse] = useState(false)
useEffect((): (() => void) | undefined => {
  if (sharePhase !== 'arrange') return undefined
  setArrangeGuidePulse(true)
  const t = window.setTimeout((): void => setArrangeGuidePulse(false), 900)
  return (): void => window.clearTimeout(t)
}, [sharePhase])
```

Compose the class on the `.canvas` element (line ~2446 `className={styles.canvas}`):

```tsx
className={arrangeGuidePulse ? `${styles.canvas} ${styles.canvasArrangeGuide}` : styles.canvas}
```

- [ ] **Step 3: Manual verify (local, clean build)**

```bash
rm -rf .next out && rtk pnpm build
```
Then serve `out/` locally (or verify on the next deploy). Enter SHARE → SELECT ALL → ARRANGE and confirm: the panel edge briefly glows green then fades; **no layout shift**; taking a screenshot a moment later shows no glow.
- If the glow is clipped by `.canvas { overflow:hidden }`, move it to an inset `outline`/`::after` overlay instead of `box-shadow` (still one-shot, still no layout change). Keep it subtle.

- [ ] **Step 4: Commit**

```bash
rtk git add components/board/BoardRoot.module.css components/board/BoardRoot.tsx
rtk git commit -m "feat(share): one-shot panel-edge guide on arrange entry (no layout change)"
```

---

## Final: 統合検証＋デプロイ

- [ ] **Step 1: Full gate**

Run: `rtk tsc && rtk vitest run && rm -rf .next out && rtk pnpm build`
Expected: tsc 0 / vitest all green / build OK.

- [ ] **Step 2: Deploy**

```bash
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 3: Manual verify on `allmarks.app` (hard reload)**

- ① メーター：配置に入るとスクロールメーターが消え、SHARING バーが読める（重なり無し）。select 段では出る。
- ③ 撮り方：自分の PC（Windows）で `Press Win+Shift+S, then drag the collage area.` が1行で出る。
- ④ COPY LINK：押すと `LINK COPIED ✓`。貼り付けると `https://allmarks.app/s/<id>`。開くと本物の共有ボード。別 SNS でリンクだけ貼るとプレビューは AllMarks 既定カード（`/og.png`）。
- ② ガイド：配置に入るとパネル縁が一瞬光ってフェード（スクショに写らない）。
- レイアウト：縁→ボード→カードのまま・全画面化していない。

- [ ] **Step 4: Docs 更新 + close-out**（別途セッション終了フローで）

---

## Self-Review（この計画 vs spec）

- **spec ①**（メーター重なり）→ Task 1。✅
- **spec ②**（撮る範囲クリーン＋既存縁ガイド・レイアウト不変）→ Task 1（メーター除去でクリーン）＋ Task 8（一瞬グロー・任意）。✅
- **spec ③**（OS判定1行）→ Task 2（純関数）＋ Task 3（配線）。✅
- **spec ④**（COPY LINK 再構成なし）→ Task 4（create thumb 任意）＋ Task 5（og fallback）＋ Task 6（orchestrator）＋ Task 7（配線）。✅
- **決定B**（再構成禁止）→ 新経路は `captureMirrorToWebP`/`renderShareImage` を import すらしない。COPY LINK は `createShare({ share })` のみ。✅
- **決定C**（レイアウト不変）→ Task 8 は box-shadow/outline のみ・要素配置不変。✅
- **受け取り側 `/s` 無変更**→ どの Task も `functions/s/*` / `SharedBoard` を触らない（og.ts はプレビュー配信のみ）。✅
- **型整合**：`shouldShowScrollMeter` / `detectSharePlatform` / `pickScreenshotHint` / `copyShareLink` / `CopyShareLinkDeps` / `CopyShareLinkResult` / ShareToast props（`hint`/`onCopyLink`）は Task 間で一貫。`createShare` は `{ share }` 形（thumb 省略、型は `KVShareEntry.thumb?` で許容）。✅
- **Placeholder 走査**：TBD/TODO なし。og フォールバックは 302→`/og.png` に確定。create の R2 skip 条件は `thumbBytes` 有無で確定。✅
