import type { IDBPDatabase } from 'idb'
import { getBookmark } from '@/lib/storage/indexeddb'
import { encryptWithPublicKey, decryptWithPrivateKey, importPublicKey } from './crypto'
import { loadVaultRecord } from './vault-store'
import type { PrivateVaultSession } from './vault-session'
import type { MediaSlot } from '@/lib/embed/types'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type PrivateFields = {
  readonly title: string
  readonly url: string
  readonly description: string
  readonly thumbnail: string
  readonly favicon: string
  readonly siteName: string
  readonly photos?: readonly string[]
  readonly mediaSlots?: readonly MediaSlot[]
}

const BLANK_FIELDS: PrivateFields = {
  title: '', url: '', description: '', thumbnail: '', favicon: '', siteName: '',
  photos: undefined, mediaSlots: undefined,
}

/** Encrypts the bookmark's sensitive fields under the vault's PUBLIC key
 *  (loaded from the vault record) and adds the Private tag — all in ONE
 *  transaction. No session/password is required: encryption only ever
 *  needs the public half of the vault's key pair, which is not secret and
 *  is always readable from IndexedDB once a vault exists — this is what
 *  lets quick-save surfaces with no unlocked session still tag Private.
 *  No-ops if no vault has been set up yet. */
export async function addPrivateTag(
  db: DbLike,
  bookmarkId: string,
  privateTagId: string,
): Promise<void> {
  const record = await loadVaultRecord(db)
  if (!record) return
  const bookmark = await getBookmark(db, bookmarkId)
  if (!bookmark) return
  // Idempotence guard: a second call on an already-Private bookmark would
  // otherwise re-encrypt the just-blanked plaintext fields, permanently
  // destroying the original content. Mirrors addPrivateTagBatch's own guard.
  if (bookmark.tags.includes(privateTagId)) return
  const fields: PrivateFields = {
    title: bookmark.title,
    url: bookmark.url,
    description: bookmark.description,
    thumbnail: bookmark.thumbnail,
    favicon: bookmark.favicon,
    siteName: bookmark.siteName,
    photos: bookmark.photos,
    mediaSlots: bookmark.mediaSlots,
  }
  const publicKey = await importPublicKey(record.publicKey)
  const encryptedPayload = await encryptWithPublicKey(publicKey, fields)
  const tx = db.transaction('bookmarks', 'readwrite')
  const store = tx.objectStore('bookmarks')
  const current = await store.get(bookmarkId)
  if (!current) { await tx.done; return }
  // Re-check inside the transaction: the pre-transaction guard above only
  // rules out an already-Private bookmark as of BEFORE the (multi-await)
  // encryption work started. Two overlapping calls (e.g. a double-click)
  // can both pass that early check and both reach here — without this
  // in-transaction re-check, the second one would re-encrypt the
  // already-blanked fields the first one just wrote, destroying them.
  if (current.tags.includes(privateTagId)) { await tx.done; return }
  const tags = [...current.tags, privateTagId]
  await store.put({ ...current, ...BLANK_FIELDS, encryptedPayload, tags })
  await tx.done
}

/** Decrypts the bookmark's sensitive fields back to plaintext columns,
 *  clears encryptedPayload, then removes the Private tag — all in ONE
 *  transaction. Unlike addPrivateTag, this DOES require an unlocked
 *  `session` — reading the content back out means decrypting, which needs
 *  the private key. */
export async function removePrivateTag(
  db: DbLike,
  bookmarkId: string,
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<void> {
  if (session === null) throw new Error('vault is locked')
  const bookmark = await getBookmark(db, bookmarkId)
  if (!bookmark) return
  const fields = bookmark.encryptedPayload
    ? await decryptWithPrivateKey<PrivateFields>(session.privateKey, bookmark.encryptedPayload)
    : null
  const tx = db.transaction('bookmarks', 'readwrite')
  const store = tx.objectStore('bookmarks')
  const current = await store.get(bookmarkId)
  if (!current) { await tx.done; return }
  const { encryptedPayload: _drop, ...rest } = current
  const tags = current.tags.filter((t: string) => t !== privateTagId)
  await store.put(fields ? { ...rest, ...fields, tags } : { ...rest, tags })
  await tx.done
}

export type PrivateStatus = 'none' | 'locked' | 'unlocked'

/** Derives the 3-state Private status. Pure — no IDB access. `privateTagId`
 *  null means the vault has never been set up; a non-null id with a null
 *  session means it exists but is locked. */
export function resolvePrivateStatus(
  privateTagId: string | null,
  session: PrivateVaultSession,
): PrivateStatus {
  if (privateTagId === null) return 'none'
  if (session === null) return 'locked'
  return 'unlocked'
}

/** Sentinel drop-target key for the MANAGE TAGS panel's pinned Private row. */
export const PRIVATE_DROP_KEY = '__private__'

export type PendingPrivateAction =
  | { readonly kind: 'toggle-tag'; readonly bookmarkId: string; readonly currentlyTagged: boolean }
  | { readonly kind: 'filter' }
  | { readonly kind: 'batch-encrypt'; readonly bookmarkIds: readonly string[] }

/** True when `action` requires decrypting existing content (removing the
 *  Private tag, or viewing/filtering by it) — i.e. requires an unlocked
 *  session. Adding the Private tag (`toggle-tag` with `currentlyTagged:
 *  false`, or `batch-encrypt`) only ever encrypts, which needs just the
 *  vault's public key — never gated on unlock. */
export function privateActionNeedsUnlock(action: PendingPrivateAction): boolean {
  if (action.kind === 'filter') return true
  if (action.kind === 'toggle-tag') return action.currentlyTagged
  return false
}

/** Encrypts each bookmark not already Private, one at a time (each call is
 *  its own atomic transaction via addPrivateTag). No session required —
 *  see addPrivateTag. Additive only, mirroring the plain-tag
 *  drag-and-drop's "union, skip already-tagged" semantics. A bookmark id
 *  that doesn't exist is silently skipped (neither list). A failure on one
 *  card doesn't stop the rest; failed ids come back so the caller can
 *  report them. */
export async function addPrivateTagBatch(
  db: DbLike,
  bookmarkIds: readonly string[],
  privateTagId: string,
): Promise<{ readonly succeeded: readonly string[]; readonly failed: readonly string[] }> {
  const succeeded: string[] = []
  const failed: string[] = []
  for (const id of bookmarkIds) {
    try {
      const bookmark = await getBookmark(db, id)
      if (!bookmark) continue
      if (bookmark.tags.includes(privateTagId)) { succeeded.push(id); continue }
      await addPrivateTag(db, id, privateTagId)
      succeeded.push(id)
    } catch {
      failed.push(id)
    }
  }
  return { succeeded, failed }
}

/** Executes an already-routed `toggle-tag` or `batch-encrypt` action.
 *  `session` is only actually used by the `toggle-tag` + `currentlyTagged:
 *  true` (remove) branch — the add-only branches ignore it, so callers may
 *  pass `null` for those (see privateActionNeedsUnlock). The `filter` kind
 *  is intentionally NOT accepted here — it has no IDB side effect; callers
 *  apply it directly via their own filter-change handler. */
export async function executePrivateAction(
  db: DbLike,
  action: Extract<PendingPrivateAction, { kind: 'toggle-tag' | 'batch-encrypt' }>,
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<{ readonly failed: readonly string[] }> {
  if (action.kind === 'toggle-tag') {
    try {
      if (action.currentlyTagged) {
        await removePrivateTag(db, action.bookmarkId, privateTagId, session)
      } else {
        await addPrivateTag(db, action.bookmarkId, privateTagId)
      }
      return { failed: [] }
    } catch {
      return { failed: [action.bookmarkId] }
    }
  }
  const { failed } = await addPrivateTagBatch(db, action.bookmarkIds, privateTagId)
  return { failed }
}
