// functions/_lib/locale-redirect-handler.ts
// Thin Cloudflare Pages Functions wrapper around the pure decision in
// lib/i18n/locale-redirect.ts. One tiny function file per unprefixed
// marketing route (functions/index.ts, functions/pricing.ts, …) re-exports
// `localeRedirectHandler` as `onRequest`. Cloudflare's file-based routing
// then only ever invokes a Function for those exact paths — never for the
// JS/CSS/image/font static assets that make up the rest of the site — so
// this stays off the Pages Functions free-tier invocation budget for
// ordinary asset traffic without needing a `_routes.json` include/exclude
// list. (A root `_middleware.ts` was deliberately avoided: Cloudflare docs
// state root middleware "runs on your entire application, including static
// files", which would invoke Functions for every asset request.)
import { decideLocaleRedirect } from '../../lib/i18n/locale-redirect'

interface AssetFetcher {
  fetch(input: Request): Promise<Response>
}

interface Env {
  readonly ASSETS: AssetFetcher
}

interface PagesContext {
  readonly request: Request
  readonly env: Env
}

export async function localeRedirectHandler(ctx: PagesContext): Promise<Response> {
  const url = new URL(ctx.request.url)
  const redirectTo = decideLocaleRedirect({
    method: ctx.request.method,
    pathname: url.pathname,
    search: url.search,
    cookieHeader: ctx.request.headers.get('Cookie'),
    acceptLanguage: ctx.request.headers.get('Accept-Language'),
    userAgent: ctx.request.headers.get('User-Agent'),
  })

  if (redirectTo) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectTo,
        Vary: 'Accept-Language, Cookie',
        'Cache-Control': 'private, no-store',
      },
    })
  }

  // No redirect: serve the static asset unchanged (same origin, same request).
  return ctx.env.ASSETS.fetch(ctx.request)
}
