// functions/api/gauth/token.ts
// POST /api/gauth/token — 認可コードを Google のトークンに交換する中継。
//
//   受け取り: { code, redirectUri }  (redirectUri = 呼び出しページの origin)
//   やること: client_secret を足して oauth2.googleapis.com/token に POST し、
//             返ってきた JSON をそのまま返す。
//   保存しない・ログを出さない (stateless)。設計 §4.2。
//
// PKCE は使わない ("ウェブアプリケーション" 型 = client_secret 認証)。詳細は
// docs/superpowers/plans/2026-09-03-device-sync-bundle-2-auth.md「設計上の判断」。
import { parseTokenExchangeRequest } from '../../../lib/sync/gauth-types'
import { readCappedText, jsonResponse, postToGoogleToken, relayGoogleTokenResponse } from './_shared'

interface Env {
  GOOGLE_OAUTH_CLIENT_ID: string
  GOOGLE_OAUTH_CLIENT_SECRET: string
}
interface PagesContext {
  request: Request
  env: Env
}

/** code (~2KB 未満) + redirectUri。余裕を見て 8KB。 */
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
  const parsed = parseTokenExchangeRequest(body)
  if (!parsed.ok) return jsonResponse(400, { error: 'invalid_request' })

  const { status, text } = await postToGoogleToken({
    code: parsed.value.code,
    client_id: ctx.env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: ctx.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirect_uri: parsed.value.redirectUri,
    grant_type: 'authorization_code',
  })
  return relayGoogleTokenResponse(status, text)
}
