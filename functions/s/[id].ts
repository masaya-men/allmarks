// functions/s/[id].ts
// GET /s/<id> — Cloudflare Pages Function。 KV から共有データを取り出して HTML を組み立てる。
// ロジック本体は _handler.ts に切り出し済 (= triage と共有)。
import { handleShareRequest, type ShareHandlerContext } from './_handler'

export async function onRequestGet(ctx: ShareHandlerContext): Promise<Response> {
  return handleShareRequest(ctx, 'landing')
}
