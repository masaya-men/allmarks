# Share Mirror + Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SHARE モーダルに live ミラーを追加、 背景ボードとの同期スクロール対応、 ミラー由来の Canvas キャプチャで OG 画像を生成、 既存の placeholder snapshot を撤去。

**Architecture:** 既存 KV スキーマ `{share, thumb}` は維持。 新規 `ShareMirror` コンポーネントが MOTION OFF 状態のボードの縮小レンダーを担当 (= 1.91:1 frame、 サムネ画像 + タイトル + ブランド帯のみ、 iframe / 動画なし)。 SHARE 確定時に新規 `captureMirrorToWebP` 関数が canvas に drawImage して WebP を生成、 既存 `createShare` API に thumb として送信。 新規 `/api/share/[id]/og.ts` Pages Function が KV の thumb を bytes として配信。

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Vanilla CSS Modules, Cloudflare Pages Functions, Cloudflare KV, vitest + React Testing Library, Canvas 2D API

**Reference spec:** [docs/superpowers/specs/2026-05-27-share-mirror-capture-design.md](../specs/2026-05-27-share-mirror-capture-design.md)

---

## File Structure

| 役割 | パス | 新規/改修/削除 |
|---|---|---|
| OG 画像配信プロキシ | `functions/api/share/[id]/og.ts` | 新規 |
| OG プロキシ test | `functions/api/share/[id]/og.test.ts` | 新規 |
| Canvas キャプチャ関数 | `lib/share/capture-mirror.ts` | 新規 |
| Canvas キャプチャ test | `lib/share/capture-mirror.test.ts` | 新規 |
| ShareMirror コンポーネント | `components/share/ShareMirror.tsx` | 新規 |
| ShareMirror styles | `components/share/ShareMirror.module.css` | 新規 |
| ShareMirror test | `components/share/ShareMirror.test.tsx` | 新規 |
| 既存モーダル本体 | `components/share/SenderShareModal.tsx` | 改修 |
| 既存モーダル styles | `components/share/SenderShareModal.module.css` | 改修 |
| 既存モーダル test | `components/share/SenderShareModal.test.tsx` | 改修 |
| BoardRoot 配線 | `components/board/BoardRoot.tsx` | 改修 (= scrollY 系 prop 追加) |
| placeholder snapshot 削除 | `lib/share/snapshot.ts` | 削除 |
| placeholder snapshot test 削除 | `lib/share/snapshot.test.ts` | 削除 |

---

## Task 1: OG 画像配信プロキシ Pages Function

**Files:**
- Create: `functions/api/share/[id]/og.ts`
- Create: `functions/api/share/[id]/og.test.ts`

**目的:** [functions/s/patch-share-html.ts#L33](../../../functions/s/patch-share-html.ts#L33) が `og:image` に埋め込んでいる URL `/api/share/<id>/og.webp` をハンドルする。 KV の `thumb` (= base64 WebP dataURL) を bytes として返す薄いプロキシ。

- [ ] **Step 1.1: 失敗するテストを書く**

`functions/api/share/[id]/og.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { onRequestGet } from './og'
import { encodeKVPayload } from '../../../../lib/share/encode-v2'
import { SHARE_SCHEMA_VERSION_V2, type KVShareEntry } from '../../../../lib/share/types-v2'

interface MockEnv {
  SHARE_KV: { get: (key: string) => Promise<string | null> }
}

function makeCtx(id: string, kvValue: string | null) {
  const env: MockEnv = { SHARE_KV: { get: vi.fn().mockResolvedValue(kvValue) } }
  return {
    request: new Request(`https://test.local/api/share/${id}/og.webp`),
    env,
    params: { id },
  }
}

const sampleEntry: KVShareEntry = {
  share: {
    v: SHARE_SCHEMA_VERSION_V2,
    cards: [{ u: 'https://example.com/a', t: 'a', ty: 'website', cw: 240, a: 1.6 }],
    createdAt: Date.now(),
  },
  thumb: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v68xnEAAAA=',
}

describe('GET /api/share/:id/og', () => {
  it('returns 404 for invalid id format', async () => {
    const ctx = makeCtx('TOOLONG', null)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(404)
  })

  it('returns 404 when KV miss', async () => {
    const ctx = makeCtx('aB3xY9', null)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(404)
  })

  it('returns 200 + image/webp + bytes for valid id', async () => {
    const encoded = await encodeKVPayload(sampleEntry)
    const ctx = makeCtx('aB3xY9', encoded)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    expect(res.headers.get('Cache-Control')).toContain('public')
    const buf = await res.arrayBuffer()
    expect(buf.byteLength).toBeGreaterThan(0)
  })

  it('returns 500 when thumb has wrong prefix', async () => {
    const bad: KVShareEntry = { ...sampleEntry, thumb: 'data:image/png;base64,AAAA' }
    const encoded = await encodeKVPayload(bad)
    const ctx = makeCtx('aB3xY9', encoded)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 1.2: テストが fail することを確認する**

Run: `pnpm vitest run functions/api/share/\[id\]/og.test.ts`
Expected: FAIL — `Cannot find module './og'`

- [ ] **Step 1.3: 実装を書く**

`functions/api/share/[id]/og.ts`:

```typescript
// GET /api/share/:id/og.webp — KV の thumb (base64 WebP dataURL) を bytes として返す薄いプロキシ
import { isValidShareId } from '../../../../lib/share/kv-id'
import { decodeKVPayload } from '../../../../lib/share/decode-v2'

interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' }): Promise<string | null>
}

interface Env {
  SHARE_KV: KVNamespace
}

interface PagesContext {
  request: Request
  env: Env
  params: { id: string }
}

export async function onRequestGet(ctx: PagesContext): Promise<Response> {
  const id = ctx.params.id
  if (!isValidShareId(id)) {
    return new Response('not found', { status: 404 })
  }

  const encoded = await ctx.env.SHARE_KV.get(id)
  if (encoded === null) {
    return new Response('not found', { status: 404 })
  }

  const decoded = await decodeKVPayload(encoded)
  if (!decoded.ok) {
    return new Response('error', { status: 500 })
  }

  const thumb = decoded.data.thumb
  const match = thumb.match(/^data:image\/webp;base64,(.+)$/)
  if (!match || !match[1]) {
    return new Response('invalid thumb', { status: 500 })
  }

  const binary = atob(match[1])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
```

- [ ] **Step 1.4: テストが pass することを確認する**

Run: `pnpm vitest run functions/api/share/\[id\]/og.test.ts`
Expected: PASS — 4 tests pass

- [ ] **Step 1.5: tsc を通す**

Run: `pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 1.6: commit**

```bash
rtk git add functions/api/share/\[id\]/og.ts functions/api/share/\[id\]/og.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(share): add OG image proxy Pages Function

Returns KV thumb bytes as image/webp at /api/share/:id/og.webp.
Thin proxy with 1h edge cache, 24h s-maxage for crawler hits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Canvas キャプチャ関数 `capture-mirror.ts`

**Files:**
- Create: `lib/share/capture-mirror.ts`
- Create: `lib/share/capture-mirror.test.ts`

**目的:** ミラー DOM の現在の見た目を canvas API で WebP 化する。 ライブラリ依存なし (= session 85 の dom-to-image-more の置換)。 jsdom では canvas の本格動作が無いため、 ユニットテストは null/early-return 経路のみカバー、 実描画は Task 7 の playwright で検証する ([lib/share/snapshot.test.ts#L1-L4](../../../lib/share/snapshot.test.ts#L1) と同じ方針)。

- [ ] **Step 2.1: 失敗するテストを書く**

`lib/share/capture-mirror.test.ts`:

```typescript
// jsdom では canvas / Image の本格動作が無いため、 null 返却・early-return 経路のみ確認。
// 実描画の動作確認は playwright integration test で別途実施 (= Task 7)。
import { describe, it, expect } from 'vitest'
import { captureMirrorToWebP, type MirrorCaptureInput } from './capture-mirror'
import { SHARE_SCHEMA_VERSION_V2, type ShareDataV2 } from './types-v2'

const minimalShare: ShareDataV2 = {
  v: SHARE_SCHEMA_VERSION_V2,
  cards: [
    { u: 'https://example.com/a', t: 'a', ty: 'website', cw: 240, a: 1.6 },
  ],
  createdAt: Date.now(),
}

const baseInput = {
  shareData: minimalShare,
  activeTagNames: [],
  totalBoardCount: 1,
  width: 1200,
  height: 630,
  quality: 0.85,
} as const

describe('captureMirrorToWebP', () => {
  it('returns null when mirrorFrame is null', async () => {
    const result = await captureMirrorToWebP({
      ...baseInput,
      mirrorFrame: null,
    } as MirrorCaptureInput)
    expect(result).toBeNull()
  })

  it('returns null when canvas getContext fails (= jsdom path)', async () => {
    // jsdom returns null from getContext('2d'), so any element triggers null
    const el = document.createElement('div')
    el.style.width = '600px'
    el.style.height = '314px'
    document.body.appendChild(el)
    const result = await captureMirrorToWebP({
      ...baseInput,
      mirrorFrame: el,
    })
    // In jsdom, this hits one of: getContext null, or toBlob unsupported
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2.2: テストが fail することを確認する**

Run: `pnpm vitest run lib/share/capture-mirror.test.ts`
Expected: FAIL — `Cannot find module './capture-mirror'`

- [ ] **Step 2.3: 実装の型骨格を書く**

`lib/share/capture-mirror.ts`:

```typescript
// ミラー DOM を Canvas API で WebP 画像化する。 ライブラリ依存なし。
//
// 設計: lib/share/snapshot.ts (session 85 の placeholder) の置換。 dom-to-image-more の
// メモリ爆発 + iframe 自動再生問題を回避するため、 DOM walk せず直接 canvas に
// drawImage する方式。 入力は ShareMirror の DOM frame + share data。
//
// jsdom 環境では canvas API が未対応のため、 null を返して safely fail する。
// 実環境 (= ブラウザ) の動作は playwright で検証 (= Task 7)。

import type { ShareDataV2, ShareCardV2 } from './types-v2'

export type MirrorCaptureInput = {
  /** ShareMirror のルート DOM (= 1.91:1 frame)。 null なら null を返す。 */
  readonly mirrorFrame: HTMLElement | null
  /** 共有データ。 cards の URL / thumb / title を読む。 */
  readonly shareData: ShareDataV2
  /** アクティブな tag 名 (= ブランド帯上部表示用、 空配列なら非表示)。 */
  readonly activeTagNames: ReadonlyArray<string>
  /** "N OF M CARDS" の M 側 (= ボード全体のカード数)。 */
  readonly totalBoardCount: number
  /** Output width in px (typical 1200). */
  readonly width: number
  /** Output height in px (typical 630 = 1.91:1)。 */
  readonly height: number
  /** WebP quality 0.0-1.0。 */
  readonly quality: number
}

const BG_COLOR = '#0a0a0c'
const BRAND_GREEN = '#28F100'
const TEXT_MAIN = 'rgba(255, 255, 255, 0.92)'
const TEXT_SOFT = 'rgba(255, 255, 255, 0.42)'

export async function captureMirrorToWebP(input: MirrorCaptureInput): Promise<string | null> {
  if (!input.mirrorFrame) return null

  try {
    const canvas = document.createElement('canvas')
    canvas.width = input.width
    canvas.height = input.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // 背景塗り (= board の地色と揃える)
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, input.width, input.height)

    // ミラー DOM から card 要素を取得 + 各カードを描画
    await drawCards(ctx, input)

    // ブランド帯
    drawBrandStrip(ctx, input)

    // toBlob 経由で WebP base64 を返す
    const dataUrl: string | null = await canvasToWebP(canvas, input.quality)
    return dataUrl
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[share/capture-mirror] capture failed', e)
    return null
  }
}

async function drawCards(ctx: CanvasRenderingContext2D, input: MirrorCaptureInput): Promise<void> {
  const frame = input.mirrorFrame
  if (!frame) return
  const frameRect = frame.getBoundingClientRect()
  if (frameRect.width === 0 || frameRect.height === 0) return

  const scaleX = input.width / frameRect.width
  const scaleY = input.height / frameRect.height

  const cardEls = Array.from(frame.querySelectorAll<HTMLElement>('[data-mirror-card-id]'))
  for (const el of cardEls) {
    const rect = el.getBoundingClientRect()
    const cx = (rect.left - frameRect.left) * scaleX
    const cy = (rect.top - frameRect.top) * scaleY
    const cw = rect.width * scaleX
    const ch = rect.height * scaleY

    // OG frame からはみ出ているカードはスキップ
    if (cx + cw < 0 || cy + ch < 0 || cx > input.width || cy > input.height) continue

    const cardId = el.dataset.mirrorCardId ?? ''
    const card = input.shareData.cards.find((c): c is ShareCardV2 => indexedUrl(c) === cardId)
    if (!card) continue

    // カードの背景塗り (= 失敗時の fallback ベース、 cross-origin OK なら drawImage で上書き)
    ctx.fillStyle = '#1a1a1c'
    ctx.fillRect(cx, cy, cw, ch)

    // サムネ画像が取れれば drawImage
    if (card.th) {
      try {
        const img = await loadCrossOriginImage(card.th)
        if (img) ctx.drawImage(img, cx, cy, cw, ch)
      } catch {
        // 失敗時はベース塗りそのまま (= 上の灰色)
      }
    }

    // タイトル text を 1〜2 行 (= card type 別に色分けはしない、 落ち着いた白)
    ctx.fillStyle = TEXT_MAIN
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    const titleSize = Math.max(9, Math.round(ch * 0.09))
    ctx.font = `500 ${titleSize}px "Geist Mono", ui-monospace, monospace`
    drawClippedText(ctx, card.t, cx + 6, cy + ch - titleSize - 6, cw - 12)
  }
}

function drawBrandStrip(ctx: CanvasRenderingContext2D, input: MirrorCaptureInput): void {
  const W = input.width
  const H = input.height
  const padding = 18

  // 上部 tag 帯 (= activeTagNames が空でなければ "MUSIC · DESIGN")
  if (input.activeTagNames.length > 0) {
    const text = input.activeTagNames.map((s): string => s.toUpperCase()).join(' · ')
    ctx.fillStyle = TEXT_SOFT
    ctx.font = '500 13px "Geist Mono", ui-monospace, monospace'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    drawClippedText(ctx, text, padding, padding, W - padding * 2)
  }

  // 左下 「A」 マーク (= 簡略表現、 32×32 px)
  drawALogo(ctx, padding, H - padding - 32, 32)

  // 右下 「N CARDS · NEWEST FIRST」 or「N OF M CARDS · NEWEST FIRST」
  const N = input.shareData.cards.length
  const M = input.totalBoardCount
  const captionText = M > N
    ? `${N} OF ${M} CARDS · NEWEST FIRST`
    : `${N} CARDS`
  ctx.fillStyle = TEXT_MAIN
  ctx.font = '500 13px "Geist Mono", ui-monospace, monospace'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillText(captionText, W - padding, H - padding - 16)

  // 右下緑 dot
  ctx.fillStyle = BRAND_GREEN
  ctx.beginPath()
  ctx.arc(W - padding - ctx.measureText(captionText).width - 12, H - padding - 16, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawALogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save()
  ctx.translate(x, y)
  // 黒い背景は省略 (= 透明)、 白い A の縦線 + 横線
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)'
  ctx.lineWidth = Math.max(2, size * 0.08)
  ctx.lineCap = 'square'
  ctx.beginPath()
  ctx.moveTo(size * 0.18, size * 0.84)
  ctx.lineTo(size * 0.5, size * 0.1)
  ctx.lineTo(size * 0.82, size * 0.84)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(size * 0.33, size * 0.58)
  ctx.lineTo(size * 0.67, size * 0.58)
  ctx.stroke()
  // 緑チェック
  ctx.strokeStyle = BRAND_GREEN
  ctx.lineWidth = Math.max(1.5, size * 0.06)
  ctx.beginPath()
  ctx.moveTo(size * 0.62, size * 0.74)
  ctx.lineTo(size * 0.72, size * 0.84)
  ctx.lineTo(size * 0.9, size * 0.62)
  ctx.stroke()
  ctx.restore()
}

function drawClippedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
): void {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y)
    return
  }
  // 末尾 ... で切り詰め
  let clipped = text
  while (clipped.length > 1 && ctx.measureText(clipped + '…').width > maxWidth) {
    clipped = clipped.slice(0, -1)
  }
  ctx.fillText(clipped + '…', x, y)
}

function loadCrossOriginImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve): void => {
    if (typeof Image === 'undefined') { resolve(null); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = (): void => resolve(img)
    img.onerror = (): void => resolve(null)
    img.src = url
  })
}

function canvasToWebP(canvas: HTMLCanvasElement, quality: number): Promise<string | null> {
  return new Promise((resolve): void => {
    if (typeof canvas.toBlob !== 'function') { resolve(null); return }
    canvas.toBlob(
      (blob): void => {
        if (!blob) { resolve(null); return }
        const reader = new FileReader()
        reader.onload = (): void => resolve(typeof reader.result === 'string' ? reader.result : null)
        reader.onerror = (): void => resolve(null)
        reader.readAsDataURL(blob)
      },
      'image/webp',
      quality,
    )
  })
}

/** Card identity for mirror DOM <-> share data linking. URL is unique per card. */
function indexedUrl(card: ShareCardV2): string {
  return card.u
}
```

- [ ] **Step 2.4: テストが pass することを確認する**

Run: `pnpm vitest run lib/share/capture-mirror.test.ts`
Expected: PASS — 2 tests pass (= null 経路 + jsdom 環境 path)

- [ ] **Step 2.5: tsc を通す**

Run: `pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2.6: commit**

```bash
rtk git add lib/share/capture-mirror.ts lib/share/capture-mirror.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(share): add canvas-based mirror capture (capture-mirror.ts)

Replaces dom-to-image-more approach that OOM'd in session 85.
Walks mirror DOM via data-mirror-card-id markers, draws thumbnails
+ titles + brand strip directly to canvas. Cross-origin failures
fallback to neutral grey card; capture never blocks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: ShareMirror コンポーネント (= 1.91:1 frame、 MOTION OFF、 ブランド帯組込)

**Files:**
- Create: `components/share/ShareMirror.tsx`
- Create: `components/share/ShareMirror.module.css`
- Create: `components/share/ShareMirror.test.tsx`

**目的:** モーダル中央に表示される「ボードの縮小版」 を生成する。 ShareDataV2.cards を skyline 風に再 layout (= 縮小サイズ)、 サムネ画像 + タイトル + ブランド帯を組み込み、 内部 `<iframe>` を一切含まない。 capture-mirror.ts の入力 source として `data-mirror-card-id` 属性を各カードに付与する。

- [ ] **Step 3.1: 失敗するテストを書く**

`components/share/ShareMirror.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ShareMirror } from './ShareMirror'
import { SHARE_SCHEMA_VERSION_V2, type ShareDataV2 } from '@/lib/share/types-v2'

function makeShareData(n: number): ShareDataV2 {
  return {
    v: SHARE_SCHEMA_VERSION_V2,
    cards: Array.from({ length: n }, (_, i) => ({
      u: `https://example.com/c${i}`,
      t: `card ${i}`,
      ty: 'website' as const,
      cw: 240,
      a: 1.6,
      th: `https://example.com/thumb${i}.webp`,
    })),
    createdAt: Date.now(),
  }
}

describe('ShareMirror', () => {
  it('renders one [data-mirror-card-id] element per card', () => {
    const data = makeShareData(5)
    const { container } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={5}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    const cards = container.querySelectorAll('[data-mirror-card-id]')
    expect(cards.length).toBe(5)
  })

  it('does NOT render any iframe (MOTION OFF guarantee)', () => {
    const data = makeShareData(3)
    const { container } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(container.querySelectorAll('iframe').length).toBe(0)
    expect(container.querySelectorAll('video').length).toBe(0)
    expect(container.querySelectorAll('audio').length).toBe(0)
  })

  it('renders bottom brand strip with "N CARDS" when no trim', () => {
    const data = makeShareData(3)
    const { getByText } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(getByText(/3 CARDS/)).toBeTruthy()
  })

  it('renders "N OF M CARDS · NEWEST FIRST" when trimmed', () => {
    const data = makeShareData(3)
    const { getByText } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={10}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(getByText(/3 OF 10 CARDS · NEWEST FIRST/)).toBeTruthy()
  })

  it('renders top tag strip when activeTagNames non-empty', () => {
    const data = makeShareData(2)
    const { getByText } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={['Music', 'Design']}
        totalBoardCount={2}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(getByText(/MUSIC · DESIGN/)).toBeTruthy()
  })

  it('omits top tag strip when activeTagNames empty', () => {
    const data = makeShareData(2)
    const { queryByTestId } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={2}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
      />,
    )
    expect(queryByTestId('mirror-tag-strip')).toBeNull()
  })

  it('applies scroll transform when scrollY changes', () => {
    const data = makeShareData(20)
    const { container, rerender } = render(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={20}
        scrollY={0}
        contentHeight={4000}
        viewportHeight={800}
      />,
    )
    const cardsLayer1 = container.querySelector('[data-testid="mirror-cards-layer"]') as HTMLElement | null
    const t1 = cardsLayer1?.style.transform ?? ''

    rerender(
      <ShareMirror
        shareData={data}
        activeTagNames={[]}
        totalBoardCount={20}
        scrollY={500}
        contentHeight={4000}
        viewportHeight={800}
      />,
    )
    const cardsLayer2 = container.querySelector('[data-testid="mirror-cards-layer"]') as HTMLElement | null
    const t2 = cardsLayer2?.style.transform ?? ''
    expect(t1).not.toBe(t2)
  })
})
```

- [ ] **Step 3.2: テストが fail することを確認する**

Run: `pnpm vitest run components/share/ShareMirror.test.tsx`
Expected: FAIL — `Cannot find module './ShareMirror'`

- [ ] **Step 3.3: ShareMirror の CSS Module を書く**

`components/share/ShareMirror.module.css`:

```css
.frame {
  position: relative;
  width: 100%;
  aspect-ratio: 1.91 / 1;
  background: #0a0a0c;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  user-select: none;
  cursor: default;
}

.tagStrip {
  position: absolute;
  top: 10px;
  left: 12px;
  right: 12px;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.42);
  z-index: 2;
  pointer-events: none;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cardsLayer {
  position: absolute;
  inset: 0;
  will-change: transform;
}

.card {
  position: absolute;
  background: #1a1a1c;
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.cardThumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cardTitle {
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: 3px;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 9px;
  color: rgba(255, 255, 255, 0.86);
  line-height: 1.2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bottomStrip {
  position: absolute;
  bottom: 10px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.92);
  text-transform: uppercase;
  z-index: 2;
  pointer-events: none;
}

.brandLogo {
  width: 24px;
  height: 24px;
  display: inline-block;
}

.caption {
  display: flex;
  align-items: center;
  gap: 6px;
}

.captionDot {
  width: 5px;
  height: 5px;
  background: #28F100;
  border-radius: 50%;
  display: inline-block;
}
```

- [ ] **Step 3.4: ShareMirror コンポーネントを書く**

`components/share/ShareMirror.tsx`:

```typescript
'use client'

import { useMemo, type ReactElement, type RefObject } from 'react'
import type { ShareDataV2, ShareCardV2 } from '@/lib/share/types-v2'
import styles from './ShareMirror.module.css'

const MIRROR_FRAME_WIDTH = 1200    // logical OG width
const MIRROR_FRAME_HEIGHT = 628    // 1200 / 1.91 ≈ 628.27, floored to even
const MIRROR_GAP = 6               // gap between cards in mirror coords
const MIRROR_CARD_WIDTH = 80       // typical mirror card width in mirror coords

type Props = {
  readonly shareData: ShareDataV2
  /** Active filter tag names for top brand strip (= "MUSIC · DESIGN"). Empty = no strip. */
  readonly activeTagNames: ReadonlyArray<string>
  /** Total cards in the full board view (= for "N OF M" display). */
  readonly totalBoardCount: number
  /** Current bg-board scrollY (= bg board coords). 0 = top. */
  readonly scrollY: number
  /** Bg board's full scrollable height (= contentBounds.height). Used to compute progress. */
  readonly contentHeight: number
  /** Bg board's viewport height (= viewport.h). */
  readonly viewportHeight: number
  /** Forwarded ref to the frame DOM so capture-mirror.ts can read rects. Optional. */
  readonly frameRef?: RefObject<HTMLDivElement | null>
}

type MirrorCardLayout = {
  readonly card: ShareCardV2
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Compute simple column-stack layout for mirror. Same skyline philosophy
 *  as bg board, but bounded to 1200 width with smaller card widths.
 *
 *  Returns positions + total world height. The mirror viewport scrolls
 *  within this world via bg-board-proportional scrollY. */
function layoutMirrorCards(
  cards: ReadonlyArray<ShareCardV2>,
  frameWidth: number,
  cardWidth: number,
  gap: number,
): { positions: ReadonlyArray<MirrorCardLayout>; worldHeight: number } {
  const cols = Math.max(1, Math.floor((frameWidth + gap) / (cardWidth + gap)))
  const colHeights = new Array<number>(cols).fill(0)
  const positions: MirrorCardLayout[] = []

  for (const card of cards) {
    const cardHeight = cardWidth / Math.max(0.5, card.a)
    let minCol = 0
    for (let c = 1; c < cols; c++) {
      if (colHeights[c] < colHeights[minCol]) minCol = c
    }
    const x = minCol * (cardWidth + gap)
    const y = colHeights[minCol]
    positions.push({ card, x, y, w: cardWidth, h: cardHeight })
    colHeights[minCol] = y + cardHeight + gap
  }

  const worldHeight = Math.max(...colHeights, MIRROR_FRAME_HEIGHT)
  return { positions, worldHeight }
}

export function ShareMirror({
  shareData,
  activeTagNames,
  totalBoardCount,
  scrollY,
  contentHeight,
  viewportHeight,
  frameRef,
}: Props): ReactElement {
  const { positions, worldHeight } = useMemo(
    () => layoutMirrorCards(shareData.cards, MIRROR_FRAME_WIDTH, MIRROR_CARD_WIDTH, MIRROR_GAP),
    [shareData.cards],
  )

  // Proportional scroll: bg progress 0..1 maps to mirror progress 0..1.
  // Mirror frame height in CSS px is approximated to ESTIMATED_FRAME_CSS_HEIGHT
  // (refined in implementation via ResizeObserver if needed — see spec G3).
  const ESTIMATED_FRAME_CSS_HEIGHT = 220
  const bgScrollMax = Math.max(1, contentHeight - viewportHeight)
  const progress = Math.max(0, Math.min(1, scrollY / bgScrollMax))
  const mirrorScrollMax = Math.max(0, worldHeight - ESTIMATED_FRAME_CSS_HEIGHT)
  const mirrorScrollY = progress * mirrorScrollMax

  const N = shareData.cards.length
  const M = totalBoardCount
  const captionText = M > N ? `${N} OF ${M} CARDS · NEWEST FIRST` : `${N} CARDS`
  const tagText = activeTagNames.map((s): string => s.toUpperCase()).join(' · ')

  return (
    <div className={styles.frame} ref={frameRef} data-testid="mirror-frame">
      {activeTagNames.length > 0 ? (
        <div className={styles.tagStrip} data-testid="mirror-tag-strip">{tagText}</div>
      ) : null}

      <div
        className={styles.cardsLayer}
        data-testid="mirror-cards-layer"
        style={{
          transformOrigin: '0 0',
          transform: `translateY(${-mirrorScrollY}px)`,
        }}
      >
        {positions.map((p): ReactElement => (
          <div
            key={p.card.u}
            className={styles.card}
            data-mirror-card-id={p.card.u}
            style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
          >
            {p.card.th ? (
              <img
                src={p.card.th}
                alt=""
                className={styles.cardThumb}
                crossOrigin="anonymous"
                loading="eager"
                draggable={false}
              />
            ) : null}
            <div className={styles.cardTitle}>{p.card.t}</div>
          </div>
        ))}
      </div>

      <div className={styles.bottomStrip}>
        <svg className={styles.brandLogo} viewBox="0 0 32 32" aria-hidden="true">
          <path d="M5.76 26.88L16 3.2l10.24 23.68" stroke="rgba(255,255,255,0.94)" strokeWidth="2.56" fill="none" strokeLinecap="square"/>
          <path d="M10.56 18.56h10.88" stroke="rgba(255,255,255,0.94)" strokeWidth="2.56" fill="none" strokeLinecap="square"/>
          <path d="M19.84 23.68l3.2 3.2 5.76-7.04" stroke="#28F100" strokeWidth="1.92" fill="none" strokeLinecap="square" strokeLinejoin="miter"/>
        </svg>
        <span className={styles.caption}>
          <span className={styles.captionDot} aria-hidden="true" />
          {captionText}
        </span>
      </div>
    </div>
  )
}
```

注意: cardsLayer はスケール変換を持たず、 card 座標はそのまま CSS px。 frame の `aspect-ratio: 1.91/1` + `overflow: hidden` で視覚的に切り取られる。 mirror world は CSS px 直接、 OG canvas (1200×628) への変換は capture-mirror.ts の `getBoundingClientRect()` ベース計算で行う。 `ESTIMATED_FRAME_CSS_HEIGHT = 220` は modal 中で 720 panel × 1.91:1 ≈ 220 を仮置き、 ResizeObserver による動的取得は spec G3 のリスクとして実装フェーズで再評価。

- [ ] **Step 3.5: テストが pass することを確認する**

Run: `pnpm vitest run components/share/ShareMirror.test.tsx`
Expected: PASS — 7 tests pass

- [ ] **Step 3.6: tsc を通す**

Run: `pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3.7: commit**

```bash
rtk git add components/share/ShareMirror.tsx components/share/ShareMirror.module.css components/share/ShareMirror.test.tsx
rtk git commit -m "$(cat <<'EOF'
feat(share): add ShareMirror component for live board preview

1.91:1 aspect frame with MOTION-OFF visual style (no iframes,
no videos, just thumbnails + titles). Skyline-style column stack
layout. Proportional scroll sync via bg scrollY. Brand strip
top (tags) + bottom (logo + N CARDS) baked in for capture.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: SenderShareModal 再設計 (= ミラー埋込 + 確定ボタン + capture-mirror 配線)

**Files:**
- Modify: `components/share/SenderShareModal.tsx`
- Modify: `components/share/SenderShareModal.module.css`
- Modify: `components/share/SenderShareModal.test.tsx`

**目的:** SHARE 押下時の挙動を「自動キャプチャ + 即 KV 書込」 から「ミラー表示 + 確定ボタンで初めてキャプチャ + KV 書込」 に変更する。 placeholder snapshot (= 旧 captureViewportWebP) を撤去、 新 capture-mirror.ts に置換。

- [ ] **Step 4.1: 既存テストを確認して破壊範囲を把握する**

Run: `pnpm vitest run components/share/SenderShareModal.test.tsx`
Expected: 既存テスト現状の PASS 数を控える (= 後の verify 比較用)

- [ ] **Step 4.2: 新仕様のテストを書く (= 既存テスト改修)**

`components/share/SenderShareModal.test.tsx` 全置換:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor, act } from '@testing-library/react'
import { SenderShareModal } from './SenderShareModal'
import { SHARE_SCHEMA_VERSION_V2, type ShareDataV2 } from '@/lib/share/types-v2'

vi.mock('@/lib/share/api-client', () => ({
  createShare: vi.fn(),
}))
vi.mock('@/lib/share/capture-mirror', () => ({
  captureMirrorToWebP: vi.fn(),
}))

import { createShare } from '@/lib/share/api-client'
import { captureMirrorToWebP } from '@/lib/share/capture-mirror'

function makeShare(n: number): ShareDataV2 {
  return {
    v: SHARE_SCHEMA_VERSION_V2,
    cards: Array.from({ length: n }, (_, i) => ({
      u: `https://example.com/c${i}`, t: `c${i}`, ty: 'website' as const, cw: 240, a: 1.6,
    })),
    createdAt: Date.now(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SenderShareModal', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <SenderShareModal
        open={false}
        onClose={vi.fn()}
        getShareData={() => makeShare(3)}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders mirror + SHARE confirm button when open', () => {
    const { getByText, queryByTestId } = render(
      <SenderShareModal
        open={true}
        onClose={vi.fn()}
        getShareData={() => makeShare(5)}
        totalBoardCount={5}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
      />,
    )
    expect(queryByTestId('mirror-frame')).toBeTruthy()
    expect(getByText(/SHARE NOW/i)).toBeTruthy()
  })

  it('on SHARE NOW click: captures + createShare', async () => {
    vi.mocked(captureMirrorToWebP).mockResolvedValue('data:image/webp;base64,XXXX')
    vi.mocked(createShare).mockResolvedValue({
      ok: true,
      data: { id: 'abc123', expiresAt: Date.now() + 1000 * 86400 },
    })

    const { getByText, findByText } = render(
      <SenderShareModal
        open={true}
        onClose={vi.fn()}
        getShareData={() => makeShare(3)}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
      />,
    )
    await act(async () => {
      fireEvent.click(getByText(/SHARE NOW/i))
    })
    await waitFor(() => {
      expect(captureMirrorToWebP).toHaveBeenCalled()
      expect(createShare).toHaveBeenCalled()
    })
    await findByText(/COPY/)  // URL row appears
  })

  it('shows error state when capture returns null', async () => {
    vi.mocked(captureMirrorToWebP).mockResolvedValue(null)
    const { getByText, findByText } = render(
      <SenderShareModal
        open={true}
        onClose={vi.fn()}
        getShareData={() => makeShare(3)}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
      />,
    )
    await act(async () => {
      fireEvent.click(getByText(/SHARE NOW/i))
    })
    expect(await findByText(/⚠/)).toBeTruthy()
  })

  it('ESC closes modal', () => {
    const onClose = vi.fn()
    render(
      <SenderShareModal
        open={true}
        onClose={onClose}
        getShareData={() => makeShare(3)}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
      />,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('backdrop click closes modal', () => {
    const onClose = vi.fn()
    const { container } = render(
      <SenderShareModal
        open={true}
        onClose={onClose}
        getShareData={() => makeShare(3)}
        totalBoardCount={3}
        scrollY={0}
        contentHeight={1000}
        viewportHeight={800}
        activeTagNames={[]}
      />,
    )
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 4.3: テストが fail することを確認する**

Run: `pnpm vitest run components/share/SenderShareModal.test.tsx`
Expected: FAIL — `getCanvasElement is not a function` 等の prop ミスマッチ

- [ ] **Step 4.4: SenderShareModal 本体を書き換える**

`components/share/SenderShareModal.tsx` 全置換:

```typescript
'use client'
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { ShareDataV2 } from '@/lib/share/types-v2'
import styles from './SenderShareModal.module.css'
import { captureMirrorToWebP } from '@/lib/share/capture-mirror'
import { createShare } from '@/lib/share/api-client'
import { ShareMirror } from './ShareMirror'

type ModalState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'capturing' }
  | { readonly kind: 'ready'; readonly shareUrl: string }
  | { readonly kind: 'error'; readonly message: string }

type Props = {
  readonly open: boolean
  readonly onClose: () => void
  /** Lazy accessor: called when SHARE confirm pressed to build the share payload. */
  readonly getShareData: () => ShareDataV2
  /** Total cards visible in current board view (= filteredItems.length). */
  readonly totalBoardCount: number
  /** Bg board's current scrollY (= viewport.y). For mirror sync scroll. */
  readonly scrollY: number
  /** Bg board's full scrollable height (= contentBounds.height). */
  readonly contentHeight: number
  /** Bg board's viewport height (= viewport.h). */
  readonly viewportHeight: number
  /** Active filter tag names for mirror top strip. Empty = no filter. */
  readonly activeTagNames: ReadonlyArray<string>
}

export function SenderShareModal({
  open,
  onClose,
  getShareData,
  totalBoardCount,
  scrollY,
  contentHeight,
  viewportHeight,
  activeTagNames,
}: Props): ReactElement | null {
  const [state, setState] = useState<ModalState>({ kind: 'idle' })
  const [copied, setCopied] = useState<boolean>(false)
  const mirrorFrameRef = useRef<HTMLDivElement | null>(null)

  // ESC handler
  useEffect((): (() => void) | undefined => {
    if (!open) return undefined
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset state on close
  useEffect((): void => {
    if (!open) setState({ kind: 'idle' })
  }, [open])

  const handleBackdrop = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  const handleShareConfirm = useCallback(async (): Promise<void> => {
    setState({ kind: 'capturing' })
    try {
      const share = getShareData()
      const thumbDataUrl = await captureMirrorToWebP({
        mirrorFrame: mirrorFrameRef.current,
        shareData: share,
        activeTagNames,
        totalBoardCount,
        width: 1200,
        height: 628,
        quality: 0.85,
      })
      if (!thumbDataUrl) {
        setState({ kind: 'error', message: 'capture failed' })
        return
      }
      const result = await createShare({ share, thumb: thumbDataUrl })
      if (!result.ok) {
        setState({ kind: 'error', message: result.message })
        return
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://allmarks.app'
      const shareUrl = `${origin}/s/${result.data.id}`
      setState({ kind: 'ready', shareUrl })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'unknown error' })
    }
  }, [getShareData, activeTagNames, totalBoardCount])

  if (!open) return null

  const shareData = getShareData()

  return (
    <div className={styles.backdrop} onClick={handleBackdrop}>
      <div className={styles.panel} role="dialog" aria-label="Share board">
        <header className={styles.header}>
          <span className={styles.title}>SHARE BOARD</span>
          <button type="button" className={styles.closeIcon} onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className={styles.preview}>
          <ShareMirror
            shareData={shareData}
            activeTagNames={activeTagNames}
            totalBoardCount={totalBoardCount}
            scrollY={scrollY}
            contentHeight={contentHeight}
            viewportHeight={viewportHeight}
            frameRef={mirrorFrameRef}
          />
        </div>

        <p className={styles.hint}>
          SCROLL TO POSITION · PRESS SHARE NOW WHEN READY
        </p>

        <div className={styles.actions}>
          {state.kind === 'ready' ? (
            <>
              <div className={styles.urlRow}>
                <code className={styles.url}>{state.shareUrl}</code>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={(): void => {
                    void navigator.clipboard.writeText(state.shareUrl).then((): void => {
                      setCopied(true)
                      setTimeout((): void => setCopied(false), 1500)
                    })
                  }}
                >{copied ? 'COPIED' : 'COPY'}</button>
              </div>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={(): void => {
                  const intent = `https://twitter.com/intent/tweet?url=${encodeURIComponent(state.shareUrl)}`
                  window.open(intent, '_blank', 'noopener,noreferrer')
                }}
              >POST TO X</button>
            </>
          ) : state.kind === 'error' ? (
            <>
              <code className={styles.url} style={{ color: '#ff8888' }}>⚠ {state.message}</code>
              <button type="button" className={styles.primaryBtn} onClick={handleShareConfirm}>RETRY</button>
            </>
          ) : (
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={state.kind === 'capturing'}
              onClick={handleShareConfirm}
            >{state.kind === 'capturing' ? 'CAPTURING…' : 'SHARE NOW'}</button>
          )}

          <button type="button" className={styles.secondaryBtn} onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4.5: CSS を更新する**

`components/share/SenderShareModal.module.css` の `.panel` 幅と `.preview` を以下に変更:

```css
.panel {
  position: relative;
  width: min(720px, calc(100vw - 32px));   /* ← 480 → 720 (= mirror 用に拡張) */
  background: rgba(8, 8, 10, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 0;
  color: rgba(255, 255, 255, 0.92);
  font-family: 'Geist Mono', monospace;
  animation: slideUp 100ms ease-out;
  overflow: hidden;
}
```

そして新規 `.hint` クラスを追加 (= `.meta` の代替、 SHARE 前のガイダンス用):

```css
.hint {
  margin: 0 18px 14px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.42);
  text-align: center;
}
```

(`.meta` は使わなくなるが残しておく — 後で必要になる可能性あり)

- [ ] **Step 4.6: テストが pass することを確認する**

Run: `pnpm vitest run components/share/SenderShareModal.test.tsx`
Expected: PASS — 6 tests pass

- [ ] **Step 4.7: 全テストが壊れてないか確認 + tsc**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: ALL PASS, 0 tsc errors。 BoardRoot がまだ旧 prop で渡してるので一時的に build エラーになる可能性あり — Task 5 で配線する

- [ ] **Step 4.8: commit (= Task 5 と並行 commit でも OK だが分けたほうが review しやすい)**

```bash
rtk git add components/share/SenderShareModal.tsx components/share/SenderShareModal.module.css components/share/SenderShareModal.test.tsx
rtk git commit -m "$(cat <<'EOF'
feat(share): redesign SenderShareModal with embedded mirror + confirm flow

Replaces auto-capture-on-open with explicit SHARE NOW button.
Modal now embeds ShareMirror (1.91:1 live preview) and waits for
user to scroll into desired frame before capturing. Capture uses
new capture-mirror.ts. Panel width grown 480 -> 720 to fit mirror.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: BoardRoot 配線 (= scrollY 系 prop を SenderShareModal に渡す)

**Files:**
- Modify: `components/board/BoardRoot.tsx`

**目的:** SenderShareModal が新規 prop (`scrollY`, `contentHeight`, `viewportHeight`, `activeTagNames`) を要求するようになったので、 BoardRoot から渡す。 既存の `viewport.y` / `contentBounds.height` / `viewport.h` / アクティブ tag 名計算 を流用。

- [ ] **Step 5.1: 既存 SenderShareModal 呼び出し箇所を grep する**

Run: `rg "SenderShareModal" components/board/BoardRoot.tsx`
Expected: 1〜3 行 (= JSX 配置箇所 + import)

- [ ] **Step 5.2: 該当箇所の前後を read で確認する**

Read [components/board/BoardRoot.tsx](../../../components/board/BoardRoot.tsx) で `SenderShareModal` を探し、 周辺の prop 渡しを把握 (= 現状は `getShareData` / `getCanvasElement` / `totalBoardCount`)。

- [ ] **Step 5.3: prop を新しい形に書き換える**

`SenderShareModal` の JSX 呼出を以下に置換:

```typescript
<SenderShareModal
  open={shareModalOpen}
  onClose={(): void => setShareModalOpen(false)}
  getShareData={(): ShareDataV2 => buildShareDataFromBoard({
    filteredItems,
    tags: allTags,
    filter,
  })}
  totalBoardCount={filteredItems.length}
  scrollY={viewport.y}
  contentHeight={contentBounds.height}
  viewportHeight={viewport.h}
  activeTagNames={isTagsFilter(filter)
    ? filter.tagIds.flatMap((id): string[] => {
        const tag = allTags.find((t) => t.id === id)
        return tag ? [tag.name] : []
      })
    : []}
/>
```

注意: `filteredItems` / `allTags` / `filter` / `viewport` / `contentBounds` / `buildShareDataFromBoard` / `isTagsFilter` は BoardRoot 内で既に存在する。 import 漏れがあれば追加。 `getCanvasElement` prop は削除。

- [ ] **Step 5.4: build + tsc を通す**

Run: `pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5.5: 全体テスト**

Run: `pnpm vitest run`
Expected: 全 PASS (= 既存 + 新規)

- [ ] **Step 5.6: commit**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "$(cat <<'EOF'
feat(board): wire SenderShareModal new props (scrollY, contentHeight, activeTagNames)

ShareMirror inside the modal needs bg board scroll state to render
the proportional mini-view. BoardRoot now passes viewport.y,
contentBounds.height, viewport.h, and active tag names derived from
the current filter.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: snapshot.ts と関連 test を削除する

**Files:**
- Delete: `lib/share/snapshot.ts`
- Delete: `lib/share/snapshot.test.ts`

**目的:** Task 4 で `captureViewportWebP` 呼び出しを `captureMirrorToWebP` に置換した結果、 旧 snapshot.ts は dead code に。 削除する。

- [ ] **Step 6.1: import が残っていないか確認**

Run: `rg "snapshot" --type ts --type tsx`
Expected: matches があれば lib/share 以外で残ってる import や reference を全部書き換える。 通常は Task 4 で全て消えてるはず

- [ ] **Step 6.2: 削除**

Run:
```bash
rm lib/share/snapshot.ts lib/share/snapshot.test.ts
```

- [ ] **Step 6.3: tsc + vitest で確認**

Run: `pnpm tsc --noEmit && pnpm vitest run`
Expected: 0 errors, ALL PASS

- [ ] **Step 6.4: commit**

```bash
rtk git add -A lib/share/
rtk git commit -m "$(cat <<'EOF'
chore(share): remove placeholder snapshot.ts (replaced by capture-mirror)

session 85 placeholder was a static brand image. Now superseded by
ShareMirror + captureMirrorToWebP which renders the actual board.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: ローカル + preview 検証 → 本番デプロイ

**Files:** (no file changes, verification only)

**目的:** dev で動作確認、 preview deploy で X カードを実 URL で検証、 本番デプロイ。

- [ ] **Step 7.1: dev サーバ起動 + manual smoke test**

Run: `pnpm dev`

ブラウザで `http://localhost:3000/board` を開いて以下を順に確認:

1. SHARE ボタンを押す → モーダルが開く + ミラーが見える
2. モーダル内に **iframe / video / audio が映ってない** こと (= devtools で `<iframe>` count = 0)
3. 背景でホイールスクロール → 背景とミラーが同期して動く (= 視覚的に確認)
4. SHARE NOW 押す → CAPTURING… → URL が表示される
5. URL を新タブで開く → 受信ページに飛ぶ
6. iframe 再生音が SHARE NOW 押下時に鳴らないこと (= 耳で確認)

ここで unexpected な動作があれば、 該当 Task に戻って修正 + commit。

- [ ] **Step 7.2: 全テスト最終 + tsc**

Run: `pnpm tsc --noEmit && pnpm vitest run`
Expected: 0 errors, ALL PASS

- [ ] **Step 7.3: production build**

Run: `pnpm build`
Expected: ビルド成功、 out/ に static export 出力、 0 errors

- [ ] **Step 7.4: preview deploy**

Run:
```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=preview-share-mirror --commit-dirty=true --commit-message="preview share mirror capture"
```

deploy log の preview URL (= `xxxx.booklage.pages.dev`) を取得。

- [ ] **Step 7.5: preview URL で動作確認**

1. preview URL の `/board` で SHARE → モーダル → ミラー → SHARE NOW → URL 取得
2. その URL を自分の X アカウントで draft tweet に貼る (= ツイートはしなくて OK、 プレビューカード表示だけ確認)
3. summary_large_image が出ること
4. カードクリック (= タイトル/画像エリア) で受信ページに飛ぶこと

OG が壊れている場合: 該当 Task に戻る (= 多くは Task 1 OG proxy のレスポンス内容バグ、 または patch-share-html.ts の og:image URL ミスマッチ)。

- [ ] **Step 7.6: 本番デプロイ**

Run:
```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="ship share mirror capture"
```

- [ ] **Step 7.7: 本番動作確認**

`https://booklage.pages.dev/board` をハードリロードして、 Step 7.1 と同じフローを本番で 1 度実行。

- [ ] **Step 7.8: TODO.md / CURRENT_GOAL.md / TODO_COMPLETED.md 更新 + commit**

session 86 の完遂内容を記録。 narrative は TODO_COMPLETED.md、 状態は TODO.md「現在の状態」、 次セッションのゴールは CURRENT_GOAL.md。

Run:
```bash
rtk git add docs/TODO.md docs/CURRENT_GOAL.md docs/TODO_COMPLETED.md
rtk git commit -m "$(cat <<'EOF'
docs(session-86): close-out — share mirror capture shipped

- ShareMirror live preview in modal
- canvas-based capture (replaces dom-to-image-more)
- OG proxy Pages Function
- placeholder snapshot.ts removed

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
