import { z } from 'zod'

/** Result wrapper — modelled on lib/utils/save-message.ts's ParseResult; the readonly markers are an intentional tightening. */
export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

function issues(e: z.ZodError): string {
  return e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
}

/** Body accepted by functions/api/gauth/token.ts. `redirectUri` must be the
 *  calling page's origin — GIS popup ux_mode uses the page origin as the
 *  token-exchange redirect_uri (see plan "設計上の判断" §3). Plain z.object
 *  strips unknown keys (matches lib/share/validate-v2.ts style). */
export const tokenExchangeRequestSchema = z.object({
  code: z.string().min(1).max(4096),
  // z.url() in zod 4.3.6 also accepts javascript:/data:/file:/ftp: — restrict to
  // http(s) (http:// kept for the localhost dev origin). Mirrors
  // lib/share/validate-v2.ts:7's URL-scheme guard.
  redirectUri: z.string().url().refine(
    (u) => u.startsWith('http://') || u.startsWith('https://'),
    'redirectUri must be http(s)',
  ).max(2048),
})
export type TokenExchangeRequest = z.infer<typeof tokenExchangeRequestSchema>

/** Body accepted by functions/api/gauth/refresh.ts. */
export const tokenRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1).max(4096),
})
export type TokenRefreshRequest = z.infer<typeof tokenRefreshRequestSchema>

/** Google's token endpoint success body. `refresh_token` only appears on the
 *  first authorization_code exchange, never on refresh (see plan §4).
 *  `id_token` (OpenID Connect JWT) appears on the code exchange when the
 *  `openid` scope was granted; bundle 6 decodes it to show the connected
 *  account. `scope` is optional — Google returns it inconsistently and the
 *  client only uses it for a soft scope check, so a missing decorative field
 *  shouldn't fail-closed the whole sync. */
export const googleTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  token_type: z.string().min(1),
  scope: z.string().optional(),
  id_token: z.string().optional(),
  refresh_token: z.string().min(1).optional(),
})
export type GoogleTokenResponse = z.infer<typeof googleTokenResponseSchema>

export function parseTokenExchangeRequest(input: unknown): ParseResult<TokenExchangeRequest> {
  const r = tokenExchangeRequestSchema.safeParse(input)
  return r.success ? { ok: true, value: r.data } : { ok: false, error: issues(r.error) }
}

export function parseTokenRefreshRequest(input: unknown): ParseResult<TokenRefreshRequest> {
  const r = tokenRefreshRequestSchema.safeParse(input)
  return r.success ? { ok: true, value: r.data } : { ok: false, error: issues(r.error) }
}

export function parseGoogleTokenResponse(input: unknown): ParseResult<GoogleTokenResponse> {
  const r = googleTokenResponseSchema.safeParse(input)
  return r.success ? { ok: true, value: r.data } : { ok: false, error: issues(r.error) }
}
