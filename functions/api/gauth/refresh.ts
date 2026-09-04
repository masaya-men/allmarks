// functions/api/gauth/refresh.ts
// POST /api/gauth/refresh — refresh token を新しい access token に交換する中継。
//
//   受け取り: { refreshToken }
//   やること: client_secret を足して grant_type=refresh_token で交換 → JSON をそのまま返す。
//   保存しない・ログを出さない (stateless)。設計 §4.2。
import { parseTokenRefreshRequest } from '../../../lib/sync/gauth-types'
import { readCappedText, jsonResponse, postToGoogleToken, relayGoogleTokenResponse } from './_shared'

interface Env {
  GOOGLE_OAUTH_CLIENT_ID: string
  GOOGLE_OAUTH_CLIENT_SECRET: string
}
interface PagesContext {
  request: Request
  env: Env
}

/** { refreshToken } のみ。余裕を見て 8KB (token.ts と同じ)。 */
const MAX_BODY_BYTES = 8 * 1024

export async function onRequestPost(ctx: PagesContext): Promise<Response> {
  if (!ctx.env.GOOGLE_OAUTH_CLIENT_ID || !ctx.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return jsonResponse(500, { error: 'oauth_not_configured' })
  }

  const declared = parseInt(ctx.request.headers.get('content-length') ?? '0', 10)
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: 'body_too_large' })
  }
  const raw = await readCappedText(ctx.request, MAX_BODY_BYTES)
  if (raw === null) return jsonResponse(413, { error: 'body_too_large' })

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonResponse(400, { error: 'malformed_json' })
  }
  const parsed = parseTokenRefreshRequest(body)
  if (!parsed.ok) return jsonResponse(400, { error: 'invalid_request' })

  const { status, text } = await postToGoogleToken({
    refresh_token: parsed.value.refreshToken,
    client_id: ctx.env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: ctx.env.GOOGLE_OAUTH_CLIENT_SECRET,
    grant_type: 'refresh_token',
  })
  return relayGoogleTokenResponse(status, text)
}
