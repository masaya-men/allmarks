import { z } from 'zod'

/** Result wrapper — mirrors lib/utils/save-message.ts ParseResult style. */
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
  redirectUri: z.string().url().max(2048),
})
export type TokenExchangeRequest = z.infer<typeof tokenExchangeRequestSchema>

/** Body accepted by functions/api/gauth/refresh.ts. */
export const tokenRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1).max(4096),
})
export type TokenRefreshRequest = z.infer<typeof tokenRefreshRequestSchema>

/** Google's token endpoint success body. `refresh_token` only appears on the
 *  first authorization_code exchange, never on refresh (see plan §4). */
export const googleTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  token_type: z.string().min(1),
  scope: z.string(),
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
