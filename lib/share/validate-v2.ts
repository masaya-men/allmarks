// lib/share/validate-v2.ts
import { z } from 'zod'
import { SHARE_LIMITS_V2, SHARE_SCHEMA_VERSION_V2, type ShareDataV2 } from './types-v2'
import { listThemeIds } from '@/lib/board/theme-registry'
import type { ThemeId } from '@/lib/board/types'

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
  theme: z.enum(listThemeIds() as [ThemeId, ...ThemeId[]]).optional(),
  gap: z.number().min(0).max(300).optional(),
  w: z.number().positive().max(2000).optional(),
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
  // Sanitize theme: drop unknown values (e.g. legacy 'wave') to undefined so
  // Zod's optional field passes cleanly rather than rejecting the whole payload.
  const validThemes = new Set<string>(listThemeIds())
  const sanitizedTheme: ThemeId | undefined =
    typeof obj.theme === 'string' && validThemes.has(obj.theme)
      ? (obj.theme as ThemeId)
      : undefined
  obj.theme = sanitizedTheme
  return parseShareDataV2(obj)
}
