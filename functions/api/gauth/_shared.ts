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
 * Google の OAuth エラー body から短い `error` コードだけを取り出す。
 * Google の失敗 body は `{ error, error_description }` の 2 フィールドだけで、
 * access token も client_secret も含まない。よって `error` コード
 * (invalid_grant / invalid_client / unauthorized_client / invalid_scope 等) を
 * クライアントへ転送しても機密は漏れない。
 * JSON でない / object でない / `error` が文字列でない / 長さが 1..64 の範囲外なら
 * undefined を返す (= 転送しない)。
 */
function extractGoogleError(text: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed !== null && typeof parsed === 'object' && 'error' in parsed) {
      const err = (parsed as { error: unknown }).error
      if (typeof err === 'string' && err.length >= 1 && err.length <= 64) return err
    }
  } catch {
    // text が JSON でない (CF の HTML 差し替え等) — 転送するコードは無い
  }
  return undefined
}

/**
 * Google の生 status を、この束の Function が返すべき Response に写す。
 * - 2xx: Google のトークン JSON をそのまま 200 で通過 (no-store)
 * - 0  : 到達不可 → 502
 * - 408 / 429 / 5xx: 一時障害 (timeout / rate limit / Google 障害) → 502 (バックオフして再試行)
 * - それ以外 (4xx): クライアント起因 (invalid_grant 等) → 400。判別できれば Google の
 *   `error` コードを `google_error` として添える (機密は含まれない)。
 * CF が 5xx を HTML に差し替えても、auth.ts は「非 2xx = 失敗」で扱うので問題ない。
 */
export function relayGoogleTokenResponse(status: number, text: string): Response {
  if (status >= 200 && status < 300) {
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
  if (status === 0 || status === 408 || status === 429 || status >= 500) {
    return jsonResponse(502, { error: 'upstream_unreachable' })
  }
  const googleError = extractGoogleError(text)
  return jsonResponse(
    400,
    googleError ? { error: 'google_rejected', google_error: googleError } : { error: 'google_rejected' },
  )
}
