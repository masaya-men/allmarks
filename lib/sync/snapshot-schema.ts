import { z } from 'zod'
import type { BookmarkRecord, TagRecord, CardRecord } from '@/lib/storage/indexeddb'
import type { SyncBoardConfig } from './merge'
import type { PrivateVaultRecord } from '@/lib/private/vault-store'

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

const bookmarkSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  description: z.string(),
  thumbnail: z.string(),
  favicon: z.string(),
  siteName: z.string(),
  type: z.string(),
  savedAt: z.string(),
  folderId: z.string().optional(),
  ogpStatus: z.string(),
  isRead: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
  deletedAt: z.string().optional(),
  orderIndex: z.number().optional(),
  sizePreset: z.enum(['S', 'M', 'L']).optional(),
  cardWidth: z.number().optional(),
  customCardWidth: z.boolean().optional(),
  tags: z.array(z.string()),
  displayMode: z.enum(['visual', 'editorial', 'native']).nullable().optional(),
  hasVideo: z.boolean().optional(),
  photos: z.array(z.string()).optional(),
  mediaSlots: z.array(z.unknown()).optional(),
  linkStatus: z.enum(['alive', 'gone', 'unknown']).optional(),
  lastCheckedAt: z.number().optional(),
  updatedAt: z.number().optional(),
  encryptedPayload: z.object({
    ephemeralPublicKey: z.string(),
    iv: z.string(),
    ciphertext: z.string(),
  }).passthrough().optional(),
  dominantColor: z.string().nullable().optional(),
  onboardingDemo: z.boolean().optional(),
  authorAvatar: z.string().optional(),
  authorName: z.string().optional(),
}).passthrough()

const tagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  order: z.number(),
  createdAt: z.number(),
  theme: z.string().nullable().optional(),
  updatedAt: z.number().optional(),
  onboardingDemo: z.boolean().optional(),
  isPrivateVault: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
  deletedAt: z.string().optional(),
}).passthrough()

const cardSchema = z.object({
  id: z.string(),
  bookmarkId: z.string(),
  folderId: z.string(),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  scale: z.number(),
  zIndex: z.number(),
  gridIndex: z.number(),
  isManuallyPlaced: z.boolean(),
  width: z.number(),
  height: z.number(),
  locked: z.boolean().optional(),
  isUserResized: z.boolean().optional(),
  aspectRatio: z.number().optional(),
  updatedAt: z.number().optional(),
}).passthrough()

const boardConfigFileSchema = z.object({
  config: z.record(z.string(), z.unknown()),
  updatedAt: z.number().optional(),
}).passthrough()

const vaultFileSchema = z.object({
  key: z.literal('private-vault'),
  tagId: z.string(),
  salt: z.string(),
  iterations: z.number(),
  publicKey: z.string(),
  wrappedPrivateKey: z.object({ iv: z.string(), ciphertext: z.string() }).passthrough(),
  hint: z.string().optional(),
  updatedAt: z.number().optional(),
}).passthrough()

function toResult<T>(parsed: unknown): ParseResult<T> {
  const p = parsed as { success: boolean; data?: unknown; error?: { issues: Array<{ path: (string | number)[]; message: string }> } }
  if (p.success) return { ok: true, value: p.data as T }
  return {
    ok: false,
    error: p.error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') ?? 'Unknown error',
  }
}

export function parseBookmarksFile(json: unknown): ParseResult<BookmarkRecord[]> {
  const result = toResult<BookmarkRecord[]>(z.array(bookmarkSchema).safeParse(json))
  if (result.ok) {
    return { ok: true, value: result.value as BookmarkRecord[] }
  }
  return result
}

export function parseTagsFile(json: unknown): ParseResult<TagRecord[]> {
  const result = toResult<TagRecord[]>(z.array(tagSchema).safeParse(json))
  if (result.ok) {
    return { ok: true, value: result.value as TagRecord[] }
  }
  return result
}

export function parseCardsFile(json: unknown): ParseResult<CardRecord[]> {
  const result = toResult<CardRecord[]>(z.array(cardSchema).safeParse(json))
  if (result.ok) {
    return { ok: true, value: result.value as CardRecord[] }
  }
  return result
}

export function parseBoardConfigFile(json: unknown): ParseResult<SyncBoardConfig> {
  const result = toResult<SyncBoardConfig>(boardConfigFileSchema.safeParse(json))
  if (result.ok) {
    return { ok: true, value: result.value as SyncBoardConfig }
  }
  return result
}

export function parseVaultFile(json: unknown): ParseResult<PrivateVaultRecord> {
  const result = toResult<PrivateVaultRecord>(vaultFileSchema.safeParse(json))
  if (result.ok) {
    return { ok: true, value: result.value as PrivateVaultRecord }
  }
  return result
}
