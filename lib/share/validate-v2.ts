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

const customSchema = z.object({
  edgeColor: z.string().max(64),
  boardColor: z.string().max(64),
  patternColor: z.string().max(64),
  patternType: z.enum(['none', 'grid', 'diagonal', 'dots', 'crosshatch']),
  patternSize: z.number().min(8).max(200),
  // Optional: links predating the thickness slider carry no value and must keep
  // their `custom` block. The bound is generous; the render path clamps to spacing.
  patternStroke: z.number().min(0.5).max(20).optional(),
  titleColor: z.string().max(64),
})

const shareDataSchema = z.object({
  v: z.literal(SHARE_SCHEMA_VERSION_V2),
  cards: z.array(shareCardSchema).min(1).max(SHARE_LIMITS_V2.MAX_CARDS),
  tags: tagDictSchema.optional(),
  filter: z.object({
    mode: z.enum(['and', 'or']),
    tagIds: z.array(z.string().max(64)).max(50),
  }).optional(),
  theme: z.enum(listThemeIds() as [ThemeId, ...ThemeId[]]).optional(),
  custom: customSchema.optional(),
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
 *  where the sender's payload may have been tampered with in transit.
 *
 *  Pure: never mutates `input`. We build a shallow copy of the share object
 *  (and of any card we trim) so the caller's object is left untouched —
 *  reassigning `obj.cards`/`obj.theme` in place would silently corrupt a value
 *  the caller might still read elsewhere. */
export function sanitizeShareDataV2(input: unknown): ParseResult {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: 'not an object' }
  }
  const obj = input as Record<string, unknown>
  const next: Record<string, unknown> = { ...obj }

  if (Array.isArray(next.cards)) {
    next.cards = (next.cards as Array<Record<string, unknown>>).map((card) => {
      const copy: Record<string, unknown> = { ...card }
      if (typeof copy.t === 'string' && copy.t.length > SHARE_LIMITS_V2.MAX_TITLE) {
        copy.t = copy.t.slice(0, SHARE_LIMITS_V2.MAX_TITLE)
      }
      if (typeof copy.d === 'string' && copy.d.length > SHARE_LIMITS_V2.MAX_DESCRIPTION) {
        copy.d = copy.d.slice(0, SHARE_LIMITS_V2.MAX_DESCRIPTION)
      }
      return copy
    })
  }
  // Sanitize theme: drop unknown values (e.g. legacy 'wave') to undefined so
  // Zod's optional field passes cleanly rather than rejecting the whole payload.
  const validThemes = new Set<string>(listThemeIds())
  const sanitizedTheme: ThemeId | undefined =
    typeof next.theme === 'string' && validThemes.has(next.theme)
      ? (next.theme as ThemeId)
      : undefined
  next.theme = sanitizedTheme
  // Drop a malformed custom rather than failing the payload (theme still applies
  // its defaults). A well-formed custom passes through to the strict parse.
  if (next.custom !== undefined && !customSchema.safeParse(next.custom).success) {
    next.custom = undefined
  }
  return parseShareDataV2(next)
}
