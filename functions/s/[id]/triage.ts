// functions/s/[id]/triage.ts
// GET /s/<id>/triage — 受信者の振り分け画面。 OG URL を per-id triage に向ける以外は landing と同じ。
import { handleShareRequest, type ShareHandlerContext } from '../_handler'

export async function onRequestGet(ctx: ShareHandlerContext): Promise<Response> {
  return handleShareRequest(ctx, 'triage')
}
