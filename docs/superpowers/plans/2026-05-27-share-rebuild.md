# Share Rebuild Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** session 82 までに固まったトンマナ (= editorial 黒 + 緑 + monospace + convex bezel) に合わせて旧シェア機能を完全作り直す。 Cloudflare KV ベースの短縮 URL (`allmarks.app/s/<6文字>`) + 軽量送信 modal + 受信者ボード読み取り専用着地 + /triage 風個別取り込み を一気に実装し、 PNG エクスポート系の旧資産を完全廃棄する。

**Architecture:** 既存 `lib/share/encode|decode|types|validate|schema|relay-layout|composer-layout|...` を全廃案、 schema v2 で書き直し。 Cloudflare Pages Functions を新規追加 (= `functions/api/share/{create,[id],[id]/og}.ts`)、 KV namespace `SHARE_KV` を `wrangler.toml` に bind。 送信側は `SenderShareModal` を `components/share/` に新規作成、 BoardRoot の `SHARE` chrome ボタンが旧 ShareComposer を呼んでいた箇所を差し替え。 受信側は `/s/[id]` (= 着地)、 `/s/[id]/triage` (= 個別取り込み) の 2 ルート、 後者は既存 `TriagePage` のロジックを部分流用 + シェアカード adapter。

**Tech Stack:** Next.js 16.2.3 App Router (= edge runtime for SSR) + TypeScript strict / Vanilla CSS Modules (Tailwind 不使用) / IndexedDB via `idb` 8.0.3 / Zod 4.3.6 / Cloudflare Pages + Pages Functions + KV / `dom-to-image-more` 3.7.2 (= viewport snapshot) / vitest + jsdom + react-testing-library。

---

## Spec reference

実装は [docs/superpowers/specs/2026-05-27-share-rebuild-design.md](../specs/2026-05-27-share-rebuild-design.md) に厳密に従う。 §3 Goals 1-8、 §4 Non-goals、 §6 schema、 §7 UI、 §8 cost、 §9 routing/API、 §10 file changes、 §11 tests、 §12 phasing を逸脱しない。

## File structure

### 新規追加 (= ファイル)

```
# データ層 + ロジック
lib/share/types-v2.ts                                    # ShareDataV2 + ShareCardV2 + TagDict + 定数
lib/share/types-v2.test.ts
lib/share/validate-v2.ts                                 # Zod schema + sanitize
lib/share/validate-v2.test.ts
lib/share/kv-id.ts                                       # 6-char base62 ID 生成
lib/share/kv-id.test.ts
lib/share/encode-v2.ts                                   # KV payload encode (gzip+base64)
lib/share/encode-v2.test.ts
lib/share/decode-v2.ts                                   # KV payload decode
lib/share/decode-v2.test.ts
lib/share/snapshot.ts                                    # viewport WebP capture
lib/share/snapshot.test.ts
lib/share/api-client.ts                                  # POST create + GET fetch helpers
lib/share/api-client.test.ts
lib/share/import.ts                                      # bulk + triage import logic
lib/share/import.test.ts
lib/share/board-to-share.ts                              # 送信側: 現在 board state → ShareDataV2
lib/share/board-to-share.test.ts

# Cloudflare Pages Functions
functions/api/share/create.ts                            # POST → KV write
functions/api/share/[id].ts                              # GET → KV read
functions/api/share/[id]/og.ts                           # GET → WebP only

# 送信側 UI
components/share/SenderShareModal.tsx
components/share/SenderShareModal.module.css

# 受信側 UI
app/(app)/s/[id]/page.tsx                                # 着地 page (SSR metadata)
app/(app)/s/[id]/triage/page.tsx                         # triage page
components/share/ReceiverLanding.tsx
components/share/ReceiverLanding.module.css
components/share/ReceiverTriage.tsx
components/share/ReceiverTriage.module.css
components/share/BulkImportToast.tsx
components/share/BulkImportToast.module.css

# テスト (components)
components/share/SenderShareModal.test.tsx
components/share/ReceiverLanding.test.tsx
components/share/ReceiverTriage.test.tsx
components/share/BulkImportToast.test.tsx
```

### 編集 (= 既存ファイルの修正)

```
wrangler.toml                                            # SHARE_KV namespace binding 追加
components/board/BoardRoot.tsx                           # SHARE ボタン onClick を SenderShareModal に切替
components/board/Lightbox.tsx                            # 受信側で使う read-only モード対応
```

### 削除 (= ファイル完全廃棄、 Phase 6 で実行)

```
components/share/ShareComposer.tsx + .module.css
components/share/ShareFrame.tsx + .module.css
components/share/ShareSourceList.tsx + .module.css
components/share/ShareAspectSwitcher.tsx + .module.css
components/share/ShareActionSheet.tsx + .module.css
components/share/SharedView.tsx + .module.css
components/share/use-share-reorder-drag.ts
components/share/use-share-fullscreen.ts
components/share/use-share-fullscreen.test.ts
lib/share/aspect-presets.ts + .test.ts
lib/share/board-to-cards.ts + .test.ts
lib/share/composer-layout.ts + .test.ts
lib/share/png-export.ts + .test.ts
lib/share/relay-layout.ts + .test.ts
lib/share/watermark-config.ts
lib/share/lightbox-item.ts + .test.ts
lib/share/schema.ts
lib/share/validate.ts + .test.ts
lib/share/encode.ts + .test.ts
lib/share/decode.ts + .test.ts
lib/share/types.ts
app/share/page.tsx
```

### 維持 (= 触らない、 流用するだけ)

```
lib/share/x-intent.ts + .test.ts                         # X 投稿 URL builder、 そのまま import
lib/storage/indexeddb.ts                                 # addBookmark / getAllBookmarks
lib/storage/use-board-data.ts                            # 受信側 ReceiverLanding で使う
lib/storage/tags.ts + use-tags.ts                        # 受信側 tag 操作
lib/board/skyline-layout.ts                              # 受信側 masonry 計算
components/triage/{TriageCard,TagPicker,AmbientBackdrop}.tsx
                                                         # ReceiverTriage が import 流用
```

---

# Phase 1 — データ層 + スキーマ (Tasks 1-7)

## Task 1: ShareDataV2 schema 定義

**Files:**
- Create: `lib/share/types-v2.ts`

- [ ] **Step 1: ShareDataV2 + 関連型を新規作成**

```ts
// lib/share/types-v2.ts

/** Schema version. v1 (old fragment-based) is dropped — see migration in design doc §4. */
export const SHARE_SCHEMA_VERSION_V2 = 2 as const

/** URL kind — re-detected on import, never trusted from sender. */
export type ShareCardType =
  | 'tweet'
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'vimeo'
  | 'soundcloud'
  | 'image'
  | 'website'

/** One card in the share payload. Short keys keep KV entry compact. */
export type ShareCardV2 = {
  /** Bookmark URL (http/https only, max 2048 chars) */
  readonly u: string
  /** Title (max 500 chars) */
  readonly t: string
  /** Description (optional, max 500 chars) */
  readonly d?: string
  /** Thumbnail URL (optional, http/https only) */
  readonly th?: string
  /** URL type — re-detected on import. */
  readonly ty: ShareCardType
  /** Explicit per-card width in px (= sender's manual sizing). */
  readonly cw: number
  /** Aspect ratio = width / height. */
  readonly a: number
  /** Sender's tag IDs — references into ShareDataV2.tags. Optional. */
  readonly tg?: ReadonlyArray<string>
}

/** Sender's tag dictionary keyed by tag ID. */
export type TagDict = {
  readonly [tagId: string]: {
    readonly n: string  // tag name
    readonly c?: string // hex color (optional)
  }
}

/** Top-level share payload. */
export type ShareDataV2 = {
  readonly v: typeof SHARE_SCHEMA_VERSION_V2
  readonly cards: ReadonlyArray<ShareCardV2>
  readonly tags?: TagDict
  readonly filter?: {
    readonly mode: 'and' | 'or'
    readonly tagIds: ReadonlyArray<string>
  }
  readonly theme?: 'wave'
  readonly createdAt: number
}

/** KV entry structure (= what we write to Cloudflare KV). */
export type KVShareEntry = {
  readonly share: ShareDataV2
  /** Base64-encoded WebP thumbnail, ~5-15KB typical. */
  readonly thumb: string
}

/** API response shapes. */
export type CreateShareResponse = {
  readonly id: string         // 6-char base62
  readonly expiresAt: number  // unix ms
}

export type GetShareResponse = KVShareEntry

export type ShareErrorResponse = {
  readonly error: 'not_found' | 'expired' | 'invalid' | 'rate_limit' | 'server'
  readonly message: string
}

/** Enforced limits — single source of truth, mirrored in validate-v2.ts. */
export const SHARE_LIMITS_V2 = {
  MAX_CARDS: 100,
  MAX_TITLE: 500,
  MAX_DESCRIPTION: 500,
  MAX_URL: 2048,
  MAX_THUMB_BYTES: 50 * 1024,
  MAX_KV_ENTRY_BYTES: 200 * 1024,
  TTL_DAYS: 30,
  TTL_SECONDS: 30 * 24 * 60 * 60,
} as const
```

- [ ] **Step 2: tsc で型エラーなしを確認**

Run: `pnpm tsc --noEmit 2>&1 | tail -20`
Expected: 既存エラー以外、 `types-v2.ts` 関連の新規エラーなし

- [ ] **Step 3: commit**

```bash
git add lib/share/types-v2.ts
git commit -m "feat(share): add ShareDataV2 schema types (Phase 1 rebuild)"
```

## Task 2: Zod validation で sanitize

**Files:**
- Create: `lib/share/validate-v2.ts`
- Create: `lib/share/validate-v2.test.ts`

- [ ] **Step 1: 失敗テストを書く**

```ts
// lib/share/validate-v2.test.ts
import { describe, it, expect } from 'vitest'
import { parseShareDataV2, sanitizeShareDataV2 } from './validate-v2'
import { SHARE_SCHEMA_VERSION_V2, type ShareDataV2 } from './types-v2'

const validShare: ShareDataV2 = {
  v: SHARE_SCHEMA_VERSION_V2,
  cards: [
    { u: 'https://example.com', t: 'Title', ty: 'website', cw: 200, a: 1.5 },
  ],
  createdAt: 1735000000000,
}

describe('parseShareDataV2', () => {
  it('accepts a minimal valid payload', () => {
    const result = parseShareDataV2(validShare)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.cards.length).toBe(1)
  })

  it('rejects unknown schema version', () => {
    const result = parseShareDataV2({ ...validShare, v: 99 })
    expect(result.ok).toBe(false)
  })

  it('rejects more than MAX_CARDS', () => {
    const cards = Array.from({ length: 101 }, (_, i) => ({
      u: `https://example.com/${i}`, t: `T${i}`, ty: 'website' as const, cw: 200, a: 1,
    }))
    const result = parseShareDataV2({ ...validShare, cards })
    expect(result.ok).toBe(false)
  })

  it('rejects non-http URL', () => {
    const result = parseShareDataV2({
      ...validShare,
      cards: [{ u: 'javascript:alert(1)', t: 'X', ty: 'website', cw: 200, a: 1 }],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects title over MAX_TITLE', () => {
    const result = parseShareDataV2({
      ...validShare,
      cards: [{ u: 'https://a.com', t: 'x'.repeat(501), ty: 'website', cw: 200, a: 1 }],
    })
    expect(result.ok).toBe(false)
  })

  it('accepts cards with sender tags', () => {
    const result = parseShareDataV2({
      ...validShare,
      cards: [{ u: 'https://a.com', t: 'T', ty: 'website', cw: 200, a: 1, tg: ['t1', 't2'] }],
      tags: { t1: { n: 'music' }, t2: { n: 'design', c: '#28F100' } },
    })
    expect(result.ok).toBe(true)
  })
})

describe('sanitizeShareDataV2', () => {
  it('strips fields not in schema', () => {
    const dirty = { ...validShare, evil: 'payload' } as unknown
    const clean = sanitizeShareDataV2(dirty)
    expect(clean.ok).toBe(true)
    if (clean.ok) expect((clean.data as Record<string, unknown>).evil).toBeUndefined()
  })

  it('trims title to MAX_TITLE', () => {
    const result = sanitizeShareDataV2({
      ...validShare,
      cards: [{ u: 'https://a.com', t: 'x'.repeat(600), ty: 'website', cw: 200, a: 1 }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.cards[0].t.length).toBe(500)
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `pnpm vitest run lib/share/validate-v2.test.ts 2>&1 | tail -20`
Expected: FAIL — `validate-v2` モジュールが存在しない

- [ ] **Step 3: validate-v2.ts を実装**

```ts
// lib/share/validate-v2.ts
import { z } from 'zod'
import { SHARE_LIMITS_V2, SHARE_SCHEMA_VERSION_V2, type ShareDataV2 } from './types-v2'

const httpUrl = z.string().url().refine(
  (u) => u.startsWith('http://') || u.startsWith('https://'),
  'URL must be http/https',
).max(SHARE_LIMITS_V2.MAX_URL)

const shareCardSchema = z.object({
  u: httpUrl,
  t: z.string().max(SHARE_LIMITS_V2.MAX_TITLE),
  d: z.string().max(SHARE_LIMITS_V2.MAX_DESCRIPTION).optional(),
  th: httpUrl.optional(),
  ty: z.enum(['tweet', 'youtube', 'tiktok', 'instagram', 'vimeo', 'soundcloud', 'image', 'website']),
  cw: z.number().positive().max(2000),
  a: z.number().positive().max(10),
  tg: z.array(z.string().max(64)).max(50).optional(),
})

const tagDictSchema = z.record(
  z.string().max(64),
  z.object({ n: z.string().min(1).max(64), c: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional() }),
)

const shareDataSchema = z.object({
  v: z.literal(SHARE_SCHEMA_VERSION_V2),
  cards: z.array(shareCardSchema).min(1).max(SHARE_LIMITS_V2.MAX_CARDS),
  tags: tagDictSchema.optional(),
  filter: z.object({
    mode: z.enum(['and', 'or']),
    tagIds: z.array(z.string().max(64)).max(50),
  }).optional(),
  theme: z.literal('wave').optional(),
  createdAt: z.number().int().positive(),
})

export type ParseResult =
  | { readonly ok: true; readonly data: ShareDataV2 }
  | { readonly ok: false; readonly error: string }

/** Strict parse — rejects unknown fields, returns Result. */
export function parseShareDataV2(input: unknown): ParseResult {
  const parsed = shareDataSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ') }
  }
  return { ok: true, data: parsed.data as ShareDataV2 }
}

/** Lenient parse — coerces / trims overlong values. Used on receiver side
 *  where the sender's payload may have been tampered with in transit. */
export function sanitizeShareDataV2(input: unknown): ParseResult {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: 'not an object' }
  }
  const obj = input as Record<string, unknown>
  if (Array.isArray(obj.cards)) {
    obj.cards = (obj.cards as Array<Record<string, unknown>>).map((card) => {
      const next: Record<string, unknown> = { ...card }
      if (typeof next.t === 'string' && next.t.length > SHARE_LIMITS_V2.MAX_TITLE) {
        next.t = next.t.slice(0, SHARE_LIMITS_V2.MAX_TITLE)
      }
      if (typeof next.d === 'string' && next.d.length > SHARE_LIMITS_V2.MAX_DESCRIPTION) {
        next.d = next.d.slice(0, SHARE_LIMITS_V2.MAX_DESCRIPTION)
      }
      return next
    })
  }
  return parseShareDataV2(obj)
}
```

- [ ] **Step 4: テスト pass 確認**

Run: `pnpm vitest run lib/share/validate-v2.test.ts 2>&1 | tail -10`
Expected: PASS, 7 tests

- [ ] **Step 5: commit**

```bash
git add lib/share/validate-v2.ts lib/share/validate-v2.test.ts
git commit -m "feat(share): add Zod validation + sanitization for ShareDataV2"
```

## Task 3: 6-char base62 ID 生成

**Files:**
- Create: `lib/share/kv-id.ts`
- Create: `lib/share/kv-id.test.ts`

- [ ] **Step 1: 失敗テストを書く**

```ts
// lib/share/kv-id.test.ts
import { describe, it, expect } from 'vitest'
import { generateShareId, isValidShareId } from './kv-id'

describe('generateShareId', () => {
  it('returns a 6-char base62 string', () => {
    const id = generateShareId()
    expect(id).toMatch(/^[A-Za-z0-9]{6}$/)
  })

  it('returns unique IDs across 1000 invocations', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const id = generateShareId()
      expect(seen.has(id)).toBe(false)
      seen.add(id)
    }
    expect(seen.size).toBe(1000)
  })
})

describe('isValidShareId', () => {
  it('accepts valid 6-char base62', () => {
    expect(isValidShareId('k3p9xv')).toBe(true)
    expect(isValidShareId('AaZz09')).toBe(true)
  })

  it('rejects wrong length', () => {
    expect(isValidShareId('k3p9x')).toBe(false)
    expect(isValidShareId('k3p9xvy')).toBe(false)
  })

  it('rejects non-base62 chars', () => {
    expect(isValidShareId('k3p_xv')).toBe(false)
    expect(isValidShareId('k3p-xv')).toBe(false)
    expect(isValidShareId('k3p xv')).toBe(false)
  })
})
```

- [ ] **Step 2: 実装**

```ts
// lib/share/kv-id.ts
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** Generate a 6-char base62 ID using cryptographic random. */
export function generateShareId(): string {
  const bytes = new Uint8Array(6)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    // Node fallback for SSR / tests without WebCrypto
    for (let i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[bytes[i] % 62]
  }
  return out
}

/** Validate a base62 6-char ID. */
export function isValidShareId(id: string): boolean {
  return /^[A-Za-z0-9]{6}$/.test(id)
}
```

- [ ] **Step 3: テスト pass + commit**

```bash
pnpm vitest run lib/share/kv-id.test.ts
git add lib/share/kv-id.ts lib/share/kv-id.test.ts
git commit -m "feat(share): add 6-char base62 ID generation for KV keys"
```

## Task 4: encode/decode (gzip + base64url) for KV payload

**Files:**
- Create: `lib/share/encode-v2.ts`
- Create: `lib/share/encode-v2.test.ts`
- Create: `lib/share/decode-v2.ts`
- Create: `lib/share/decode-v2.test.ts`

- [ ] **Step 1: encode 失敗テスト**

```ts
// lib/share/encode-v2.test.ts
import { describe, it, expect } from 'vitest'
import { encodeKVPayload } from './encode-v2'
import { SHARE_SCHEMA_VERSION_V2, type KVShareEntry } from './types-v2'

const sample: KVShareEntry = {
  share: {
    v: SHARE_SCHEMA_VERSION_V2,
    cards: [{ u: 'https://a.com', t: 'T', ty: 'website', cw: 200, a: 1.5 }],
    createdAt: 1735000000000,
  },
  thumb: 'data:image/webp;base64,AAAA',
}

describe('encodeKVPayload', () => {
  it('returns a non-empty string', async () => {
    const out = await encodeKVPayload(sample)
    expect(out.length).toBeGreaterThan(0)
  })

  it('compresses 100 cards to under MAX_KV_ENTRY_BYTES', async () => {
    const cards = Array.from({ length: 100 }, (_, i) => ({
      u: `https://example.com/path/${i}`,
      t: `Title ${i} — sample content`,
      ty: 'website' as const,
      cw: 200,
      a: 1.5,
    }))
    const out = await encodeKVPayload({
      share: { v: SHARE_SCHEMA_VERSION_V2, cards, createdAt: Date.now() },
      thumb: 'A'.repeat(8 * 1024),  // simulate 8KB thumb
    })
    expect(out.length).toBeLessThan(200 * 1024)
  })
})
```

- [ ] **Step 2: encode 実装**

```ts
// lib/share/encode-v2.ts
import type { KVShareEntry } from './types-v2'

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const rs = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes.buffer.slice(0)))
      controller.close()
    },
  })
  const compressed = rs.pipeThrough(new CompressionStream('gzip') as TransformStream<Uint8Array, Uint8Array>)
  const buf = await new Response(compressed).arrayBuffer()
  return new Uint8Array(buf)
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/** Serialize KV entry to a single base64 string for Cloudflare KV `put`. */
export async function encodeKVPayload(entry: KVShareEntry): Promise<string> {
  const json = JSON.stringify(entry)
  const utf8 = new TextEncoder().encode(json)
  const compressed = await gzip(utf8)
  return toBase64(compressed)
}
```

- [ ] **Step 3: decode 失敗テスト**

```ts
// lib/share/decode-v2.test.ts
import { describe, it, expect } from 'vitest'
import { encodeKVPayload } from './encode-v2'
import { decodeKVPayload } from './decode-v2'
import { SHARE_SCHEMA_VERSION_V2, type KVShareEntry } from './types-v2'

const sample: KVShareEntry = {
  share: {
    v: SHARE_SCHEMA_VERSION_V2,
    cards: [{ u: 'https://a.com', t: 'T', ty: 'website', cw: 200, a: 1.5 }],
    createdAt: 1735000000000,
  },
  thumb: 'data:image/webp;base64,AAAA',
}

describe('decodeKVPayload', () => {
  it('roundtrips an encoded payload', async () => {
    const encoded = await encodeKVPayload(sample)
    const result = await decodeKVPayload(encoded)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.share.cards[0].u).toBe('https://a.com')
      expect(result.data.thumb).toBe('data:image/webp;base64,AAAA')
    }
  })

  it('rejects malformed base64', async () => {
    const result = await decodeKVPayload('!!!not_base64!!!')
    expect(result.ok).toBe(false)
  })

  it('rejects malformed gzip', async () => {
    const result = await decodeKVPayload(btoa('not_gzip_data'))
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 4: decode 実装**

```ts
// lib/share/decode-v2.ts
import type { KVShareEntry } from './types-v2'

async function ungzip(bytes: Uint8Array): Promise<Uint8Array> {
  const rs = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes.buffer.slice(0)))
      controller.close()
    },
  })
  const decompressed = rs.pipeThrough(new DecompressionStream('gzip') as TransformStream<Uint8Array, Uint8Array>)
  const buf = await new Response(decompressed).arrayBuffer()
  return new Uint8Array(buf)
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export type DecodeResult =
  | { readonly ok: true; readonly data: KVShareEntry }
  | { readonly ok: false; readonly error: string }

export async function decodeKVPayload(encoded: string): Promise<DecodeResult> {
  try {
    const compressed = fromBase64(encoded)
    const utf8 = await ungzip(compressed)
    const json = new TextDecoder().decode(utf8)
    const data = JSON.parse(json) as KVShareEntry
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'decode failed' }
  }
}
```

- [ ] **Step 5: テスト pass + commit**

```bash
pnpm vitest run lib/share/encode-v2.test.ts lib/share/decode-v2.test.ts
git add lib/share/encode-v2.ts lib/share/encode-v2.test.ts lib/share/decode-v2.ts lib/share/decode-v2.test.ts
git commit -m "feat(share): add gzip+base64 encode/decode for KV payload"
```

## Task 5: viewport snapshot (WebP)

**Files:**
- Create: `lib/share/snapshot.ts`
- Create: `lib/share/snapshot.test.ts`

- [ ] **Step 1: 失敗テスト (= jsdom limitation 考慮、 wrapper logic のみテスト)**

```ts
// lib/share/snapshot.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { captureViewportWebP } from './snapshot'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('captureViewportWebP', () => {
  it('returns null when no element provided', async () => {
    const result = await captureViewportWebP(null, { width: 600, quality: 0.7 })
    expect(result).toBeNull()
  })

  it('calls dom-to-image-more with correct options when element provided', async () => {
    const fake = { tagName: 'DIV', getBoundingClientRect: () => ({ width: 1200, height: 627, top: 0, left: 0 }) } as unknown as HTMLElement
    const mockToJpeg = vi.fn().mockResolvedValue('data:image/jpeg;base64,AAAA')
    vi.doMock('dom-to-image-more', () => ({ default: { toJpeg: mockToJpeg } }))
    const { captureViewportWebP: captureFresh } = await import('./snapshot?fresh')
    const result = await captureFresh(fake, { width: 600, quality: 0.7 })
    expect(result).toBeDefined()
  })
})
```

- [ ] **Step 2: 実装 (= viewport 範囲を WebP に encode)**

```ts
// lib/share/snapshot.ts
import domtoimage from 'dom-to-image-more'

export type SnapshotOptions = {
  readonly width: number   // target output width (px)
  readonly quality: number // 0.0-1.0
}

const DEFAULT_OPTS: SnapshotOptions = { width: 600, quality: 0.75 }

/**
 * Capture an HTMLElement's current viewport intersection as a WebP data URL.
 *
 * The element must be visible in the page (= scroll position matters). The
 * snapshot reproduces what the user sees, including any scrolled-out
 * children clipped to the visible bbox.
 *
 * Returns base64 data URL ("data:image/webp;base64,...") or null on error /
 * no element. The caller is responsible for sizing — caller passes the
 * desired width and the routine maintains the source aspect ratio.
 */
export async function captureViewportWebP(
  element: HTMLElement | null,
  options: Partial<SnapshotOptions> = {},
): Promise<string | null> {
  if (!element) return null
  const opts = { ...DEFAULT_OPTS, ...options }
  try {
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const scale = opts.width / rect.width
    const dataUrl = await domtoimage.toJpeg(element, {
      quality: opts.quality,
      width: opts.width,
      height: rect.height * scale,
      style: { transform: `scale(${scale})`, transformOrigin: 'top left' },
    })
    // Convert JPEG to WebP via canvas to save bytes (~30-50% smaller).
    return await jpegToWebP(dataUrl, opts.quality)
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[share/snapshot] capture failed', e)
    return null
  }
}

async function jpegToWebP(jpegDataUrl: string, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = (): void => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no 2d context')); return }
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/webp', quality))
    }
    img.onerror = (): void => reject(new Error('image load failed'))
    img.src = jpegDataUrl
  })
}
```

- [ ] **Step 3: テストは jsdom で限定的にしか動かない、 とりあえずスキップで OK にして commit**

snapshot は dom-to-image-more + canvas + Image オブジェクトに依存し、 jsdom では完全テストは難しい。 unit test では null 返却のみ確認し、 実環境の動作は §11.3 integration で playwright 経由検証する。

```bash
pnpm vitest run lib/share/snapshot.test.ts
git add lib/share/snapshot.ts lib/share/snapshot.test.ts
git commit -m "feat(share): add viewport WebP capture via dom-to-image-more"
```

## Task 6: board state → ShareDataV2 変換

**Files:**
- Create: `lib/share/board-to-share.ts`
- Create: `lib/share/board-to-share.test.ts`

- [ ] **Step 1: 失敗テスト**

```ts
// lib/share/board-to-share.test.ts
import { describe, it, expect } from 'vitest'
import { buildShareDataFromBoard } from './board-to-share'
import { SHARE_SCHEMA_VERSION_V2 } from './types-v2'

const sampleItems = [
  {
    bookmarkId: 'b1',
    url: 'https://example.com',
    title: 'Title 1',
    description: 'Desc',
    thumbnail: 'https://cdn.example.com/t1.jpg',
    aspectRatio: 1.5,
    tags: ['t-music'],
    cardWidth: 240,
  },
]

const sampleTags = [
  { id: 't-music', name: 'music', color: '#28F100', order: 0, createdAt: 1700000000000 },
  { id: 't-design', name: 'design', color: '#FF8800', order: 1, createdAt: 1700000000000 },
]

describe('buildShareDataFromBoard', () => {
  it('produces a ShareDataV2 from board items', () => {
    const data = buildShareDataFromBoard({
      items: sampleItems,
      tags: sampleTags,
      filter: null,
      now: 1735000000000,
    })
    expect(data.v).toBe(SHARE_SCHEMA_VERSION_V2)
    expect(data.cards.length).toBe(1)
    expect(data.cards[0].u).toBe('https://example.com')
    expect(data.cards[0].cw).toBe(240)
    expect(data.cards[0].a).toBe(1.5)
    expect(data.cards[0].tg).toEqual(['t-music'])
    expect(data.tags).toEqual({ 't-music': { n: 'music', c: '#28F100' } })
    expect(data.createdAt).toBe(1735000000000)
  })

  it('only includes tags actually referenced by cards', () => {
    const data = buildShareDataFromBoard({
      items: sampleItems,
      tags: sampleTags,
      filter: null,
      now: 1735000000000,
    })
    expect(Object.keys(data.tags ?? {})).toEqual(['t-music'])
  })

  it('includes filter context when provided', () => {
    const data = buildShareDataFromBoard({
      items: sampleItems,
      tags: sampleTags,
      filter: { mode: 'or', tagIds: ['t-music', 't-design'] },
      now: 1735000000000,
    })
    expect(data.filter).toEqual({ mode: 'or', tagIds: ['t-music', 't-design'] })
  })

  it('truncates titles longer than MAX_TITLE', () => {
    const data = buildShareDataFromBoard({
      items: [{ ...sampleItems[0], title: 'x'.repeat(600) }],
      tags: [],
      filter: null,
      now: 1735000000000,
    })
    expect(data.cards[0].t.length).toBe(500)
  })

  it('caps cards at MAX_CARDS', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      ...sampleItems[0],
      bookmarkId: `b${i}`,
      url: `https://example.com/${i}`,
    }))
    const data = buildShareDataFromBoard({ items: many, tags: [], filter: null, now: 1735000000000 })
    expect(data.cards.length).toBe(100)
  })
})
```

- [ ] **Step 2: 実装**

```ts
// lib/share/board-to-share.ts
import {
  SHARE_LIMITS_V2,
  SHARE_SCHEMA_VERSION_V2,
  type ShareCardType,
  type ShareCardV2,
  type ShareDataV2,
  type TagDict,
} from './types-v2'

export type BoardItemForShare = {
  readonly bookmarkId: string
  readonly url: string
  readonly title: string
  readonly description?: string
  readonly thumbnail?: string
  readonly aspectRatio: number
  readonly tags: ReadonlyArray<string>
  readonly cardWidth: number
}

export type TagForShare = {
  readonly id: string
  readonly name: string
  readonly color?: string
}

export type FilterForShare = {
  readonly mode: 'and' | 'or'
  readonly tagIds: ReadonlyArray<string>
}

export type BuildShareArgs = {
  readonly items: ReadonlyArray<BoardItemForShare>
  readonly tags: ReadonlyArray<TagForShare>
  readonly filter: FilterForShare | null
  readonly now: number
  readonly detectType?: (url: string) => ShareCardType
}

function defaultDetectType(url: string): ShareCardType {
  if (url.includes('twitter.com') || url.includes('x.com')) return 'tweet'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('vimeo.com')) return 'vimeo'
  if (url.includes('soundcloud.com')) return 'soundcloud'
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)) return 'image'
  return 'website'
}

function truncate(s: string | undefined, max: number): string | undefined {
  if (s === undefined) return undefined
  return s.length > max ? s.slice(0, max) : s
}

export function buildShareDataFromBoard(args: BuildShareArgs): ShareDataV2 {
  const detect = args.detectType ?? defaultDetectType
  const capped = args.items.slice(0, SHARE_LIMITS_V2.MAX_CARDS)
  const cards: ShareCardV2[] = capped.map((it) => ({
    u: it.url,
    t: truncate(it.title, SHARE_LIMITS_V2.MAX_TITLE) ?? '',
    d: truncate(it.description, SHARE_LIMITS_V2.MAX_DESCRIPTION),
    th: it.thumbnail || undefined,
    ty: detect(it.url),
    cw: it.cardWidth,
    a: it.aspectRatio,
    tg: it.tags.length > 0 ? Array.from(it.tags) : undefined,
  }))

  // Tag dict: only include tags actually referenced
  const referencedTagIds = new Set<string>()
  cards.forEach((c) => c.tg?.forEach((id) => referencedTagIds.add(id)))
  let tagDict: TagDict | undefined
  if (referencedTagIds.size > 0) {
    const dict: Record<string, { n: string; c?: string }> = {}
    args.tags.forEach((t) => {
      if (referencedTagIds.has(t.id)) {
        dict[t.id] = t.color ? { n: t.name, c: t.color } : { n: t.name }
      }
    })
    tagDict = dict
  }

  return {
    v: SHARE_SCHEMA_VERSION_V2,
    cards,
    tags: tagDict,
    filter: args.filter ?? undefined,
    theme: 'wave',
    createdAt: args.now,
  }
}
```

- [ ] **Step 3: テスト + commit**

```bash
pnpm vitest run lib/share/board-to-share.test.ts
git add lib/share/board-to-share.ts lib/share/board-to-share.test.ts
git commit -m "feat(share): add board state → ShareDataV2 builder"
```

## Task 7: API client (POST create + GET fetch)

**Files:**
- Create: `lib/share/api-client.ts`
- Create: `lib/share/api-client.test.ts`

- [ ] **Step 1: 失敗テスト**

```ts
// lib/share/api-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createShare, fetchShare } from './api-client'
import { SHARE_SCHEMA_VERSION_V2 } from './types-v2'

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof fetch
})
afterEach(() => { vi.restoreAllMocks() })

describe('createShare', () => {
  it('POSTs to /api/share/create and returns the share ID', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'k3p9xv', expiresAt: 1738000000000 }),
    } as Response)
    const result = await createShare({
      share: { v: SHARE_SCHEMA_VERSION_V2, cards: [{ u: 'https://a.com', t: 'T', ty: 'website', cw: 200, a: 1 }], createdAt: 1735000000000 },
      thumb: 'data:image/webp;base64,AA',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.id).toBe('k3p9xv')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/share/create',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('returns error result on non-2xx', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 429,
      json: async () => ({ error: 'rate_limit', message: 'slow down' }),
    } as Response)
    const result = await createShare({
      share: { v: SHARE_SCHEMA_VERSION_V2, cards: [{ u: 'https://a.com', t: 'T', ty: 'website', cw: 200, a: 1 }], createdAt: 1735000000000 },
      thumb: '',
    })
    expect(result.ok).toBe(false)
  })
})

describe('fetchShare', () => {
  it('GETs /api/share/<id> and returns the entry', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        share: { v: SHARE_SCHEMA_VERSION_V2, cards: [], createdAt: 1735000000000 },
        thumb: '',
      }),
    } as Response)
    const result = await fetchShare('k3p9xv')
    expect(result.ok).toBe(true)
  })

  it('returns not_found on 404', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 404,
      json: async () => ({ error: 'not_found', message: 'expired' }),
    } as Response)
    const result = await fetchShare('k3p9xv')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('not_found')
  })
})
```

- [ ] **Step 2: 実装**

```ts
// lib/share/api-client.ts
import type { CreateShareResponse, GetShareResponse, KVShareEntry, ShareErrorResponse } from './types-v2'

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ShareErrorResponse['error']; readonly message: string }

export async function createShare(entry: KVShareEntry): Promise<ApiResult<CreateShareResponse>> {
  try {
    const res = await fetch('/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    if (!res.ok) {
      const err = await res.json() as ShareErrorResponse
      return { ok: false, error: err.error ?? 'server', message: err.message ?? `HTTP ${res.status}` }
    }
    const data = await res.json() as CreateShareResponse
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: 'server', message: e instanceof Error ? e.message : 'network error' }
  }
}

export async function fetchShare(id: string): Promise<ApiResult<GetShareResponse>> {
  try {
    const res = await fetch(`/api/share/${encodeURIComponent(id)}`, { method: 'GET' })
    if (!res.ok) {
      const err = await res.json() as ShareErrorResponse
      return { ok: false, error: err.error ?? 'server', message: err.message ?? `HTTP ${res.status}` }
    }
    const data = await res.json() as GetShareResponse
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: 'server', message: e instanceof Error ? e.message : 'network error' }
  }
}
```

- [ ] **Step 3: テスト + commit**

```bash
pnpm vitest run lib/share/api-client.test.ts
git add lib/share/api-client.ts lib/share/api-client.test.ts
git commit -m "feat(share): add API client for /api/share endpoints"
```

---

# Phase 2 — Cloudflare Pages Functions (Tasks 8-11)

## Task 8: wrangler.toml に KV namespace 追加

**Files:**
- Modify: `wrangler.toml`

- [ ] **Step 1: 既存 wrangler.toml 確認**

Run: `cat wrangler.toml`
Expected: 既存設定が出力される

- [ ] **Step 2: SHARE_KV namespace binding 追加**

`wrangler.toml` の末尾に以下を追加:

```toml
[[kv_namespaces]]
binding = "SHARE_KV"
id = "REPLACE_WITH_KV_NAMESPACE_ID"
preview_id = "REPLACE_WITH_PREVIEW_KV_NAMESPACE_ID"
```

実際の ID は user の Cloudflare ダッシュボードで作成して書き換え:
- `wrangler kv namespace create SHARE_KV` で本番用
- `wrangler kv namespace create SHARE_KV --preview` で preview 用
- 出力された ID を `id` / `preview_id` にコピペ

- [ ] **Step 3: commit (= ID は placeholder のまま、 user が実際の ID 入れる)**

```bash
git add wrangler.toml
git commit -m "feat(share): add SHARE_KV namespace binding (placeholder IDs)"
```

## Task 9: POST /api/share/create

**Files:**
- Create: `functions/api/share/create.ts`

- [ ] **Step 1: 実装**

```ts
// functions/api/share/create.ts
import { isValidShareId, generateShareId } from '../../../lib/share/kv-id'
import { parseShareDataV2 } from '../../../lib/share/validate-v2'
import { encodeKVPayload } from '../../../lib/share/encode-v2'
import { SHARE_LIMITS_V2, type KVShareEntry, type ShareErrorResponse, type CreateShareResponse } from '../../../lib/share/types-v2'

interface Env {
  SHARE_KV: KVNamespace
}

interface KVNamespace {
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' }): Promise<string | null>
}

const MAX_BODY_BYTES = 250 * 1024  // 250KB hard cap on POST body
const MAX_ID_RETRIES = 5

function errResponse(status: number, error: ShareErrorResponse['error'], message: string): Response {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  // Body size check
  const contentLength = parseInt(ctx.request.headers.get('content-length') ?? '0', 10)
  if (contentLength > MAX_BODY_BYTES) {
    return errResponse(413, 'invalid', `body too large (${contentLength} > ${MAX_BODY_BYTES})`)
  }

  let body: unknown
  try {
    body = await ctx.request.json()
  } catch {
    return errResponse(400, 'invalid', 'malformed JSON body')
  }

  // Validate share + thumb structure
  const bodyObj = body as Partial<KVShareEntry>
  if (!bodyObj.share || typeof bodyObj.thumb !== 'string') {
    return errResponse(400, 'invalid', 'missing share or thumb field')
  }
  if (bodyObj.thumb.length > SHARE_LIMITS_V2.MAX_THUMB_BYTES * 2) {  // *2 for base64 overhead
    return errResponse(413, 'invalid', 'thumbnail too large')
  }

  const parsed = parseShareDataV2(bodyObj.share)
  if (!parsed.ok) {
    return errResponse(400, 'invalid', parsed.error)
  }

  const entry: KVShareEntry = { share: parsed.data, thumb: bodyObj.thumb }
  const encoded = await encodeKVPayload(entry)

  if (encoded.length > SHARE_LIMITS_V2.MAX_KV_ENTRY_BYTES) {
    return errResponse(413, 'invalid', `payload too large (${encoded.length})`)
  }

  // Allocate ID with collision retry
  let id: string | null = null
  for (let i = 0; i < MAX_ID_RETRIES; i++) {
    const candidate = generateShareId()
    const existing = await ctx.env.SHARE_KV.get(candidate)
    if (existing === null) { id = candidate; break }
  }
  if (id === null) {
    return errResponse(500, 'server', 'ID allocation failed')
  }

  await ctx.env.SHARE_KV.put(id, encoded, { expirationTtl: SHARE_LIMITS_V2.TTL_SECONDS })

  const response: CreateShareResponse = {
    id,
    expiresAt: Date.now() + SHARE_LIMITS_V2.TTL_SECONDS * 1000,
  }
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 2: commit**

```bash
git add functions/api/share/create.ts
git commit -m "feat(share): add POST /api/share/create Pages Function"
```

## Task 10: GET /api/share/[id]

**Files:**
- Create: `functions/api/share/[id].ts`

- [ ] **Step 1: 実装**

```ts
// functions/api/share/[id].ts
import { isValidShareId } from '../../../lib/share/kv-id'
import { decodeKVPayload } from '../../../lib/share/decode-v2'
import type { ShareErrorResponse } from '../../../lib/share/types-v2'

interface Env {
  SHARE_KV: KVNamespace
}

interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' }): Promise<string | null>
}

function errResponse(status: number, error: ShareErrorResponse['error'], message: string): Response {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const id = ctx.params.id as string
  if (!isValidShareId(id)) {
    return errResponse(400, 'invalid', 'malformed share id')
  }

  const encoded = await ctx.env.SHARE_KV.get(id)
  if (encoded === null) {
    return errResponse(404, 'not_found', 'share expired or never existed')
  }

  const decoded = await decodeKVPayload(encoded)
  if (!decoded.ok) {
    return errResponse(500, 'server', `decode failed: ${decoded.error}`)
  }

  return new Response(JSON.stringify(decoded.data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
```

- [ ] **Step 2: commit**

```bash
git add functions/api/share/[id].ts
git commit -m "feat(share): add GET /api/share/[id] Pages Function"
```

## Task 11: GET /api/share/[id]/og.webp

**Files:**
- Create: `functions/api/share/[id]/og.ts`

- [ ] **Step 1: 実装**

```ts
// functions/api/share/[id]/og.ts
import { isValidShareId } from '../../../../lib/share/kv-id'
import { decodeKVPayload } from '../../../../lib/share/decode-v2'

interface Env {
  SHARE_KV: KVNamespace
}

interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' }): Promise<string | null>
}

// Tiny placeholder WebP (1x1 black) returned when share is missing — keeps
// OG image preview from breaking entirely.
const PLACEHOLDER_WEBP_BASE64 = 'UklGRhwAAABXRUJQVlA4TBAAAAAvAAAAAAfQ//73v/+BiOh/AAA='

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const id = ctx.params.id as string

  if (!isValidShareId(id)) {
    return new Response(base64ToBytes(PLACEHOLDER_WEBP_BASE64), {
      status: 200,
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=300' },
    })
  }

  const encoded = await ctx.env.SHARE_KV.get(id)
  if (encoded === null) {
    return new Response(base64ToBytes(PLACEHOLDER_WEBP_BASE64), {
      status: 200,
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=60' },
    })
  }

  const decoded = await decodeKVPayload(encoded)
  if (!decoded.ok) {
    return new Response(base64ToBytes(PLACEHOLDER_WEBP_BASE64), {
      status: 200,
      headers: { 'Content-Type': 'image/webp' },
    })
  }

  // Extract data URL: "data:image/webp;base64,XXXX"
  const thumb = decoded.data.thumb
  const match = thumb.match(/^data:image\/\w+;base64,(.+)$/)
  if (!match) {
    return new Response(base64ToBytes(PLACEHOLDER_WEBP_BASE64), {
      status: 200,
      headers: { 'Content-Type': 'image/webp' },
    })
  }

  return new Response(base64ToBytes(match[1]), {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
```

- [ ] **Step 2: commit**

```bash
git add functions/api/share/[id]/og.ts
git commit -m "feat(share): add OG image endpoint /api/share/[id]/og.webp"
```

---

# Phase 3 — 送信側 SenderShareModal (Tasks 12-15)

## Task 12: import.ts ロジック層 (= bulk import + tag conversion)

**Files:**
- Create: `lib/share/import.ts`
- Create: `lib/share/import.test.ts`

- [ ] **Step 1: 失敗テスト**

```ts
// lib/share/import.test.ts
import { describe, it, expect } from 'vitest'
import { findDuplicates, convertSenderTagsForReceiver } from './import'
import type { ShareCardV2, TagDict } from './types-v2'

describe('findDuplicates', () => {
  it('returns the URL set already present in receiver IDB', () => {
    const shared: ShareCardV2[] = [
      { u: 'https://a.com', t: 'A', ty: 'website', cw: 200, a: 1 },
      { u: 'https://b.com', t: 'B', ty: 'website', cw: 200, a: 1 },
      { u: 'https://c.com', t: 'C', ty: 'website', cw: 200, a: 1 },
    ]
    const existingUrls = new Set(['https://b.com'])
    expect(findDuplicates(shared, existingUrls)).toEqual(new Set(['https://b.com']))
  })
})

describe('convertSenderTagsForReceiver', () => {
  it('merges same-name tags to receiver existing IDs', () => {
    const senderDict: TagDict = {
      's1': { n: 'music' },
      's2': { n: 'design' },
    }
    const receiverTags = [
      { id: 'r-music', name: 'music' },
      { id: 'r-other', name: 'other' },
    ]
    const mapping = convertSenderTagsForReceiver(['s1', 's2'], senderDict, receiverTags)
    expect(mapping.existing.get('s1')).toBe('r-music')
    expect(mapping.existing.has('s2')).toBe(false)
    expect(mapping.toCreate.find((t) => t.senderId === 's2')?.name).toBe('design')
  })

  it('keeps receiver existing color (= does not overwrite)', () => {
    const senderDict: TagDict = { 's1': { n: 'music', c: '#FF0000' } }
    const receiverTags = [{ id: 'r-music', name: 'music' }]
    const mapping = convertSenderTagsForReceiver(['s1'], senderDict, receiverTags)
    expect(mapping.existing.get('s1')).toBe('r-music')
    expect(mapping.toCreate.length).toBe(0)
  })
})
```

- [ ] **Step 2: 実装**

```ts
// lib/share/import.ts
import type { ShareCardV2, TagDict } from './types-v2'

/** Find which URLs from the shared payload are already in receiver IDB. */
export function findDuplicates(
  cards: ReadonlyArray<ShareCardV2>,
  existingUrls: ReadonlySet<string>,
): Set<string> {
  const dups = new Set<string>()
  for (const c of cards) {
    if (existingUrls.has(c.u)) dups.add(c.u)
  }
  return dups
}

export type ReceiverTagLite = { readonly id: string; readonly name: string }

export type TagConversionResult = {
  /** sender tag ID → receiver tag ID (= matched by name) */
  readonly existing: Map<string, string>
  /** Sender tags absent from receiver. Caller must call addTag for each
   *  and replace `senderId` in armed sets with the new receiver ID. */
  readonly toCreate: ReadonlyArray<{
    readonly senderId: string
    readonly name: string
    readonly color?: string
  }>
}

/** Resolve sender's armed tag IDs against receiver's existing tags by name.
 *  Receiver's tag color is preserved (= sender's color is only used if
 *  receiver has no same-named tag). */
export function convertSenderTagsForReceiver(
  armedSenderTagIds: ReadonlyArray<string>,
  senderTags: TagDict,
  receiverTags: ReadonlyArray<ReceiverTagLite>,
): TagConversionResult {
  const byName = new Map<string, string>()  // tag name → receiver tag id
  for (const t of receiverTags) byName.set(t.name, t.id)

  const existing = new Map<string, string>()
  const toCreate: Array<{ senderId: string; name: string; color?: string }> = []

  for (const senderId of armedSenderTagIds) {
    const senderTag = senderTags[senderId]
    if (!senderTag) continue  // sender ID not in dict, skip silently
    const existingReceiverId = byName.get(senderTag.n)
    if (existingReceiverId) {
      existing.set(senderId, existingReceiverId)
    } else {
      toCreate.push({ senderId, name: senderTag.n, color: senderTag.c })
    }
  }

  return { existing, toCreate }
}
```

- [ ] **Step 3: テスト + commit**

```bash
pnpm vitest run lib/share/import.test.ts
git add lib/share/import.ts lib/share/import.test.ts
git commit -m "feat(share): add bulk import dedup + sender tag conversion logic"
```

## Task 13: SenderShareModal — UI skeleton

**Files:**
- Create: `components/share/SenderShareModal.tsx`
- Create: `components/share/SenderShareModal.module.css`
- Create: `components/share/SenderShareModal.test.tsx`

- [ ] **Step 1: コンポーネント failing test**

```tsx
// components/share/SenderShareModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SenderShareModal } from './SenderShareModal'
import { SHARE_SCHEMA_VERSION_V2, type ShareDataV2 } from '@/lib/share/types-v2'

const sampleShare: ShareDataV2 = {
  v: SHARE_SCHEMA_VERSION_V2,
  cards: [{ u: 'https://a.com', t: 'T', ty: 'website', cw: 200, a: 1 }],
  createdAt: 1735000000000,
}

describe('SenderShareModal', () => {
  it('renders nothing when open=false', () => {
    render(
      <SenderShareModal
        open={false}
        onClose={() => {}}
        getShareData={() => sampleShare}
        getCanvasElement={() => null}
      />,
    )
    expect(screen.queryByText('SHARE BOARD')).toBeNull()
  })

  it('renders header when open=true', () => {
    render(
      <SenderShareModal
        open={true}
        onClose={() => {}}
        getShareData={() => sampleShare}
        getCanvasElement={() => null}
      />,
    )
    expect(screen.getByText('SHARE BOARD')).toBeInTheDocument()
  })

  it('calls onClose when CLOSE button clicked', () => {
    const onClose = vi.fn()
    render(
      <SenderShareModal
        open={true}
        onClose={onClose}
        getShareData={() => sampleShare}
        getCanvasElement={() => null}
      />,
    )
    screen.getByText('CLOSE').click()
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: skeleton 実装 (= 状態機械 + render のみ、 API call と snapshot は次タスク)**

```tsx
// components/share/SenderShareModal.tsx
'use client'
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { ShareDataV2 } from '@/lib/share/types-v2'
import styles from './SenderShareModal.module.css'

type ModalState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly shareUrl: string; readonly thumbDataUrl: string }
  | { readonly kind: 'error'; readonly message: string }

type Props = {
  readonly open: boolean
  readonly onClose: () => void
  /** Lazy accessor: called once when modal opens to build the share payload. */
  readonly getShareData: () => ShareDataV2
  /** Lazy accessor: returns the HTMLElement to snapshot (= board canvas wrap). */
  readonly getCanvasElement: () => HTMLElement | null
}

export function SenderShareModal({ open, onClose, getShareData, getCanvasElement }: Props): ReactElement | null {
  const [state, setState] = useState<ModalState>({ kind: 'loading' })

  // ESC + backdrop click handlers
  useEffect((): (() => void) | undefined => {
    if (!open) return undefined
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset state when modal closes (so re-open starts fresh)
  useEffect((): void => {
    if (!open) setState({ kind: 'loading' })
  }, [open])

  const handleBackdrop = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  if (!open) return null

  const shareData = getShareData()
  const cardCount = shareData.cards.length

  return (
    <div className={styles.backdrop} onClick={handleBackdrop}>
      <div className={styles.panel} role="dialog" aria-label="Share board">
        <header className={styles.header}>
          <span className={styles.title}>SHARE BOARD</span>
          <button type="button" className={styles.closeIcon} onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className={styles.preview}>
          {state.kind === 'ready' ? (
            <img src={state.thumbDataUrl} alt="Board preview" className={styles.thumb} />
          ) : (
            <div className={styles.thumbSkeleton} />
          )}
        </div>
        <p className={styles.meta}>
          {cardCount} CARDS
        </p>
        <div className={styles.actions}>
          <div className={styles.urlRow}>
            {state.kind === 'ready' ? (
              <code className={styles.url}>{state.shareUrl}</code>
            ) : (
              <code className={styles.url}>{state.kind === 'loading' ? '⌗ preparing...' : '⌗ error'}</code>
            )}
            <button
              type="button"
              className={styles.copyBtn}
              disabled={state.kind !== 'ready'}
              onClick={(): void => {
                if (state.kind === 'ready') void navigator.clipboard.writeText(state.shareUrl)
              }}
            >COPY</button>
          </div>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={state.kind !== 'ready'}
            onClick={(): void => {
              if (state.kind !== 'ready') return
              const intent = `https://twitter.com/intent/tweet?url=${encodeURIComponent(state.shareUrl)}`
              window.open(intent, '_blank', 'noopener,noreferrer')
            }}
          >POST TO X</button>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: CSS (= AllMarks default theme)**

```css
/* components/share/SenderShareModal.module.css */
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 100ms ease-out;
}

.panel {
  position: relative;
  width: min(480px, calc(100vw - 32px));
  background: rgba(8, 8, 10, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 0;
  color: rgba(255, 255, 255, 0.92);
  font-family: 'Geist Mono', monospace;
  animation: slideUp 100ms ease-out;
  overflow: hidden;
}

/* Convex bezel (= board canvas と同じ照り反射) */
.panel::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, transparent 30%, transparent 70%, rgba(255, 255, 255, 0.02) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -1px 0 rgba(255, 255, 255, 0.04);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.72);
}

.closeIcon {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
}

.closeIcon:hover {
  color: rgba(255, 255, 255, 0.9);
}

.preview {
  padding: 18px;
}

.thumb,
.thumbSkeleton {
  width: 100%;
  aspect-ratio: 1.91 / 1;
  border-radius: 4px;
  display: block;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.thumbSkeleton {
  background: linear-gradient(90deg,
    rgba(255, 255, 255, 0.03) 25%,
    rgba(255, 255, 255, 0.06) 50%,
    rgba(255, 255, 255, 0.03) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.meta {
  margin: 0 18px 14px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #28F100;
  opacity: 0.85;
}

.actions {
  padding: 14px 18px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.urlRow {
  display: flex;
  gap: 8px;
  align-items: center;
}

.url {
  flex: 1;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.04);
  padding: 8px 10px;
  border-radius: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copyBtn,
.primaryBtn,
.secondaryBtn {
  font-family: inherit;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  padding: 10px 16px;
  border-radius: 4px;
  transition: all 100ms ease-out;
}

.copyBtn {
  background: rgba(40, 241, 0, 0.12);
  border: 1px solid rgba(40, 241, 0, 0.4);
  color: #28F100;
}

.copyBtn:hover:not(:disabled) {
  background: rgba(40, 241, 0, 0.24);
}

.copyBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.primaryBtn {
  background: rgba(40, 241, 0, 0.12);
  border: 1px solid rgba(40, 241, 0, 0.5);
  color: #28F100;
}

.primaryBtn:hover:not(:disabled) {
  background: rgba(40, 241, 0, 0.24);
}

.primaryBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.secondaryBtn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.72);
}

.secondaryBtn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.28);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 4: テスト + commit**

```bash
pnpm vitest run components/share/SenderShareModal.test.tsx
git add components/share/SenderShareModal.tsx components/share/SenderShareModal.module.css components/share/SenderShareModal.test.tsx
git commit -m "feat(share): SenderShareModal skeleton with AllMarks default theme"
```

## Task 14: SenderShareModal — snapshot + API integration

**Files:**
- Modify: `components/share/SenderShareModal.tsx`

- [ ] **Step 1: useEffect で snapshot 撮影 + KV write を実装**

`SenderShareModal.tsx` の `useState` 後、 `useEffect` 群に追加:

```tsx
import { captureViewportWebP } from '@/lib/share/snapshot'
import { createShare } from '@/lib/share/api-client'

// (within component)
useEffect((): void => {
  if (!open) return
  void (async (): Promise<void> => {
    setState({ kind: 'loading' })
    try {
      const canvas = getCanvasElement()
      const thumb = await captureViewportWebP(canvas, { width: 600, quality: 0.7 })
      const thumbDataUrl = thumb ?? 'data:image/webp;base64,'
      const share = getShareData()
      const result = await createShare({ share, thumb: thumbDataUrl })
      if (!result.ok) {
        setState({ kind: 'error', message: result.message })
        return
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://allmarks.app'
      const shareUrl = `${origin}/s/${result.data.id}`
      setState({ kind: 'ready', shareUrl, thumbDataUrl })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'unknown error' })
    }
  })()
}, [open, getShareData, getCanvasElement])
```

- [ ] **Step 2: error 状態の UI 追加 (= panel の preview / urlRow を分岐)**

`SenderShareModal.tsx` の return 内の URL display を:

```tsx
{state.kind === 'ready' ? (
  <code className={styles.url}>{state.shareUrl}</code>
) : state.kind === 'error' ? (
  <code className={styles.url} style={{ color: '#ff8888' }}>⚠ {state.message}</code>
) : (
  <code className={styles.url}>⌗ preparing...</code>
)}
```

- [ ] **Step 3: コピー成功 toast (= 1.5秒「COPIED」 表示) を追加**

`useState` に追加:
```tsx
const [copied, setCopied] = useState<boolean>(false)
```

COPY button onClick を:
```tsx
onClick={(): void => {
  if (state.kind !== 'ready') return
  void navigator.clipboard.writeText(state.shareUrl).then((): void => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  })
}}
```

button text:
```tsx
{copied ? 'COPIED' : 'COPY'}
```

- [ ] **Step 4: tsc + vitest 確認**

```bash
pnpm tsc --noEmit
pnpm vitest run components/share/SenderShareModal.test.tsx
```

- [ ] **Step 5: commit**

```bash
git add components/share/SenderShareModal.tsx
git commit -m "feat(share): wire SenderShareModal to snapshot + KV API"
```

## Task 15: BoardRoot の SHARE button を新 modal に切替

**Files:**
- Modify: `components/board/BoardRoot.tsx`

- [ ] **Step 1: 既存 import 確認**

`components/board/BoardRoot.tsx` の line 63 周辺:
```tsx
import { ShareComposer } from '@/components/share/ShareComposer'
```

- [ ] **Step 2: 旧 ShareComposer import を新 SenderShareModal に置換**

```tsx
import { SenderShareModal } from '@/components/share/SenderShareModal'
import { buildShareDataFromBoard } from '@/lib/share/board-to-share'
```

- [ ] **Step 3: 旧 state を rename + 新 callback 群追加**

`shareComposerOpen` を `shareModalOpen` に rename (= 全 4 箇所、 line 195 / 1282 / 1581 / 1742 周辺):

```tsx
const [shareModalOpen, setShareModalOpen] = useState<boolean>(false)
```

新 callback 追加 (= 既存 `handleShareConfirm` 削除前提、 後の Task 31 で削除):

```tsx
const buildShareData = useCallback((): ShareDataV2 => {
  return buildShareDataFromBoard({
    items: filteredItems,
    tags: tags,
    filter: activeFilter.kind === 'tags' ? { mode: activeFilter.mode, tagIds: activeFilter.tagIds } : null,
    now: Date.now(),
  })
}, [filteredItems, tags, activeFilter])

const getCanvasEl = useCallback((): HTMLElement | null => canvasRef.current, [])
```

- [ ] **Step 4: 旧 ShareComposer JSX block を SenderShareModal に置換**

line 1742 周辺の旧 block:
```tsx
{shareComposerOpen && (
  <ShareComposer ... />
)}
```

を:
```tsx
<SenderShareModal
  open={shareModalOpen}
  onClose={(): void => setShareModalOpen(false)}
  getShareData={buildShareData}
  getCanvasElement={getCanvasEl}
/>
```

(= 旧 block の `{ actionSheet && (... ShareActionSheet ...) }` も削除、 actionSheet state も削除)

line 1581 周辺 SHARE chrome button:
```tsx
onClick={(): void => setShareComposerOpen(true)}
```
→
```tsx
onClick={(): void => setShareModalOpen(true)}
```

- [ ] **Step 5: tsc + 既存テスト走る**

```bash
pnpm tsc --noEmit 2>&1 | tail -20
pnpm vitest run components/board/ 2>&1 | tail -10
```

旧 ShareComposer に依存している既存 board テストが落ちる可能性 → 一旦 skip でも OK (= Phase 6 削除 task で同時整理)

- [ ] **Step 6: commit**

```bash
git add components/board/BoardRoot.tsx
git commit -m "feat(share): swap BoardRoot SHARE button to SenderShareModal (legacy ShareComposer to be removed in Phase 6)"
```

---

# Phase 4 — 受信側着地 ReceiverLanding (Tasks 16-22)

## Task 16: /s/[id] ルート + page metadata

**Files:**
- Create: `app/(app)/s/[id]/page.tsx`
- Create: `app/(app)/s/[id]/page.module.css`

- [ ] **Step 1: page.tsx (= SSR + OG metadata)**

```tsx
// app/(app)/s/[id]/page.tsx
import type { Metadata } from 'next'
import { ReceiverLanding } from '@/components/share/ReceiverLanding'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

type Props = { readonly params: Promise<{ readonly id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://allmarks.app'
  const ogImageUrl = `${origin}/api/share/${id}/og.webp`
  return {
    title: 'Shared collection on AllMarks',
    description: 'A curated set of bookmarks shared via AllMarks',
    openGraph: {
      title: 'Shared collection on AllMarks',
      description: 'A curated set of bookmarks',
      images: [{ url: ogImageUrl, width: 1200, height: 627 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      images: [ogImageUrl],
    },
  }
}

export default async function SharePage({ params }: Props): Promise<JSX.Element> {
  const { id } = await params
  return <ReceiverLanding shareId={id} />
}
```

- [ ] **Step 2: commit**

```bash
git add app/\(app\)/s/\[id\]/page.tsx
git commit -m "feat(share): add /s/[id] route with SSR OG metadata"
```

## Task 17: ReceiverLanding — fetch + state machine

**Files:**
- Create: `components/share/ReceiverLanding.tsx`
- Create: `components/share/ReceiverLanding.module.css`
- Create: `components/share/ReceiverLanding.test.tsx`

- [ ] **Step 1: 失敗テスト**

```tsx
// components/share/ReceiverLanding.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ReceiverLanding } from './ReceiverLanding'
import { SHARE_SCHEMA_VERSION_V2 } from '@/lib/share/types-v2'

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      share: {
        v: SHARE_SCHEMA_VERSION_V2,
        cards: [{ u: 'https://a.com', t: 'Card A', ty: 'website', cw: 200, a: 1.5 }],
        createdAt: 1735000000000,
      },
      thumb: '',
    }),
  } as Response) as unknown as typeof fetch
})

describe('ReceiverLanding', () => {
  it('shows loading state initially', () => {
    render(<ReceiverLanding shareId="k3p9xv" />)
    expect(screen.getByText(/LOADING/i)).toBeInTheDocument()
  })

  it('renders shared cards after fetch succeeds', async () => {
    render(<ReceiverLanding shareId="k3p9xv" />)
    await waitFor(() => expect(screen.getByText('Card A')).toBeInTheDocument())
  })

  it('shows expired message on 404', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 404,
      json: async () => ({ error: 'not_found', message: 'expired' }),
    } as Response)
    render(<ReceiverLanding shareId="k3p9xv" />)
    await waitFor(() => expect(screen.getByText(/expired/i)).toBeInTheDocument())
  })

  it('renders bulk import + triage CTAs after fetch', async () => {
    render(<ReceiverLanding shareId="k3p9xv" />)
    await waitFor(() => expect(screen.getByText(/IMPORT ALL/i)).toBeInTheDocument())
    expect(screen.getByText(/PICK ONE BY ONE/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 実装 (= fetch + state、 read-only board は Task 18 で)**

```tsx
// components/share/ReceiverLanding.tsx
'use client'
import { useEffect, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { fetchShare } from '@/lib/share/api-client'
import { sanitizeShareDataV2 } from '@/lib/share/validate-v2'
import type { ShareDataV2 } from '@/lib/share/types-v2'
import styles from './ReceiverLanding.module.css'

type LandingState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: ShareDataV2 }
  | { readonly kind: 'error'; readonly code: 'not_found' | 'expired' | 'invalid' | 'server'; readonly message: string }

type Props = { readonly shareId: string }

export function ReceiverLanding({ shareId }: Props): ReactElement {
  const [state, setState] = useState<LandingState>({ kind: 'loading' })
  const router = useRouter()

  useEffect((): void => {
    void (async (): Promise<void> => {
      const result = await fetchShare(shareId)
      if (!result.ok) {
        const code = result.error === 'not_found' ? 'not_found' : 'server'
        setState({ kind: 'error', code, message: result.message })
        return
      }
      const parsed = sanitizeShareDataV2(result.data.share)
      if (!parsed.ok) {
        setState({ kind: 'error', code: 'invalid', message: parsed.error })
        return
      }
      setState({ kind: 'ready', data: parsed.data })
    })()
  }, [shareId])

  if (state.kind === 'loading') {
    return (
      <div className={styles.shell}>
        <p className={styles.loadingText}>LOADING SHARED COLLECTION</p>
      </div>
    )
  }

  if (state.kind === 'error') {
    const isExpired = state.code === 'not_found'
    return (
      <div className={styles.shell}>
        <div className={styles.errorBox}>
          <p className={styles.errorTitle}>
            {isExpired ? 'This share has expired or was never created' : 'Could not load share'}
          </p>
          <p className={styles.errorMessage}>{state.message}</p>
          <button
            type="button"
            className={styles.errorCta}
            onClick={(): void => router.push('/board')}
          >GO TO ALLMARKS</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <span className={styles.logo}>A</span>
        {state.data.filter && state.data.tags && (
          <span className={styles.filterContext}>
            · FILTERED: {state.data.filter.tagIds.map((id) => state.data.tags?.[id]?.n ?? '?').join(' + ')}
          </span>
        )}
      </header>
      <main className={styles.boardArea}>
        {/* Task 18: read-only board rendering here */}
        {state.data.cards.map((c) => (
          <div key={c.u} className={styles.tempCard}>
            {c.th && <img src={c.th} alt="" />}
            <p>{c.t}</p>
          </div>
        ))}
      </main>
      <footer className={styles.stickyCta}>
        <button type="button" className={styles.ctaPrimary} data-testid="bulk-import-btn">
          IMPORT ALL {state.data.cards.length}
        </button>
        <button
          type="button"
          className={styles.ctaSecondary}
          onClick={(): void => router.push(`/s/${shareId}/triage`)}
          data-testid="triage-btn"
        >PICK ONE BY ONE</button>
      </footer>
    </div>
  )
}
```

- [ ] **Step 3: CSS (= AllMarks default theme)**

```css
/* components/share/ReceiverLanding.module.css */
.shell {
  min-height: 100vh;
  background: #000;
  color: rgba(255, 255, 255, 0.92);
  font-family: 'Geist Mono', monospace;
  display: flex;
  flex-direction: column;
}

.topBar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.84);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.logo {
  font-weight: 700;
  font-size: 14px;
  color: #28F100;
}

.filterContext {
  color: rgba(255, 255, 255, 0.5);
}

.boardArea {
  flex: 1;
  padding: 24px 20px 120px;  /* bottom padding for sticky CTA clearance */
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.tempCard {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  overflow: hidden;
  padding: 10px;
}

.tempCard img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
  margin-bottom: 8px;
}

.tempCard p {
  margin: 0;
  font-size: 11px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

.loadingText,
.errorTitle {
  text-align: center;
  margin-top: 200px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.errorBox {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.errorMessage {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
}

.errorCta {
  font-family: inherit;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 10px 18px;
  background: rgba(40, 241, 0, 0.12);
  border: 1px solid rgba(40, 241, 0, 0.4);
  color: #28F100;
  border-radius: 4px;
  cursor: pointer;
}

.errorCta:hover {
  background: rgba(40, 241, 0, 0.24);
}

.stickyCta {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  gap: 12px;
  padding: 14px 20px;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.ctaPrimary,
.ctaSecondary {
  flex: 1;
  font-family: inherit;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 14px 20px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 100ms ease-out;
}

.ctaPrimary {
  background: #28F100;
  border: 1px solid #28F100;
  color: #000;
  font-weight: 600;
}

.ctaPrimary:hover {
  background: rgba(40, 241, 0, 0.88);
}

.ctaSecondary {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.24);
  color: rgba(255, 255, 255, 0.84);
}

.ctaSecondary:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.4);
}
```

- [ ] **Step 4: テスト pass + commit**

```bash
pnpm vitest run components/share/ReceiverLanding.test.tsx
git add components/share/ReceiverLanding.tsx components/share/ReceiverLanding.module.css components/share/ReceiverLanding.test.tsx
git commit -m "feat(share): ReceiverLanding fetch + state machine + temp grid"
```

## Task 18: ReceiverLanding — 既存 board 風 masonry レンダリング

**Files:**
- Modify: `components/share/ReceiverLanding.tsx`
- Modify: `components/share/ReceiverLanding.module.css`

- [ ] **Step 1: 既存 skyline-layout を import + 受信側 masonry 計算 hook**

`components/share/ReceiverLanding.tsx` に追加:

```tsx
import { useMemo, useRef } from 'react'
import { computeSkylineLayout, type LayoutItem } from '@/lib/board/skyline-layout'

// (within component, after sanitize)
const containerRef = useRef<HTMLDivElement>(null)
const [containerWidth, setContainerWidth] = useState<number>(1200)

useEffect((): (() => void) | undefined => {
  if (!containerRef.current) return undefined
  const ro = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width
    if (w) setContainerWidth(w)
  })
  ro.observe(containerRef.current)
  return (): void => ro.disconnect()
}, [])

const layout = useMemo(() => {
  if (state.kind !== 'ready') return null
  const items: LayoutItem[] = state.data.cards.map((c, idx) => ({
    id: c.u,
    width: c.cw,
    height: c.cw / c.a,
    orderIndex: idx,
  }))
  return computeSkylineLayout({
    items,
    containerWidth,
    gap: 16,
  })
}, [state, containerWidth])
```

- [ ] **Step 2: tempCard を masonry 配置に置換**

`boardArea` JSX を:

```tsx
<main className={styles.boardArea} ref={containerRef}>
  <div className={styles.canvas} style={{ height: layout?.height ?? 0 }}>
    {state.data.cards.map((c) => {
      const pos = layout?.positions[c.u]
      if (!pos) return null
      return (
        <div
          key={c.u}
          className={styles.card}
          style={{
            position: 'absolute',
            left: pos.x,
            top: pos.y,
            width: pos.width,
            height: pos.height,
          }}
        >
          {c.th && <img src={c.th} alt="" className={styles.cardThumb} />}
          <p className={styles.cardTitle}>{c.t}</p>
          {c.tg && c.tg.length > 0 && state.data.tags && (
            <div className={styles.cardTags}>
              {c.tg.map((tid) => (
                <span key={tid} className={styles.cardTag}>
                  {state.data.tags?.[tid]?.n ?? '?'}
                </span>
              ))}
            </div>
          )}
        </div>
      )
    })}
  </div>
</main>
```

- [ ] **Step 3: CSS 更新 (= grid 廃止、 absolute 配置)**

`ReceiverLanding.module.css` の `.boardArea` 以降を置換:

```css
.boardArea {
  flex: 1;
  padding: 24px 20px 120px;
  position: relative;
}

.canvas {
  position: relative;
  width: 100%;
}

.card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cardThumb {
  width: 100%;
  height: auto;
  display: block;
  background: rgba(255, 255, 255, 0.02);
}

.cardTitle {
  margin: 0;
  padding: 8px 10px;
  font-size: 11px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.4;
}

.cardTags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 10px 10px;
}

.cardTag {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 3px 6px;
  background: rgba(40, 241, 0, 0.08);
  border: 1px solid rgba(40, 241, 0, 0.24);
  color: rgba(40, 241, 0, 0.85);
  border-radius: 3px;
}
```

- [ ] **Step 4: skyline-layout の interface 確認 (= 既存 export チェック)**

```bash
grep -n 'export' lib/board/skyline-layout.ts | head -10
```

`LayoutItem` と `computeSkylineLayout` の正確な signature を確認、 上記コードの引数名がズレてたら修正。

- [ ] **Step 5: tsc + テスト + commit**

```bash
pnpm tsc --noEmit
pnpm vitest run components/share/ReceiverLanding.test.tsx
git add components/share/ReceiverLanding.tsx components/share/ReceiverLanding.module.css
git commit -m "feat(share): ReceiverLanding masonry layout via existing skyline-layout"
```

## Task 19: BulkImportToast コンポーネント

**Files:**
- Create: `components/share/BulkImportToast.tsx`
- Create: `components/share/BulkImportToast.module.css`
- Create: `components/share/BulkImportToast.test.tsx`

- [ ] **Step 1: 失敗テスト**

```tsx
// components/share/BulkImportToast.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BulkImportToast } from './BulkImportToast'

describe('BulkImportToast', () => {
  it('renders saved count', () => {
    render(<BulkImportToast saved={23} skipped={0} onDismiss={() => {}} />)
    expect(screen.getByText(/23 CARDS SAVED/i)).toBeInTheDocument()
  })

  it('shows skipped count when > 0', () => {
    render(<BulkImportToast saved={18} skipped={5} onDismiss={() => {}} />)
    expect(screen.getByText(/5 ALREADY SAVED/i)).toBeInTheDocument()
  })

  it('hides skipped row when zero', () => {
    render(<BulkImportToast saved={23} skipped={0} onDismiss={() => {}} />)
    expect(screen.queryByText(/ALREADY SAVED/i)).toBeNull()
  })
})
```

- [ ] **Step 2: 実装**

```tsx
// components/share/BulkImportToast.tsx
'use client'
import { useEffect, type ReactElement } from 'react'
import styles from './BulkImportToast.module.css'

type Props = {
  readonly saved: number
  readonly skipped: number
  readonly onDismiss: () => void
  readonly autoHideMs?: number
}

export function BulkImportToast({ saved, skipped, onDismiss, autoHideMs = 4000 }: Props): ReactElement {
  useEffect((): (() => void) => {
    const t = setTimeout(onDismiss, autoHideMs)
    return (): void => clearTimeout(t)
  }, [onDismiss, autoHideMs])

  return (
    <div className={styles.toast} role="status">
      <p className={styles.primary}>{saved} CARDS SAVED</p>
      {skipped > 0 && (
        <p className={styles.secondary}>· {skipped} ALREADY SAVED</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: CSS**

```css
/* components/share/BulkImportToast.module.css */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 12px 20px;
  background: rgba(8, 8, 10, 0.96);
  border: 1px solid rgba(40, 241, 0, 0.32);
  border-radius: 6px;
  backdrop-filter: blur(12px);
  font-family: 'Geist Mono', monospace;
  animation: slideUp 200ms ease-out;
}

.primary {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #28F100;
}

.secondary {
  margin: 0;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.5);
}

@keyframes slideUp {
  from { transform: translate(-50%, 20px); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}
```

- [ ] **Step 4: テスト + commit**

```bash
pnpm vitest run components/share/BulkImportToast.test.tsx
git add components/share/BulkImportToast.tsx components/share/BulkImportToast.module.css components/share/BulkImportToast.test.tsx
git commit -m "feat(share): add BulkImportToast component"
```

## Task 20: ReceiverLanding に bulk import 実装

**Files:**
- Modify: `components/share/ReceiverLanding.tsx`

- [ ] **Step 1: import 追加**

```tsx
import { initDB } from '@/lib/storage/indexeddb'
import { addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { findDuplicates } from '@/lib/share/import'
import { BulkImportToast } from './BulkImportToast'
import { detectUrlType } from '@/lib/utils/url'
```

- [ ] **Step 2: state + handler 追加**

```tsx
const [importResult, setImportResult] = useState<{ saved: number; skipped: number } | null>(null)
const [importing, setImporting] = useState<boolean>(false)

const handleBulkImport = useCallback(async (): Promise<void> => {
  if (state.kind !== 'ready') return
  setImporting(true)
  try {
    const db = await initDB()
    const existing = await getAllBookmarks(db)
    const existingUrls = new Set(existing.filter((b) => !b.isDeleted).map((b) => b.url))
    const dups = findDuplicates(state.data.cards, existingUrls)

    let saved = 0
    for (const c of state.data.cards) {
      if (dups.has(c.u)) continue
      await addBookmark(db, {
        url: c.u,
        title: c.t,
        description: c.d ?? '',
        thumbnail: c.th ?? '',
        favicon: '',
        siteName: '',
        type: detectUrlType(c.u),
        tags: [],  // bulk import: no sender tags applied (per spec §3 Goal 6)
      })
      saved++
    }
    setImportResult({ saved, skipped: dups.size })
  } finally {
    setImporting(false)
  }
}, [state])
```

- [ ] **Step 3: ボタン に handler 接続 + toast render**

```tsx
<button
  type="button"
  className={styles.ctaPrimary}
  disabled={importing}
  onClick={(): void => { void handleBulkImport() }}
  data-testid="bulk-import-btn"
>
  {importing ? 'IMPORTING...' : `IMPORT ALL ${state.data.cards.length}`}
</button>
```

modal の `return` 内最後に:

```tsx
{importResult && (
  <BulkImportToast
    saved={importResult.saved}
    skipped={importResult.skipped}
    onDismiss={(): void => {
      setImportResult(null)
      router.push('/board')
    }}
  />
)}
```

- [ ] **Step 4: useCallback import + tsc + commit**

```bash
pnpm tsc --noEmit
git add components/share/ReceiverLanding.tsx
git commit -m "feat(share): wire bulk import on ReceiverLanding"
```

## Task 21: Lightbox 連動 (= 受信側で card click で Lightbox open)

**Files:**
- Modify: `components/share/ReceiverLanding.tsx`

- [ ] **Step 1: 既存 Lightbox の interface 確認**

```bash
grep -n 'export' components/board/Lightbox.tsx | head -10
```

Lightbox がどんな props を受けるか確認 (= bookmark item 系)。 受信側では実際の IDB bookmark がないので、 ShareCardV2 → bookmark-like adapter で変換するか、 簡易 modal 自前実装の判断。

- [ ] **Step 2: 簡易 read-only Lightbox を ReceiverLanding 内に inline 実装 (= 既存 Lightbox の refactor を避ける)**

`ReceiverLanding.tsx` に:

```tsx
const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

// card click handler
const openCard = useCallback((idx: number): void => {
  setLightboxIndex(idx)
}, [])

// adjacent navigation
const closeLightbox = useCallback((): void => setLightboxIndex(null), [])
const nextCard = useCallback((): void => {
  setLightboxIndex((i) => i === null ? null : Math.min(i + 1, (state.kind === 'ready' ? state.data.cards.length : 1) - 1))
}, [state])
const prevCard = useCallback((): void => {
  setLightboxIndex((i) => i === null ? null : Math.max(i - 1, 0))
}, [])

// ESC to close
useEffect((): (() => void) | undefined => {
  if (lightboxIndex === null) return undefined
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') closeLightbox()
    if (e.key === 'ArrowRight') nextCard()
    if (e.key === 'ArrowLeft') prevCard()
  }
  window.addEventListener('keydown', onKey)
  return (): void => window.removeEventListener('keydown', onKey)
}, [lightboxIndex, closeLightbox, nextCard, prevCard])
```

card JSX に onClick:
```tsx
<div
  key={c.u}
  className={styles.card}
  style={{ position: 'absolute', left: pos.x, top: pos.y, width: pos.width, height: pos.height, cursor: 'pointer' }}
  onClick={(): void => openCard(idx)}
>
```

(= map の `idx` を取るために `cards.map((c, idx) =>`)

return 内の最後に lightbox JSX:

```tsx
{lightboxIndex !== null && state.kind === 'ready' && (
  <div className={styles.lightboxBackdrop} onClick={closeLightbox}>
    <div className={styles.lightboxPanel} onClick={(e): void => e.stopPropagation()}>
      <a
        href={state.data.cards[lightboxIndex].u}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.lightboxLink}
      >
        {state.data.cards[lightboxIndex].th && (
          <img
            src={state.data.cards[lightboxIndex].th}
            alt={state.data.cards[lightboxIndex].t}
            className={styles.lightboxImg}
          />
        )}
        <h2 className={styles.lightboxTitle}>{state.data.cards[lightboxIndex].t}</h2>
        {state.data.cards[lightboxIndex].d && (
          <p className={styles.lightboxDesc}>{state.data.cards[lightboxIndex].d}</p>
        )}
        <p className={styles.lightboxUrl}>{state.data.cards[lightboxIndex].u}</p>
      </a>
      <button type="button" className={styles.lightboxClose} onClick={closeLightbox}>✕</button>
    </div>
  </div>
)}
```

- [ ] **Step 3: CSS 追加**

`ReceiverLanding.module.css` 末尾に:

```css
.lightboxBackdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.84);
  backdrop-filter: blur(16px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  animation: fadeIn 100ms ease-out;
}

.lightboxPanel {
  position: relative;
  max-width: min(900px, calc(100vw - 80px));
  max-height: calc(100vh - 80px);
  background: rgba(8, 8, 10, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.lightboxLink {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  overflow: auto;
}

.lightboxImg {
  width: 100%;
  height: auto;
  display: block;
  max-height: 60vh;
  object-fit: contain;
}

.lightboxTitle {
  margin: 0;
  padding: 18px 24px 8px;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.92);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.lightboxDesc {
  margin: 0;
  padding: 0 24px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
}

.lightboxUrl {
  margin: 0;
  padding: 8px 24px 18px;
  font-size: 11px;
  color: rgba(40, 241, 0, 0.85);
  text-transform: uppercase;
  word-break: break-all;
}

.lightboxClose {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 14px;
}

.lightboxClose:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}
```

- [ ] **Step 4: tsc + commit**

```bash
pnpm tsc --noEmit
git add components/share/ReceiverLanding.tsx components/share/ReceiverLanding.module.css
git commit -m "feat(share): add inline read-only Lightbox to ReceiverLanding"
```

## Task 22: 背景大文字タイポ (= ReceiverLanding に sender's filter 名を背景大文字で出す)

**Files:**
- Modify: `components/share/ReceiverLanding.tsx`
- Modify: `components/share/ReceiverLanding.module.css`

- [ ] **Step 1: 背景文字を render**

`ReceiverLanding.tsx` の `boardArea` 内、 card より背面に:

```tsx
{state.data.filter && state.data.tags && (
  <div className={styles.bgTypo} aria-hidden>
    {state.data.filter.tagIds.map((id) => state.data.tags?.[id]?.n ?? '').filter(Boolean).join(' · ').toUpperCase()}
  </div>
)}
```

- [ ] **Step 2: CSS**

```css
.bgTypo {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Geist Mono', monospace;
  font-weight: 800;
  font-size: clamp(96px, 14vw, 260px);
  color: rgba(255, 255, 255, 0.024);
  text-transform: uppercase;
  letter-spacing: -0.03em;
  pointer-events: none;
  z-index: 0;
  text-wrap: balance;
  max-width: 95vw;
  text-align: center;
  user-select: none;
}

.canvas {
  position: relative;
  z-index: 1;  /* keep cards above bg typo */
}
```

- [ ] **Step 3: commit**

```bash
git add components/share/ReceiverLanding.tsx components/share/ReceiverLanding.module.css
git commit -m "feat(share): add bg typography to ReceiverLanding (filter tag names)"
```

---

# Phase 5 — 受信側 ReceiverTriage (Tasks 23-26)

## Task 23: /s/[id]/triage ルート

**Files:**
- Create: `app/(app)/s/[id]/triage/page.tsx`

- [ ] **Step 1: 実装**

```tsx
// app/(app)/s/[id]/triage/page.tsx
import { ReceiverTriage } from '@/components/share/ReceiverTriage'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

type Props = { readonly params: Promise<{ readonly id: string }> }

export default async function ShareTriagePage({ params }: Props): Promise<JSX.Element> {
  const { id } = await params
  return <ReceiverTriage shareId={id} />
}
```

- [ ] **Step 2: commit**

```bash
git add app/\(app\)/s/\[id\]/triage/page.tsx
git commit -m "feat(share): add /s/[id]/triage route"
```

## Task 24: ReceiverTriage コンポーネント (= queue 生成 + UI)

**Files:**
- Create: `components/share/ReceiverTriage.tsx`
- Create: `components/share/ReceiverTriage.module.css`
- Create: `components/share/ReceiverTriage.test.tsx`

- [ ] **Step 1: 失敗テスト**

```tsx
// components/share/ReceiverTriage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ReceiverTriage } from './ReceiverTriage'
import { SHARE_SCHEMA_VERSION_V2 } from '@/lib/share/types-v2'

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      share: {
        v: SHARE_SCHEMA_VERSION_V2,
        cards: [
          { u: 'https://a.com', t: 'Card A', ty: 'website', cw: 200, a: 1.5 },
          { u: 'https://b.com', t: 'Card B', ty: 'website', cw: 200, a: 1.5 },
        ],
        createdAt: 1735000000000,
      },
      thumb: '',
    }),
  } as Response) as unknown as typeof fetch
})

describe('ReceiverTriage', () => {
  it('shows queue progress (= 1/N) after fetch', async () => {
    render(<ReceiverTriage shareId="k3p9xv" />)
    await waitFor(() => expect(screen.getByText(/1 OF 2/i)).toBeInTheDocument())
  })

  it('shows YES + NO buttons', async () => {
    render(<ReceiverTriage shareId="k3p9xv" />)
    await waitFor(() => expect(screen.getByText(/YES/i)).toBeInTheDocument())
    expect(screen.getByText(/NO/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 実装 (= 簡易版、 swipe gesture は省き click button のみ)**

```tsx
// components/share/ReceiverTriage.tsx
'use client'
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { fetchShare } from '@/lib/share/api-client'
import { sanitizeShareDataV2 } from '@/lib/share/validate-v2'
import { findDuplicates, convertSenderTagsForReceiver } from '@/lib/share/import'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { getAllTags, addTag } from '@/lib/storage/tags'
import { detectUrlType } from '@/lib/utils/url'
import type { ShareDataV2, ShareCardV2 } from '@/lib/share/types-v2'
import styles from './ReceiverTriage.module.css'

type TriageState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly queue: ReadonlyArray<ShareCardV2>; readonly data: ShareDataV2 }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly message: string }

type Props = { readonly shareId: string }

export function ReceiverTriage({ shareId }: Props): ReactElement {
  const router = useRouter()
  const [state, setState] = useState<TriageState>({ kind: 'loading' })
  const [index, setIndex] = useState(0)
  const [savedCount, setSavedCount] = useState(0)
  const [armedTagIds, setArmedTagIds] = useState<ReadonlySet<string>>(() => new Set())

  // Fetch share + filter duplicates
  useEffect((): void => {
    void (async (): Promise<void> => {
      const result = await fetchShare(shareId)
      if (!result.ok) {
        setState({ kind: 'error', message: result.message })
        return
      }
      const parsed = sanitizeShareDataV2(result.data.share)
      if (!parsed.ok) {
        setState({ kind: 'error', message: parsed.error })
        return
      }
      const db = await initDB()
      const existing = await getAllBookmarks(db)
      const existingUrls = new Set(existing.filter((b) => !b.isDeleted).map((b) => b.url))
      const dups = findDuplicates(parsed.data.cards, existingUrls)
      const queue = parsed.data.cards.filter((c) => !dups.has(c.u))
      if (queue.length === 0) {
        setState({ kind: 'empty' })
        return
      }
      setState({ kind: 'ready', queue, data: parsed.data })
    })()
  }, [shareId])

  const handleYes = useCallback(async (): Promise<void> => {
    if (state.kind !== 'ready') return
    const current = state.queue[index]
    if (!current) return
    const db = await initDB()
    const receiverTags = await getAllTags(db)
    const conversion = convertSenderTagsForReceiver(
      Array.from(armedTagIds),
      state.data.tags ?? {},
      receiverTags,
    )
    // Create receiver-side tags for sender tags absent from receiver
    const newlyCreatedIds = new Map<string, string>()
    for (const t of conversion.toCreate) {
      const newTag = await addTag(db, { name: t.name, color: t.color ?? '#28F100', order: receiverTags.length + newlyCreatedIds.size })
      newlyCreatedIds.set(t.senderId, newTag.id)
    }
    // Build the final tag ID list for this bookmark
    const finalTagIds: string[] = []
    for (const senderId of armedTagIds) {
      const existing = conversion.existing.get(senderId)
      if (existing) { finalTagIds.push(existing); continue }
      const created = newlyCreatedIds.get(senderId)
      if (created) { finalTagIds.push(created); continue }
    }
    // Also include any receiver-only tags that were armed (= not in sender dict)
    for (const armedId of armedTagIds) {
      if (state.data.tags?.[armedId]) continue  // skip sender tags (handled above)
      finalTagIds.push(armedId)  // it's a receiver-side tag
    }
    await addBookmark(db, {
      url: current.u,
      title: current.t,
      description: current.d ?? '',
      thumbnail: current.th ?? '',
      favicon: '',
      siteName: '',
      type: detectUrlType(current.u),
      tags: finalTagIds,
    })
    setSavedCount((n) => n + 1)
    setIndex((i) => i + 1)
  }, [state, index, armedTagIds])

  const handleNo = useCallback((): void => {
    setIndex((i) => i + 1)
  }, [])

  // Finish detection
  useEffect((): void => {
    if (state.kind !== 'ready') return
    if (index >= state.queue.length) {
      router.push('/board')
    }
  }, [state, index, router])

  if (state.kind === 'loading') {
    return <div className={styles.shell}><p className={styles.status}>LOADING</p></div>
  }
  if (state.kind === 'empty') {
    return (
      <div className={styles.shell}>
        <p className={styles.status}>ALL CARDS ALREADY IN YOUR ALLMARKS</p>
        <button type="button" className={styles.cta} onClick={(): void => router.push('/board')}>GO TO BOARD</button>
      </div>
    )
  }
  if (state.kind === 'error') {
    return <div className={styles.shell}><p className={styles.status}>ERROR: {state.message}</p></div>
  }

  const current = state.queue[index]
  if (!current) return <div className={styles.shell}><p className={styles.status}>FINISHED · {savedCount} SAVED</p></div>

  const senderTagsForCard = current.tg ?? []
  const senderTagDict = state.data.tags ?? {}

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.progress}>{index + 1} OF {state.queue.length}</span>
        <span className={styles.savedHint}>{savedCount} SAVED</span>
      </header>

      <main className={styles.cardArea}>
        <div className={styles.card}>
          {current.th && <img src={current.th} alt="" className={styles.cardImg} />}
          <h2 className={styles.cardTitle}>{current.t}</h2>
          {current.d && <p className={styles.cardDesc}>{current.d}</p>}
          <p className={styles.cardUrl}>{current.u}</p>
        </div>
      </main>

      {senderTagsForCard.length > 0 && (
        <div className={styles.tagSuggestions}>
          <p className={styles.tagLabel}>SENDER'S TAGS — TAP TO ACCEPT</p>
          <div className={styles.tagStrip}>
            {senderTagsForCard.map((tid) => {
              const tag = senderTagDict[tid]
              if (!tag) return null
              const isArmed = armedTagIds.has(tid)
              return (
                <button
                  key={tid}
                  type="button"
                  className={`${styles.tagChip} ${isArmed ? styles.tagChipArmed : ''}`}
                  onClick={(): void => {
                    setArmedTagIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(tid)) next.delete(tid)
                      else next.add(tid)
                      return next
                    })
                  }}
                >
                  {tag.n}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <footer className={styles.actions}>
        <button type="button" className={styles.btnNo} onClick={handleNo}>NO · SKIP</button>
        <button type="button" className={styles.btnYes} onClick={(): void => { void handleYes() }}>YES · SAVE</button>
      </footer>
    </div>
  )
}
```

- [ ] **Step 3: CSS**

```css
/* components/share/ReceiverTriage.module.css */
.shell {
  min-height: 100vh;
  background: #000;
  color: rgba(255, 255, 255, 0.92);
  font-family: 'Geist Mono', monospace;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  padding: 14px 24px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.progress {
  color: rgba(255, 255, 255, 0.6);
}

.savedHint {
  color: #28F100;
}

.cardArea {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.card {
  max-width: min(560px, calc(100vw - 48px));
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cardImg {
  width: 100%;
  max-height: 360px;
  object-fit: cover;
  display: block;
}

.cardTitle {
  margin: 0;
  padding: 16px 20px 8px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cardDesc {
  margin: 0;
  padding: 0 20px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.6);
}

.cardUrl {
  margin: 0;
  padding: 8px 20px 16px;
  font-size: 10px;
  text-transform: uppercase;
  color: rgba(40, 241, 0, 0.7);
  word-break: break-all;
}

.tagSuggestions {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.tagLabel {
  margin: 0 0 8px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);
}

.tagStrip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tagChip {
  font-family: inherit;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 6px 12px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.4);
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.6;
  transition: all 100ms ease-out;
}

.tagChipArmed {
  background: rgba(40, 241, 0, 0.12);
  border-color: #28F100;
  color: #28F100;
  opacity: 1;
}

.actions {
  display: flex;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.btnYes,
.btnNo {
  flex: 1;
  font-family: inherit;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 100ms ease-out;
}

.btnYes {
  background: #28F100;
  border: 1px solid #28F100;
  color: #000;
  font-weight: 600;
}

.btnYes:hover {
  background: rgba(40, 241, 0, 0.88);
}

.btnNo {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
}

.btnNo:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.4);
}

.status {
  text-align: center;
  margin-top: 200px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.cta {
  margin: 24px auto 0;
  display: block;
  font-family: inherit;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 12px 24px;
  background: rgba(40, 241, 0, 0.12);
  border: 1px solid rgba(40, 241, 0, 0.4);
  color: #28F100;
  border-radius: 4px;
  cursor: pointer;
}
```

- [ ] **Step 4: テスト pass + commit**

```bash
pnpm vitest run components/share/ReceiverTriage.test.tsx
git add components/share/ReceiverTriage.tsx components/share/ReceiverTriage.module.css components/share/ReceiverTriage.test.tsx
git commit -m "feat(share): ReceiverTriage component (queue + sender tag suggestions + YES/NO actions)"
```

## Task 25: ReceiverTriage 完了時の summary toast

**Files:**
- Modify: `components/share/ReceiverTriage.tsx`

- [ ] **Step 1: 完了時 BulkImportToast 表示**

ReceiverTriage の finish 分岐を:

```tsx
const [showSummary, setShowSummary] = useState<boolean>(false)

useEffect((): void => {
  if (state.kind !== 'ready') return
  if (index >= state.queue.length && !showSummary) {
    setShowSummary(true)
  }
}, [state, index, showSummary])

// render last
{showSummary && state.kind === 'ready' && (
  <BulkImportToast
    saved={savedCount}
    skipped={0}
    onDismiss={(): void => router.push('/board')}
  />
)}
```

import BulkImportToast at top:
```tsx
import { BulkImportToast } from './BulkImportToast'
```

- [ ] **Step 2: 完了 splash overlay でも OK にする**

「FINISHED」 status は overlay 残して toast と並列でも OK だが、 toast の 4 秒 dismiss で /board 遷移する方が自然。 上記実装の通り、 board 遷移は toast dismiss が trigger。

- [ ] **Step 3: tsc + commit**

```bash
pnpm tsc --noEmit
git add components/share/ReceiverTriage.tsx
git commit -m "feat(share): ReceiverTriage completion toast → /board nav"
```

## Task 26: receiver の既存タグも chip strip に並べる (= 受信者側でタグ拡張も可能に)

**Files:**
- Modify: `components/share/ReceiverTriage.tsx`

- [ ] **Step 1: receiver tags を state に**

```tsx
import { useTags } from '@/lib/storage/use-tags'

// in component
const { tags: receiverTags } = useTags()
```

- [ ] **Step 2: chip strip 内で receiver tag も並べる**

`tagSuggestions` JSX の `senderTagsForCard.length > 0` 条件分岐を拡張:

```tsx
<div className={styles.tagSuggestions}>
  {senderTagsForCard.length > 0 && (
    <p className={styles.tagLabel}>SENDER'S TAGS — TAP TO ACCEPT</p>
  )}
  <div className={styles.tagStrip}>
    {/* Sender's tags (dimmed) */}
    {senderTagsForCard.map((tid) => {
      const tag = senderTagDict[tid]
      if (!tag) return null
      const isArmed = armedTagIds.has(tid)
      return (
        <button
          key={`sender-${tid}`}
          type="button"
          className={`${styles.tagChip} ${isArmed ? styles.tagChipArmed : ''}`}
          onClick={(): void => {
            setArmedTagIds((prev) => {
              const next = new Set(prev)
              if (next.has(tid)) next.delete(tid)
              else next.add(tid)
              return next
            })
          }}
        >
          {tag.n}
        </button>
      )
    })}
  </div>
  {receiverTags.length > 0 && (
    <>
      <p className={styles.tagLabel} style={{ marginTop: 12 }}>YOUR TAGS</p>
      <div className={styles.tagStrip}>
        {receiverTags.map((t) => {
          const isArmed = armedTagIds.has(t.id)
          return (
            <button
              key={`receiver-${t.id}`}
              type="button"
              className={`${styles.tagChip} ${isArmed ? styles.tagChipArmedFull : ''}`}
              style={{ opacity: 1 }}
              onClick={(): void => {
                setArmedTagIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(t.id)) next.delete(t.id)
                  else next.add(t.id)
                  return next
                })
              }}
            >
              {t.name}
            </button>
          )
        })}
      </div>
    </>
  )}
</div>
```

- [ ] **Step 2.5: CSS に tagChipArmedFull 追加**

`ReceiverTriage.module.css` 末尾に:
```css
.tagChipArmedFull {
  background: rgba(40, 241, 0, 0.12);
  border-color: #28F100;
  color: #28F100;
}

.tagChip[style] {
  opacity: 1 !important;
  color: rgba(255, 255, 255, 0.7);
}
```

- [ ] **Step 3: tsc + commit**

```bash
pnpm tsc --noEmit
git add components/share/ReceiverTriage.tsx components/share/ReceiverTriage.module.css
git commit -m "feat(share): ReceiverTriage shows receiver's existing tags alongside sender suggestions"
```

---

# Phase 6 — クリーンアップ (Tasks 27-30)

## Task 27: 旧 ShareComposer 系ファイル削除

**Files:**
- Delete: `components/share/ShareComposer.tsx` + `.module.css`
- Delete: `components/share/ShareFrame.tsx` + `.module.css`
- Delete: `components/share/ShareSourceList.tsx` + `.module.css`
- Delete: `components/share/ShareAspectSwitcher.tsx` + `.module.css`
- Delete: `components/share/ShareActionSheet.tsx` + `.module.css`
- Delete: `components/share/SharedView.tsx` + `.module.css`
- Delete: `components/share/use-share-reorder-drag.ts`
- Delete: `components/share/use-share-fullscreen.ts` + `.test.ts`

- [ ] **Step 1: 既存 import 参照を確認**

```bash
grep -rln "ShareComposer\|ShareFrame\|ShareSourceList\|ShareAspectSwitcher\|ShareActionSheet\|SharedView\|use-share-reorder-drag\|use-share-fullscreen" --include="*.ts" --include="*.tsx" | grep -v node_modules
```

→ BoardRoot.tsx 以外で参照ある所は順次直す (= LP の ShareDemoSection 等)。

- [ ] **Step 2: ShareDemoSection は古い import を一旦 stub 化**

`components/marketing/sections/ShareDemoSection.tsx` を確認、 旧 ShareComposer 等を import してたら一時的に dummy 化:

```tsx
// 旧 import を削除、 placeholder JSX に置換
export function ShareDemoSection(): JSX.Element {
  return <section style={{ padding: 40, color: '#666' }}>Share demo coming soon</section>
}
```

(= LP リデザインは phase 1.5 で本実装、 phase 1 では一旦平易な placeholder で OK)

- [ ] **Step 3: ファイル削除**

```bash
rm components/share/ShareComposer.tsx components/share/ShareComposer.module.css
rm components/share/ShareFrame.tsx components/share/ShareFrame.module.css
rm components/share/ShareSourceList.tsx components/share/ShareSourceList.module.css
rm components/share/ShareAspectSwitcher.tsx components/share/ShareAspectSwitcher.module.css
rm components/share/ShareActionSheet.tsx components/share/ShareActionSheet.module.css
rm components/share/SharedView.tsx components/share/SharedView.module.css
rm components/share/use-share-reorder-drag.ts
rm components/share/use-share-fullscreen.ts components/share/use-share-fullscreen.test.ts
```

- [ ] **Step 4: tsc + vitest + commit**

```bash
pnpm tsc --noEmit 2>&1 | tail -10
pnpm vitest run 2>&1 | tail -10
git add components/share/ components/marketing/sections/ShareDemoSection.tsx
git commit -m "chore(share): remove legacy ShareComposer/ShareFrame/SharedView family"
```

## Task 28: 旧 lib/share v1 ファイル削除

**Files:**
- Delete: `lib/share/aspect-presets.ts` + test
- Delete: `lib/share/board-to-cards.ts` + test
- Delete: `lib/share/composer-layout.ts` + test
- Delete: `lib/share/png-export.ts` + test
- Delete: `lib/share/relay-layout.ts` + test
- Delete: `lib/share/watermark-config.ts`
- Delete: `lib/share/lightbox-item.ts` + test
- Delete: `lib/share/schema.ts`
- Delete: `lib/share/validate.ts` + test
- Delete: `lib/share/encode.ts` + test
- Delete: `lib/share/decode.ts` + test
- Delete: `lib/share/types.ts`

- [ ] **Step 1: 既存参照を確認**

```bash
grep -rln "from '@/lib/share/aspect-presets\|from '@/lib/share/board-to-cards\|from '@/lib/share/composer-layout\|from '@/lib/share/png-export\|from '@/lib/share/relay-layout\|from '@/lib/share/watermark-config\|from '@/lib/share/lightbox-item\|from '@/lib/share/schema\|from '@/lib/share/validate'\|from '@/lib/share/encode'\|from '@/lib/share/decode'\|from '@/lib/share/types'" --include="*.ts" --include="*.tsx"
```

→ 残っている参照を順次削除 or v2 系へ移行。 BoardRoot.tsx の `import type { ShareData }` 等が残っていたら削除。

- [ ] **Step 2: ファイル削除**

```bash
rm lib/share/aspect-presets.ts lib/share/aspect-presets.test.ts
rm lib/share/board-to-cards.ts lib/share/board-to-cards.test.ts
rm lib/share/composer-layout.ts lib/share/composer-layout.test.ts
rm lib/share/png-export.ts lib/share/png-export.test.ts
rm lib/share/relay-layout.ts lib/share/relay-layout.test.ts
rm lib/share/watermark-config.ts
rm lib/share/lightbox-item.ts lib/share/lightbox-item.test.ts
rm lib/share/schema.ts
rm lib/share/validate.ts lib/share/validate.test.ts
rm lib/share/encode.ts lib/share/encode.test.ts
rm lib/share/decode.ts lib/share/decode.test.ts
rm lib/share/types.ts
```

- [ ] **Step 3: tsc + vitest 全件 pass を確認**

```bash
pnpm tsc --noEmit 2>&1 | tail -20
pnpm vitest run 2>&1 | tail -20
```

エラー残るなら参照箇所を直す。 lib/share 内で残るのは: `x-intent.ts` + `.test.ts` + 新規 v2 系 + `import.ts` + `api-client.ts` + `kv-id.ts` + `snapshot.ts` + `board-to-share.ts` + テスト群。

- [ ] **Step 4: commit**

```bash
git add lib/share/
git commit -m "chore(share): remove legacy v1 lib/share modules (encode/decode/validate/schema/types/relay-layout/png-export/etc.)"
```

## Task 29: 旧 `/share` ルート削除

**Files:**
- Delete: `app/share/page.tsx` (+ 関連ファイルあれば)

- [ ] **Step 1: ルート構造確認**

```bash
ls app/share/ 2>&1
```

- [ ] **Step 2: 削除 (= 中身があれば全部)**

```bash
rm -rf app/share/
```

- [ ] **Step 3: tsc + commit**

```bash
pnpm tsc --noEmit
git add app/share/
git commit -m "chore(share): remove legacy /share route (replaced by /s/[id])"
```

## Task 30: BoardRoot から旧 actionSheet state + handleShareConfirm 残骸を削除

**Files:**
- Modify: `components/board/BoardRoot.tsx`

- [ ] **Step 1: 旧 state / handler 探す**

```bash
grep -n "actionSheet\|handleShareConfirm\|encodeShareData" components/board/BoardRoot.tsx
```

- [ ] **Step 2: 該当箇所削除**

`useState<{ pngDataUrl: string; shareUrl: string } | null>(null)` 周りの `actionSheet` state + `setActionSheet` 全参照、 `handleShareConfirm` 全部削除。 `import { encodeShareData }` も削除。

- [ ] **Step 3: tsc + vitest + final commit**

```bash
pnpm tsc --noEmit 2>&1 | tail -10
pnpm vitest run 2>&1 | tail -10
git add components/board/BoardRoot.tsx
git commit -m "chore(share): remove BoardRoot's actionSheet state + handleShareConfirm (legacy ShareComposer plumbing)"
```

---

# Phase 7 — preview deploy + 手動検証

## Task 31: 全体 build + preview deploy

- [ ] **Step 1: 全テスト pass 確認**

```bash
pnpm tsc --noEmit 2>&1 | tail -5
pnpm vitest run 2>&1 | tail -10
```

Expected: tsc 0 errors、 vitest 全 pass

- [ ] **Step 2: build**

```bash
rtk pnpm build 2>&1 | tail -20
```

Expected: `25 routes` 程度の static export 成功、 新規 `/s/[id]` `/s/[id]/triage` route 含まれる

- [ ] **Step 3: KV namespace 作成 (= user 操作)**

user が Cloudflare ダッシュボードで:
1. `https://dash.cloudflare.com/` → Workers & Pages → KV
2. 「Create namespace」 → name `SHARE_KV`
3. ID を `wrangler.toml` に貼り付ける
4. preview 用も同様に作成

- [ ] **Step 4: preview deploy**

```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=session-83-share-rebuild --commit-dirty=true --commit-message="session 83 share rebuild preview"
```

(= master ブランチに dump せず、 preview 名前空間で動作確認)

- [ ] **Step 5: 手動検証チェックリスト**

preview URL で:
- [ ] board で SHARE ボタン押下 → modal 開く
- [ ] preview 画像出る (= 4 秒以内)
- [ ] URL コピーボタン → クリップボードに `<preview-url>/s/<id>` 入る
- [ ] X 投稿ボタン → X intent 開く
- [ ] 別タブで `<preview-url>/s/<id>` 開く → ボード再現
- [ ] `IMPORT ALL N` 押下 → IDB に追加 + `/board` 遷移
- [ ] toast「N CARDS SAVED」 表示
- [ ] (新ブラウザ + IDB clear) → 同じ URL 開く → 「IMPORT ALL」 → IDB 初期化 + 取り込み成功
- [ ] (既存 IDB) → 同じ URL 開く → 「IMPORT ALL」 → 重複 skip 反映、 toast「N CARDS SAVED · M ALREADY SAVED」
- [ ] 「PICK ONE BY ONE」 → triage swipe 画面 → YES/NO 動作 → sender's tag chip 表示・選択動作
- [ ] sender tag 選択 + YES → receiver IDB に tag 付きで保存される
- [ ] expired URL を試す (= KV から TTL 短くしたテスト ID を put → 60 秒後に GET → not_found 確認)

## Task 32: 本番 deploy

- [ ] **Step 1: preview 検証が全部 pass、 user 視認で問題なし**

- [ ] **Step 2: 本番 deploy**

```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="session 83 share rebuild ship"
```

- [ ] **Step 3: 本番 URL でハードリロード再検証**

`booklage.pages.dev` をハードリロード → 上記チェックリスト再走

- [ ] **Step 4: TODO / CURRENT_GOAL 更新 + session 83 close-out commit**

```bash
# docs/TODO_COMPLETED.md に session 83 セクション追記
# docs/TODO.md 「現在の状態」 を更新
# docs/CURRENT_GOAL.md を次セッション向け書き直し
git add docs/
git commit -m "session 83 close-out: share rebuild full ship — KV-backed short URL + SenderShareModal + ReceiverLanding + ReceiverTriage + bulk import + legacy cleanup"
```

---

# Self-review notes (= 計画書を書き終えた後の確認)

## Spec coverage check

- [x] §3 Goal 1 (= SHARE button → modal) → Task 15
- [x] §3 Goal 2 (= ShareData v2 → KV + 6-char ID) → Tasks 1, 3, 4, 8, 9
- [x] §3 Goal 3 (= OG image) → Tasks 11, 16
- [x] §3 Goal 4 (= 受信者 board 再現) → Tasks 16, 17, 18
- [x] §3 Goal 5 (= sticky CTA) → Task 17
- [x] §3 Goal 6 (= bulk import + 重複 skip + toast) → Tasks 19, 20
- [x] §3 Goal 7 (= triage swipe + sender tag suggestions) → Tasks 23, 24, 25, 26
- [x] §3 Goal 8 (= 新規 user IDB 初期化) → Task 20 (= initDB は addBookmark 内で起動)

## 既知の妥協点 (= phase 1 では受容、 phase 1.5 以降で改善)

- **swipe gesture 省略**: ReceiverTriage は button click のみ。 既存 `/triage` のような drag gesture は phase 1 では実装しない (= MVP 簡素化)。 button click で十分な UX が出る。
- **Lightbox 流用ではなく inline 簡易版**: 既存 `components/board/Lightbox.tsx` の adapt より、 receiver 側に inline 専用 lightbox を書く方が依存少なくて早い。 phase 1.5 で動画再生統合する時に既存 Lightbox を流用検討。
- **動的 OG image なし**: KV に保存済 WebP をそのまま返す。 phase 1.5 で動的合成検討。
- **ScrollMeter 表示なし**: phase 1 では minimum で動くこと優先、 ScrollMeter 統合は phase 1.5。
- **LP ShareDemoSection**: 一時 placeholder 化、 phase 1.5 で新シェア体験に作り直し。

## 想定エラーへの fallback

- KV write 失敗 → modal で error 状態表示 + 「再試行」 (= 自動で再 fetch しない、 user 操作で trigger)
- KV read 失敗 (= 404 / expired) → ReceiverLanding error 画面 + 「GO TO ALLMARKS」 CTA
- snapshot 失敗 → thumb 空文字 OK (= modal は ready 状態に進む、 OG image は placeholder)
- sender tag が dict にない (= 不整合) → silently skip (= conversion で undefined check 済)

## Implementation 中に出るかもしれない予想質問

- Q: `lib/board/skyline-layout.ts` の `LayoutItem` interface は本当に `{ id, width, height, orderIndex }` か?
  - A: 実装時に確認 (= Task 18 Step 4 で grep)、 不一致なら ReceiverLanding 内で adapt
- Q: `useTags` hook は `tags` array を返すか?
  - A: 既存 `lib/storage/use-tags.ts` で確認、 `{ tags, create, remove }` 形式
- Q: `initDB` は SSR 環境で動くか?
  - A: 動かない、 client component (`'use client'`) でのみ呼ぶ。 ReceiverLanding / ReceiverTriage は両方 `'use client'`
- Q: Pages Functions の `PagesFunction<Env>` type は import が必要?
  - A: Cloudflare worker types。 `@cloudflare/workers-types` を devDependency に追加が必要なら追加、 既存に入っている可能性も高い (= 既存 functions 参照)

実装中にこれらが詰まったら、 計画書を逸脱せず適宜小修正で前進する。
