import type { BookmarkRecord } from '@/lib/storage/indexeddb'
import { decryptJson } from './crypto'
import type { PrivateVaultSession } from './vault-session'

type PrivateFields = {
  readonly title: string
  readonly url: string
  readonly description: string
  readonly thumbnail: string
  readonly favicon: string
  readonly siteName: string
}

/** Board-load-time gate: drops Private-tagged bookmarks entirely while
 *  locked (they never reach BoardItem/toItem — indistinguishable from not
 *  existing), and overlays decrypted fields onto them while unlocked. Runs
 *  on the raw BookmarkRecord[] BEFORE the toItem mapping so no other code
 *  needs to know about encryptedPayload. Fails closed: a row that can't be
 *  decrypted (wrong key mid-transition, corruption) is dropped, never shown
 *  with garbage content. */
export async function resolvePrivateVisibility(
  bookmarks: readonly BookmarkRecord[],
  privateTagId: string | null,
  session: PrivateVaultSession,
): Promise<BookmarkRecord[]> {
  if (privateTagId === null) return [...bookmarks]
  const result: BookmarkRecord[] = []
  for (const b of bookmarks) {
    if (!b.tags.includes(privateTagId)) {
      result.push(b)
      continue
    }
    if (session === null) continue
    if (!b.encryptedPayload) {
      result.push(b)
      continue
    }
    try {
      const fields = await decryptJson<PrivateFields>(session.key, b.encryptedPayload.iv, b.encryptedPayload.ciphertext)
      result.push({ ...b, ...fields })
    } catch {
      continue
    }
  }
  return result
}
