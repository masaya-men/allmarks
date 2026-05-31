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
