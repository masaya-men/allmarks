// lib/sync/id-token.ts
// Best-effort, unverified decode of the OIDC ID token's `email` claim, for
// display only ("Connected as x@y.com" in SyncPanel). No signature check —
// the token just came from our own /api/gauth/token exchange over HTTPS, so
// trusting its shape here is fine; this is not an auth decision point.

export function decodeIdTokenEmail(idToken: string): string | null {
  const parts = idToken.split('.')
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = atob(padded)
    const payload: unknown = JSON.parse(json)
    if (typeof payload === 'object' && payload !== null && typeof (payload as { email?: unknown }).email === 'string') {
      return (payload as { email: string }).email
    }
    return null
  } catch {
    return null
  }
}
