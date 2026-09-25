// functions/index.ts
// GET / — auto-redirect a visitor to their language's marketing page when one
// exists (cookie/Accept-Language decided in lib/i18n/locale-redirect.ts).
// Scoped to exactly this path by Cloudflare's file-based routing; see
// functions/_lib/locale-redirect-handler.ts for why per-route files were
// chosen over a root `_middleware.ts` (Functions invocation budget).
export { localeRedirectHandler as onRequest } from './_lib/locale-redirect-handler'
