interface PagesContext {
  request: Request
}

/** Hard cap on how much HTML we read from an upstream page. Meta tags live in
 *  the <head>, so 1 MB is generous; anything past that is discarded. Prevents a
 *  malicious/huge page from exhausting the Worker's memory (DoS). */
const MAX_HTML_BYTES = 1_000_000

/**
 * SSRF guard for the general OGP fetcher.
 *
 * Unlike the video proxies ([tweet-video.ts] etc.) which can use a strict host
 * *allowlist*, this endpoint must fetch arbitrary public sites the user
 * bookmarks, so we instead *blocklist* the targets that could be used to reach
 * our own / cloud-provider internal network: loopback, RFC1918 private ranges,
 * link-local (incl. the 169.254.169.254 cloud-metadata IP), CGNAT, multicast,
 * IPv6 loopback/ULA/link-local, and internal-only TLDs.
 *
 * Cloudflare's edge fetch generally cannot route to private IPs from production
 * anyway, but we block at the hostname layer too as defense-in-depth and to
 * stay consistent with the proxy endpoints. The WHATWG URL parser normalizes
 * IPv4 literals (decimal/octal/hex forms all collapse to dotted-decimal in
 * `.hostname`), so those bypass encodings are already handled before we see it.
 */
/** True if a dotted-decimal IPv4 (as 4 octets) is in a private / loopback /
 *  link-local / metadata / CGNAT / multicast / reserved range. */
function isBlockedIpv4(o: readonly number[]): boolean {
  if (o.length !== 4 || o.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true // malformed → block
  }
  const [a, b] = o
  if (a === 0) return true // 0.0.0.0/8 "this host"
  if (a === 10) return true // 10.0.0.0/8 private
  if (a === 127) return true // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local + metadata
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
  if (a >= 224) return true // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  return false
}

/** Expand an IPv6 literal (no brackets, lowercased) into 8 numeric hextets, or
 *  null if it is not a parseable IPv6 address. Handles `::` compression and a
 *  trailing dotted-IPv4 tail (e.g. `::ffff:127.0.0.1`). */
function expandIpv6(h: string): number[] | null {
  if (h.includes('%')) return null // zone id — not a plain address
  let s = h
  // Convert an embedded dotted-IPv4 tail into two hextets.
  const tailV4 = s.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (tailV4) {
    const q = [tailV4[2], tailV4[3], tailV4[4], tailV4[5]].map(Number)
    if (q.some((n) => n > 255)) return null
    const hi = ((q[0] << 8) | q[1]).toString(16)
    const lo = ((q[2] << 8) | q[3]).toString(16)
    s = `${tailV4[1]}${hi}:${lo}`
  }
  if (!s.includes(':')) return null
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : null
  let groups: string[]
  if (tail === null) {
    groups = head
    if (groups.length !== 8) return null // no `::`, must be fully specified
  } else {
    const missing = 8 - head.length - tail.length
    if (missing < 1) return null
    groups = [...head, ...Array(missing).fill('0'), ...tail]
  }
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN))
  if (nums.length !== 8 || nums.some((n) => Number.isNaN(n))) return null
  return nums
}

/**
 * True if `hostname` points at an internal / non-public target we must not
 * fetch from this endpoint (SSRF guard). See the module-level rationale above.
 *
 * IPv6 is handled by numeric range checks rather than string spelling: anything
 * that isn't provably global-unicast (2000::/3) is blocked, embedded-IPv4 forms
 * (mapped / 6to4 / NAT64 / IPv4-compatible) are unwrapped and run through the
 * IPv4 ranges, and an unparseable IPv6 literal is denied by default.
 */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[/, '') // strip IPv6 brackets: `[::1]` → `::1`
    .replace(/\]$/, '')
    .replace(/\.$/, '') // strip a single root-anchored trailing dot (`localhost.`)

  if (host === '') return true

  // Internal-only / loopback hostnames.
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === 'localhost.localdomain') return true
  if (host.endsWith('.local') || host.endsWith('.internal')) return true

  // IPv6 literal: parse numerically and classify.
  if (host.includes(':')) {
    const g = expandIpv6(host)
    if (!g) return true // unparseable IPv6 literal → default-deny
    if (g.every((x) => x === 0)) return true // :: unspecified
    if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true // ::1 loopback

    const zerosTo5 = g.slice(0, 5).every((x) => x === 0)
    let v4: number[] | null = null
    if (zerosTo5 && g[5] === 0xffff) {
      v4 = [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff] // ::ffff:x mapped
    } else if (zerosTo5 && g[5] === 0) {
      v4 = [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff] // ::x.x.x.x compatible
    } else if (g[0] === 0x2002) {
      v4 = [g[1] >> 8, g[1] & 0xff, g[2] >> 8, g[2] & 0xff] // 2002::/16 6to4
    } else if (
      g[0] === 0x0064 &&
      g[1] === 0xff9b &&
      g[2] === 0 &&
      g[3] === 0 &&
      g[4] === 0 &&
      g[5] === 0
    ) {
      v4 = [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff] // 64:ff9b::/96 NAT64
    }
    if (v4) return isBlockedIpv4(v4)

    // Otherwise require global unicast (2000::/3); everything else (ULA fc00::/7,
    // link-local fe80::/10, site-local fec0::/10, multicast ff00::/8, …) is denied.
    return g[0] < 0x2000 || g[0] > 0x3fff
  }

  // IPv4 literal. WHATWG URL normalizes decimal/octal/hex forms to dotted
  // decimal in `.hostname`, so we only need to parse the dotted form here.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    return isBlockedIpv4([Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])])
  }

  return false
}

/** Reads the response body as text but stops after `maxBytes`, cancelling the
 *  rest of the stream. Guards against unbounded reads (DoS). */
async function readCappedText(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const merged = new Uint8Array(maxBytes)
  let total = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value && value.byteLength > 0) {
      // Only copy up to the remaining budget so peak memory is bounded by
      // maxBytes regardless of how large the upstream's chunks are.
      const take = Math.min(value.byteLength, maxBytes - total)
      merged.set(value.subarray(0, take), total)
      total += take
      if (total >= maxBytes) {
        await reader.cancel()
        break
      }
    }
  }
  return new TextDecoder().decode(merged.subarray(0, total))
}

// Local copy — Pages Functions can't import from @/lib.
// Mirror of lib/utils/url-resolve.ts — keep in sync.
function resolveMaybeRelative(href: string, baseUrl: string): string {
  if (!href) return ''
  if (/^https?:\/\//i.test(href)) return href
  if (href.startsWith('//')) return `https:${href}`
  try {
    return new URL(href, baseUrl).href
  } catch {
    return ''
  }
}

function extractMeta(html: string, property: string): string {
  const ogMatch = html.match(
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`,
      'i',
    ),
  )
  if (ogMatch) return ogMatch[1]

  const ogReversed = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`,
      'i',
    ),
  )
  if (ogReversed) return ogReversed[1]

  const nameMatch = html.match(
    new RegExp(
      `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`,
      'i',
    ),
  )
  if (nameMatch) return nameMatch[1]

  const nameReversed = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["']`,
      'i',
    ),
  )
  if (nameReversed) return nameReversed[1]

  return ''
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return match?.[1]?.trim() ?? ''
}

function extractFavicon(html: string, baseUrl: string): string {
  const match = html.match(
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']*)["']/i,
  )
  const raw = match?.[1] ?? ''
  const resolved = resolveMaybeRelative(raw, baseUrl)
  if (resolved) return resolved
  try {
    return `${new URL(baseUrl).origin}/favicon.ico`
  } catch {
    return ''
  }
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url).searchParams.get('url')
  if (!url) {
    return jsonResponse({ error: 'url parameter required' }, 400)
  }

  let target: URL
  try {
    target = new URL(url)
  } catch {
    return jsonResponse({ error: 'Invalid URL format' }, 400)
  }

  // SSRF guard: only fetch public http(s) endpoints. Reject other schemes
  // (file:, data:, ftp:, …) and any internal / private / metadata target.
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return jsonResponse({ error: 'Only http(s) URLs are allowed' }, 400)
  }
  if (isBlockedHost(target.hostname)) {
    return jsonResponse({ error: 'Target host is not allowed' }, 400)
  }

  try {
    const res = await fetch(target.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AllMarksBot/1.0)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(8000),
    })

    // A redirect may land on an internal host even though the original URL was
    // public. Re-validate where we actually ended up before reading the body.
    if (res.url) {
      let landed: URL
      try {
        landed = new URL(res.url)
      } catch {
        // Truthy but unparseable landing URL → fail closed.
        return jsonResponse({ error: 'Redirected to an unverifiable host' }, 400)
      }
      if (
        (landed.protocol !== 'http:' && landed.protocol !== 'https:') ||
        isBlockedHost(landed.hostname)
      ) {
        return jsonResponse({ error: 'Redirected to a disallowed host' }, 400)
      }
    } else if (res.redirected) {
      // Followed a redirect but the landing URL is unavailable → fail closed.
      return jsonResponse({ error: 'Redirected to an unverifiable host' }, 400)
    }

    if (!res.ok) {
      return jsonResponse({ error: `Fetch failed: ${res.status}` }, 502)
    }

    const html = await readCappedText(res, MAX_HTML_BYTES)

    const rawImage = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image')
    const data = {
      title: extractMeta(html, 'og:title') || extractTitle(html),
      description:
        extractMeta(html, 'og:description') || extractMeta(html, 'description'),
      image: resolveMaybeRelative(rawImage, url),
      siteName: extractMeta(html, 'og:site_name'),
      favicon: extractFavicon(html, url),
      url,
    }

    return jsonResponse(data, 200, {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: message }, 500)
  }
}
