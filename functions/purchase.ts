// functions/purchase.ts — GET /purchase — see functions/index.ts / _lib/locale-redirect-handler.ts
// (?txn=… query strings ARE allowed to localize; the query string is
// preserved verbatim by lib/i18n/locale-redirect.ts localizedTarget().)
export { localeRedirectHandler as onRequest } from './_lib/locale-redirect-handler'
