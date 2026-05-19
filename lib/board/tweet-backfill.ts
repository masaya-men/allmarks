import type { TweetMeta, MediaSlot } from '@/lib/embed/types'

/** A single bookmark's identity for the backfill. */
export type TweetBackfillTarget = {
  readonly bookmarkId: string
  readonly tweetId: string
}

/** Side-effecting hooks the backfill calls when meta resolves. Passed in
 *  (rather than imported) so unit tests can inject mocks and so production
 *  callers can wire to React state through useBoardData. */
export type TweetBackfillHooks = {
  readonly fetchMeta: (tweetId: string) => Promise<TweetMeta | null>
  readonly persistThumbnail: (bookmarkId: string, url: string, force: boolean) => Promise<void>
  readonly persistVideoFlag: (bookmarkId: string, hasVideo: boolean) => Promise<void>
  readonly persistMediaSlots: (bookmarkId: string, slots: readonly MediaSlot[]) => Promise<void>
  /** Optional: replace the bookmark title with the full tweet body from
   *  `meta.text`. The extension stores a truncated `userName: + slice(0,80) + …`
   *  title; backfilling the full text lets the board card scroll through the
   *  whole tweet body and lets the Lightbox card share the same content so
   *  the FLIP open animation morphs identical typography on both sides. */
  readonly persistTitle?: (bookmarkId: string, title: string) => Promise<void>
}

/** Fetch tweet meta once and write through to all three persisted fields.
 *  Returns silently on any failure or cancellation. Designed to be passed
 *  to a BackfillQueue as a task. */
export async function backfillTweetMeta(
  target: TweetBackfillTarget,
  signal: AbortSignal,
  hooks: TweetBackfillHooks,
): Promise<void> {
  let meta: TweetMeta | null
  try {
    meta = await hooks.fetchMeta(target.tweetId)
  } catch {
    return
  }
  if (!meta || signal.aborted) return

  // Thumbnail — write through always; the bookmarklet captures X's generic
  // placeholder for every tweet, so the syndication response is the only
  // source of truth here (force=true).
  // Video tweets: videoPosterUrl is the better thumbnail (still frame from
  // the video itself). Photo-only: fall back to photoUrl. Text-only: ''.
  const thumbUrl = meta.videoPosterUrl ?? meta.photoUrl ?? ''
  try {
    await hooks.persistThumbnail(target.bookmarkId, thumbUrl, true)
  } catch {
    /* per-field failure: keep going so the other fields still persist. */
  }
  if (signal.aborted) return

  // hasVideo flag — only flip to true. Never set back to false (cardinal
  // rule: backfill never removes user-visible state).
  if (meta.hasVideo) {
    try {
      await hooks.persistVideoFlag(target.bookmarkId, true)
    } catch {
      /* swallow */
    }
  }
  if (signal.aborted) return

  // mediaSlots — only when the fetched meta actually has slot data. Empty
  // array means text-only tweet, in which case we don't want to overwrite
  // anything (= no-op).
  if (meta.mediaSlots && meta.mediaSlots.length > 0) {
    try {
      await hooks.persistMediaSlots(target.bookmarkId, meta.mediaSlots)
    } catch {
      /* swallow */
    }
  }
  if (signal.aborted) return

  // Title (B-#22 follow-up, session 52). Replace the extension's truncated
  // title with the full tweet body so the board card + Lightbox card share
  // identical text content (= same pickTitleTypography output, no font jump
  // during the FLIP open animation) and the board card scroll surfaces the
  // full text instead of stopping at the 80-char extension slice. Hook is
  // optional so legacy callers (= unit tests) keep working without it.
  if (hooks.persistTitle && meta.text) {
    try {
      await hooks.persistTitle(target.bookmarkId, meta.text)
    } catch {
      /* swallow */
    }
  }
}
