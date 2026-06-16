import { z } from 'zod'
import type { QuickTag } from '@/lib/tagger/order-tags-for-save'

const SaveMessagePayload = z.object({
  url: z.string().min(1),
  title: z.string(),
  description: z.string(),
  image: z.string(),
  favicon: z.string(),
  siteName: z.string(),
  nonce: z.string().min(1),
  // Auto-save (SNS like/bookmark hook) path opts in: silently no-op if the URL
  // is already saved. Manual save paths leave this undefined and always insert.
  skipIfDuplicate: z.boolean().optional(),
})

const SaveMessage = z.object({
  type: z.literal('booklage:save'),
  payload: SaveMessagePayload,
})

export type SaveMessageInput = z.infer<typeof SaveMessage>

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export function parseSaveMessage(input: unknown): ParseResult<SaveMessageInput> {
  const r = SaveMessage.safeParse(input)
  if (r.success) return { ok: true, value: r.data }
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  }
}

/** Resolved theme tokens for the host-page strip (ready-to-use CSS values). */
export interface StripThemeTokens {
  bg: string
  fg: string
  border: string
  accent: string
  blur: string
}

export type SaveMessageResult =
  | {
      type: 'booklage:save:result'
      nonce: string
      ok: true
      bookmarkId: string
      skipped?: true
      /** Existing tags, relevant-first, for the quick-tag strip. */
      tags?: QuickTag[]
      /** Tag ids already on this bookmark (marked ✓ in the strip). */
      currentTagIds?: string[]
      /** Active theme's resolved tokens; strip auto-follows theme changes. */
      themeTokens?: StripThemeTokens
    }
  | { type: 'booklage:save:result'; nonce: string; ok: false; error: string }

const ProbeMessage = z.object({
  type: z.literal('booklage:probe'),
  payload: z.object({ nonce: z.string().min(1) }),
})
export type ProbeMessageInput = z.infer<typeof ProbeMessage>
export function parseProbeMessage(input: unknown): ParseResult<ProbeMessageInput> {
  const r = ProbeMessage.safeParse(input)
  if (r.success) return { ok: true, value: r.data }
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  }
}

const ProbeResultSchema = z.object({
  type: z.literal('booklage:probe:result'),
  nonce: z.string().min(1),
  pipActive: z.boolean(),
})
export type ProbeResult = z.infer<typeof ProbeResultSchema>
export function parseProbeResult(input: unknown): ParseResult<ProbeResult> {
  const r = ProbeResultSchema.safeParse(input)
  if (r.success) return { ok: true, value: r.data }
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  }
}

const AddTagMessage = z.object({
  type: z.literal('booklage:add-tag'),
  payload: z.object({
    bookmarkId: z.string().min(1),
    tagId: z.string().min(1),
    nonce: z.string().min(1),
  }),
})
export type AddTagMessageInput = z.infer<typeof AddTagMessage>
export function parseAddTagMessage(input: unknown): ParseResult<AddTagMessageInput> {
  const r = AddTagMessage.safeParse(input)
  if (r.success) return { ok: true, value: r.data }
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  }
}

export type AddTagResult =
  | { type: 'booklage:add-tag:result'; nonce: string; ok: true }
  | { type: 'booklage:add-tag:result'; nonce: string; ok: false; error: string }
