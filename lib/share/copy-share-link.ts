import type { ApiResult } from './api-client'
import type { CreateShareResponse, ShareDataV2 } from './types-v2'

export type CopyShareLinkResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly message: string }

export type CopyShareLinkDeps = {
  /** Build the v2 payload from the current selection (board order, filter:null). */
  readonly buildShare: () => ShareDataV2
  /** POST /api/share/create — called with { share } ONLY (no thumb; no image is
   *  ever reconstructed for COPY LINK). */
  readonly createShare: (entry: { share: ShareDataV2 }) => Promise<ApiResult<CreateShareResponse>>
  /** navigator.clipboard.writeText wrapper (injected for testability). */
  readonly writeClipboard: (text: string) => Promise<void>
  /** window.location.origin. */
  readonly origin: string
}

/** Create a /s share link for the current selection and copy its URL to the
 *  clipboard. Generates NO image (decision B: no replica). */
export async function copyShareLink(deps: CopyShareLinkDeps): Promise<CopyShareLinkResult> {
  let share: ShareDataV2
  try {
    share = deps.buildShare()
  } catch (e) {
    // Harden the caller's button: a throw while building the payload surfaces
    // as an ok:false result (COULDN'T COPY) rather than an unhandled rejection
    // that freezes the button on its pre-click label.
    return { ok: false, message: e instanceof Error ? e.message : 'build error' }
  }
  const result = await deps.createShare({ share })
  if (!result.ok) {
    return { ok: false, message: result.message }
  }
  const url = `${deps.origin}/s/${result.data.id}`
  try {
    await deps.writeClipboard(url)
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'clipboard error' }
  }
  return { ok: true, url }
}
