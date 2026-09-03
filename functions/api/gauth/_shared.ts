// functions/api/gauth/_shared.ts
// gauth の 2 route (token / refresh) 共通ヘルパー。`_` 始まりなので Pages は
// route にしない。ここに置くのは「両 route で完全に同じ振る舞いをする部品」だけ。

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const UPSTREAM_TIMEOUT_MS = 10_000

/**
 * request body を最大 maxBytes まで読む。超過したら残りをキャンセルして null。
 * Content-Length が無い / 過少なストリーム body でもメモリ上限を破らせない
 * (functions/api/share/create.ts readBodyCapped と同じ発想)。body stream が
 * 無い POST は空文字を返す (呼び出し側の JSON.parse('') が 400 になる)。
 */
export async function readCappedText(request: Request, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader()
  if (!reader) return ''
  const buf = new Uint8Array(maxBytes)
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value && value.byteLength > 0) {
      if (total + value.byteLength > maxBytes) {
        await reader.cancel()
        return null
      }
      buf.set(value, total)
      total += value.byteLength
    }
  }
  return new TextDecoder().decode(buf.subarray(0, total))
}

/** JSON レスポンス。stateless エンドポイントなので常に no-store。 */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/**
 * Google のトークンエンドポイントに form-urlencoded で POST する。
 * fetch 自体が投げたら `status: 0` を返す (= 到達不可)。呼び出し側が status で
 * 200 / 4xx / 5xx / 0 を分岐する。トークンの JSON は解釈しない (通過するだけ)。
 */
export async function postToGoogleToken(
  params: Readonly<Record<string, string>>,
): Promise<{ status: number; text: string }> {
  try {
    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    return { status: res.status, text: await res.text() }
  } catch {
    return { status: 0, text: '' }
  }
}

/**
 * Google の生 status を、この束の Function が返すべき Response に写す。
 * - 2xx: Google のトークン JSON をそのまま 200 で通過 (no-store)
 * - 0  : 到達不可 → 502
 * - 5xx: Google 障害 → 502
 * - それ以外 (4xx): クライアント起因 (invalid_grant 等) → 400
 * CF が 5xx を HTML に差し替えても、auth.ts は「非 2xx = 失敗」で扱うので問題ない。
 */
export function relayGoogleTokenResponse(status: number, text: string): Response {
  if (status >= 200 && status < 300) {
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
  if (status === 0 || status >= 500) return jsonResponse(502, { error: 'upstream_unreachable' })
  return jsonResponse(400, { error: 'google_rejected' })
}
