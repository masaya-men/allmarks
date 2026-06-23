import { describe, it, expect, vi, afterEach } from 'vitest'
import { onRequest, isBlockedHost } from './ogp'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function makeCtx(rawUrl: string) {
  return {
    request: new Request(
      `https://test.local/api/ogp?url=${encodeURIComponent(rawUrl)}`,
    ),
  }
}

/** Response stand-in. `new Response().url` is read-only and always '', so we
 *  wrap a real Response to inject a landing `url` (for redirect tests) while
 *  keeping a real `body` stream that readCappedText can read. */
function htmlResponse(
  html: string,
  init?: { url?: string; status?: number; redirected?: boolean },
): Response {
  const base = new Response(html, { status: init?.status ?? 200 })
  return {
    ok: base.ok,
    status: base.status,
    url: init?.url ?? '',
    redirected: init?.redirected ?? false,
    body: base.body,
    headers: base.headers,
    text: () => base.text(),
  } as unknown as Response
}

const PAGE = `<html><head>
  <meta property="og:title" content="Hello">
  <meta property="og:description" content="World">
  <meta property="og:image" content="https://cdn.example.com/a.png">
  <meta property="og:site_name" content="Example">
</head><body>x</body></html>`

describe('isBlockedHost', () => {
  const blocked = [
    'localhost',
    'foo.localhost',
    'service.local',
    'svc.internal',
    '127.0.0.1',
    '127.255.255.255',
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '0.0.0.0',
    '100.64.0.1', // CGNAT
    '224.0.0.1', // multicast
    '255.255.255.255',
    '256.1.2.3', // malformed octet
    // IPv4 alternative encodings — prod workerd leaves these un-normalized, so
    // isBlockedHost must coerce them itself (see coerceIpv4).
    '2130706433', // decimal 127.0.0.1
    '0x7f000001', // hex 127.0.0.1
    '017700000001', // octal 127.0.0.1
    '127.1', // short-form 127.0.0.1
    '0177.0.0.1', // octal-octet 127.0.0.1
    '0xa9fea9fe', // hex 169.254.169.254 (metadata!)
    '0', // 0.0.0.0
    '3232235521', // decimal 192.168.0.1
    '167772161', // decimal 10.0.0.1
    '1.2.3.4.5', // 5 numeric labels → malformed
    '0xa9fea9fe..', // double-trailing-dot bypass of hex metadata (R3-HIGH)
    '2130706433..', // double-trailing-dot bypass of decimal loopback
    '127.0.0.1..', // double-trailing-dot dotted loopback
    '127..0.0.1', // empty middle label in a numeric host → malformed
    'localhost.', // trailing-dot FQDN (C1)
    'foo.internal.', // trailing-dot internal TLD (C1)
    'localhost.localdomain', // loopback alias (L1)
    '::1',
    '::',
    '[::1]',
    '0:0:0:0:0:0:0:1', // ::1 fully expanded
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'fec0::1', // deprecated site-local (H1)
    'ff02::1', // multicast (H1)
    '::ffff:7f00:1', // IPv4-mapped 127.0.0.1 (hex form the URL parser emits)
    '::ffff:c0a8:1', // IPv4-mapped 192.168.0.1
    '::ffff:127.0.0.1', // IPv4-mapped, dotted spelling
    '::7f00:1', // IPv4-compatible loopback (C2)
    '::a9fe:a9fe', // IPv4-compatible 169.254.169.254 (C2)
    '::ffff:0:7f00:1', // IPv4-translated, non-global (C2)
    '2002:7f00:1::', // 6to4 wrapping 127.0.0.1 (C2)
    '64:ff9b::7f00:1', // NAT64 well-known prefix → 127.0.0.1 (C2)
    '64:ff9b:dead:beef::808:808', // 0064::/16 non-well-known NAT64 → default-deny (LOW-1)
    'gggg::1', // unparseable IPv6 literal → default-deny
  ]
  it.each(blocked)('blocks %s', (h) => {
    expect(isBlockedHost(h)).toBe(true)
  })

  const allowed = [
    'example.com',
    'sub.example.com',
    'github.com',
    'localhost.example.com', // not the localhost host itself
    'example.com..', // double-trailing-dot on a real domain stays allowed
    '8.8.8.8',
    '1.1.1.1',
    '11.0.0.1',
    '134744072', // decimal 8.8.8.8 (public) — coerced but not internal
    '172.15.0.1', // just below private block
    '172.32.0.1', // just above private block
    '192.167.0.1',
    '2606:4700:4700::1111', // public IPv6 (Cloudflare DNS)
    '2001:4860:4860::8888', // public IPv6 (Google DNS)
    'fcm.googleapis.com', // starts with "fc" but is a domain, not ULA
    'feedly.com', // starts with "fe" but is a domain, not link-local
  ]
  it.each(allowed)('allows %s', (h) => {
    expect(isBlockedHost(h)).toBe(false)
  })
})

describe('onRequest /api/ogp SSRF + size guards', () => {
  it('rejects a non-http(s) scheme without fetching', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = await onRequest(makeCtx('file:///etc/passwd') as never)
    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects an internal/private host without fetching', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = await onRequest(makeCtx('http://169.254.169.254/latest/meta-data/') as never)
    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects localhost without fetching', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = await onRequest(makeCtx('http://localhost:8788/admin') as never)
    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects a decimal-encoded loopback IP without fetching', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    // 2130706433 === 127.0.0.1 (coerced by isBlockedHost regardless of whether
    // the runtime's URL parser normalized it).
    const res = await onRequest(makeCtx('http://2130706433/') as never)
    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches a normal public URL and returns OGP', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse(PAGE)))
    const res = await onRequest(makeCtx('https://example.com/article') as never)
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, string>
    expect(data.title).toBe('Hello')
    expect(data.description).toBe('World')
    expect(data.image).toBe('https://cdn.example.com/a.png')
    expect(data.siteName).toBe('Example')
  })

  it('rejects when a redirect lands on an internal host', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlResponse(PAGE, { url: 'http://169.254.169.254/' })),
    )
    const res = await onRequest(makeCtx('https://evil.example.com/redir') as never)
    expect(res.status).toBe(400)
  })

  it('fails closed when a redirect was followed but the landing URL is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlResponse(PAGE, { url: '', redirected: true })),
    )
    const res = await onRequest(makeCtx('https://example.com/redir') as never)
    expect(res.status).toBe(400)
  })

  it('fails closed when the landing URL is present but unparseable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlResponse(PAGE, { url: 'http://[invalid', redirected: true })),
    )
    const res = await onRequest(makeCtx('https://example.com/redir') as never)
    expect(res.status).toBe(400)
  })

  it('caps the HTML it reads at MAX_HTML_BYTES', async () => {
    // 3 MB page; meta tag sits in the first 1 KB so it is still parsed, but the
    // read must not balloon. We assert the response is well-formed (no crash).
    const huge = PAGE + 'x'.repeat(3_000_000)
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse(huge)))
    const res = await onRequest(makeCtx('https://example.com/huge') as never)
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, string>
    expect(data.title).toBe('Hello')
  })

  it('returns 502 when the upstream is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse('nope', { status: 404 })))
    const res = await onRequest(makeCtx('https://example.com/missing') as never)
    expect(res.status).toBe(502)
  })
})
