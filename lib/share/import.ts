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
