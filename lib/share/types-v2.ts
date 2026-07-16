// lib/share/types-v2.ts
import type { ThemeId, PatternType } from '@/lib/board/types'

/** Sender's resolved per-theme customization (the effective values they saw —
 *  edge/board/pattern colour, pattern style + density + thickness, title colour).
 *  Carried so the receiver + the OG image reproduce the exact look. The six
 *  original fields are required because the sender always sends the fully-resolved
 *  set (= ResolvedThemeCustomization). */
export type ShareCustomization = {
  readonly edgeColor: string
  readonly boardColor: string
  readonly patternColor: string
  readonly patternType: PatternType
  readonly patternSize: number
  /** Optional, unlike its siblings: links created before the thickness slider
   *  carry no value and the receiver falls back to the historic per-type default.
   *  Requiring it would drop `custom` from every existing share. */
  readonly patternStroke?: number
  readonly titleColor: string
  /** Board-frame corner rounding (--canvas-radius). Optional, like patternStroke:
   *  links created before this existed carry no value and the receiver falls back
   *  to square (the historic default for the non-paper frame). */
  readonly boardRounded?: boolean
}

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
  readonly theme?: ThemeId
  /** Sender's resolved customization for `theme` (pattern themes only; absent for
   *  fixed 'work' themes like Paper, and for old shares — receiver falls back to
   *  theme defaults). */
  readonly custom?: ShareCustomization
  /** Sender's global card gap in px (= the masonry spacing the sender saw).
   *  Per-card widths live on each card's `cw`; this is the one remaining
   *  global layout input. Optional for back-compat — shares created before
   *  this field fall back to the board's default gap on the receiver. */
  readonly gap?: number
  /** Sender's default card width in px (= cardWidthPx). Lets the receiver
   *  rebuild board state so TUNE behaves identically. Optional for
   *  back-compat — old shares fall back to BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX. */
  readonly w?: number
  readonly createdAt: number
}

/** KV entry structure (= what we write to Cloudflare KV).
 *  session 96 の R2 移行後、 KV にはデータ本体 (share) のみを書き、 画像 (thumb) は
 *  R2 bucket (SHARE_OG) に分離する (= KV を軽量化 + 画像は egress 無料の R2 で配信)。
 *  移行前に作られた共有は KV に thumb を持つので、 後方互換で optional のまま残す
 *  (og.ts が R2 → KV thumb の順でフォールバック、 30日 TTL で旧データは自然消滅)。 */
export type KVShareEntry = {
  readonly share: ShareDataV2
  /** Base64-encoded JPEG/WebP thumbnail。 R2 移行後の新規共有では未設定 (= R2 に分離)。 */
  readonly thumb?: string
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
  MAX_THUMB_BYTES: 300 * 1024,
  MAX_KV_ENTRY_BYTES: 600 * 1024,
  TTL_DAYS: 30,
  TTL_SECONDS: 30 * 24 * 60 * 60,
} as const
