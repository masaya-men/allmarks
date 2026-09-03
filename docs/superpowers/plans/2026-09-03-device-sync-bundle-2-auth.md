# 端末間同期 束2（極小 Function + 認証）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユーザー自身の Google にログインさせ、放置運転の裏同期に必要な refresh token を取得できる「ログイン受け渡し」層を作る（同期本体・UI はまだ作らない）。

**Architecture:** 3 部品。(1) `functions/api/gauth/token.ts` / `refresh.ts` = Cloudflare Pages Functions。認可コードや refresh token を受け取り、`client_secret` を足して Google のトークンエンドポイントに中継し、返ってきた JSON をそのまま返すだけ。**何も保存しない・ログも出さない（stateless）**。(2) `lib/sync/google-identity.ts` = Google Identity Services（GIS）のスクリプトを遅延ロードするだけの薄いラッパ（`lib/embed/soundcloud-widget.ts` と同じ形）。(3) `lib/sync/auth.ts` = GIS の「コードモデル」で同意ポップアップを出して認可コードを取り、上記 Function を叩いてトークンに変える純オーケストレーション。**この束では `auth.ts` の呼び出し元はゼロ**（束1の `device-id.ts` と同じ。既存挙動は 1px も変わらない）。

**Tech Stack:** TypeScript strict / Cloudflare Pages Functions（workerd）/ zod v4（入力・応答検証）/ Google Identity Services（`accounts.google.com/gsi/client`）/ Google OAuth 2.0 Web Server flow（`oauth2.googleapis.com/token`）/ vitest（`vi.stubGlobal('fetch')` + `vi.mock` でユニットテスト）。

**Spec:** `docs/private/2026-09-02-device-sync-design.md`（§4.1 / §4.2 / §4.3 / §7.1 が下敷き。非公開・gitignored）。この plan は spec と一緒に読むこと。

## Global Constraints

- **同期未接続の挙動は 1px も変えない。** この束の追加物（Function 2 本、`lib/sync/*` 3 ファイル、env 1 個）はどれも既存コードから呼ばれない。`git grep` で `auth.ts` / `google-identity.ts` の import が 0 件であることを最後に確認する。
- **極小 Function は何も保存しない・ログを出さない。** `ctx.env` に KV/R2 バインディングを持たせない。`console.*` を 1 行も書かない（実装後 `grep -n "console\." functions/api/gauth/` が空であることを確認）。
- **¥0 インフラ。** Cloudflare Functions 無料枠のみ。新規の有料リソースなし。
- **TypeScript strict。** `any` 禁止 → `unknown` + 型ガード。全関数の戻り値型を明示。
- **外部入力は zod で検証。** Function が受け取る body、Function が Google から受け取る応答、両方。
- **`rtk` 前置・`--no-verify` 禁止。** vitest / playwright は素の `npx`（`rtk npx` は既知の不具合）。tsc は `rtk npx tsc --noEmit` で可。
- **deploy 前ゲート:** `rtk npx tsc --noEmit && npx vitest run && rtk pnpm build`。
- **コミット規約:** `feat(sync):` / `test(sync):` / `chore(sync):`。各コミット末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。
- **ブランチ:** `feat/device-sync-bundle-2`（作成済み。§15 minors のコミット `03962277` が既に載っている）。

---

## 設計上の判断（spec からの明示的なズレ・実装者は必読）

### 1. `_routes.json` は追加しない（spec §4.2「`_routes.json` に含める」を上書き）

現状リポジトリに `_routes.json` は**存在しない**（`find . -name _routes.json` が空・`docs/private/2026-07-14-cloudflare-cost-audit.md` §2 も「`_routes.json` 無し＝全 route が常時稼働」と実測記載）。`_routes.json` が無いとき Cloudflare Pages は `functions/` ディレクトリ構造から routing を自動生成するので、`functions/api/gauth/token.ts` は自動的に `POST /api/gauth/token` として配信される。**追加作業ゼロ。**

`_routes.json` を今ここで新設すると、既存の全 Function route（13 本）を漏れなく列挙しないと未記載の route が除外されて壊れる。これは cost-audit の N-62 バッチ1（`/api/oembed` 撤去等）の領分であって束2 のスコープ外。**この束では触らない。**

### 2. PKCE（`code_verifier` / `code_challenge`）は使わない（spec §7.1 の「PKCE verifier」記述を上書き）

GIS の `google.accounts.oauth2.initCodeClient` に `code_challenge` を渡すオプションは無い（[Google 公式 use-code-model](https://developers.google.com/identity/oauth2/web/guides/use-code-model) 確認済み・2026-09-03）。PKCE は「シークレットを持てない公開クライアント」向けの仕組み。今回は **`client_secret` を持つ「ウェブアプリケーション」型クライアント**なので、コード横取り対策は client_secret + redirect_uri 一致検証で成立する。リクエスト body は `{ code, redirectUri }` のみ。

### 3. トークン交換の `redirect_uri` = 呼び出しページの origin（`postmessage` ではない）

GIS ポップアップ方式（`ux_mode: 'popup'`）では、サーバー側トークン交換の `redirect_uri` に**呼び出しページの origin**（例 `https://allmarks.app`）を渡す（公式ドキュメント該当箇所を引用確認済み）。古い `gapi.auth2` の `postmessage` とは違う。よって Google Cloud Console の「承認済みリダイレクト URI」に `https://allmarks.app` と `http://localhost:3000`（末尾スラッシュ無しの origin）を登録する（Task 6）。

### 4. refresh token の入手条件

GIS コードモデルは「バックエンドがユーザー不在時に Google API を叩く」ための仕組みで、認可コードは `access_type=offline` 相当として発行される。`grant_type=authorization_code` の交換で **初回authorization時のみ** `refresh_token` が返る（[Google web-server doc](https://developers.google.com/identity/protocols/oauth2/web-server) 確認済み）。2 回目以降の同意では `refresh_token` が返らないことがある → `token.ts` は `refresh_token` を optional として扱い、`auth.ts` の `SyncTokens.refreshToken` も optional。束4 の engine が「refresh token が取れなかったら再同意を促す」処理を持つ（束2 の責務外）。

### 5. `auth.ts` は IndexedDB を触らない

spec §4.1 の「refresh token 管理」は、束2 では「渡された refresh token で access token を更新する純ロジック」まで。永続化（`sync-store.ts`）は束4。`auth.ts` の関数は refresh token を**引数で受け取り**、トークンを**戻り値で返す**だけ。これで束2 は fake-indexeddb 無しでユニットテストできる。

### 6. ローカルでの Function 実行

`next dev`（:3000）は Pages Functions を動かさない。Function の手動疎通は `npx wrangler pages dev out --port 3000`（`pnpm build` 済みの `out/` に対して・`--port 3000` で GIS の承認済み origin と一致させる）。`.dev.vars`（git 管理外）から `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` が注入される。**ユニットテストは wrangler 不要**（`vi.stubGlobal('fetch')` で Google をモック）。

---

## File Structure

| ファイル | 責務 | 新規/変更 |
|---|---|---|
| `lib/sync/gauth-types.ts` | Function の入力 zod スキーマ・Google トークン応答 zod スキーマ・共有型。Function と `auth.ts` の両方が import する唯一のインターフェース点 | 新規 |
| `functions/api/gauth/_shared.ts` | `readCappedText`（body 上限読み）/ `jsonResponse` / `postToGoogleToken`（Google への form POST）/ `relayGoogleTokenResponse`（status → Response 変換）。token と refresh の共通機構。`_` 始まりなので route にならない | 新規 |
| `functions/api/gauth/token.ts` | `POST /api/gauth/token` — `{code, redirectUri}` → Google に `client_secret` を足して `grant_type=authorization_code` 交換 → Google の JSON をそのまま返す | 新規 |
| `functions/api/gauth/refresh.ts` | `POST /api/gauth/refresh` — `{refreshToken}` → `grant_type=refresh_token` 交換 → Google の JSON をそのまま返す | 新規 |
| `lib/sync/google-identity.ts` | GIS スクリプト（`accounts.google.com/gsi/client`）の 1 回ロード。`window.google` を resolve | 新規 |
| `lib/sync/auth.ts` | `requestAuthCode()`（GIS ポップアップ→code）/ `exchangeCode()` / `refreshAccessToken()` / 純ヘルパー `computeExpiresAt` `isAccessTokenExpired` | 新規 |
| `lib/constants.ts` | `GOOGLE_OAUTH_CLIENT_ID` を env から export | 変更（1 行追加） |
| `.env.production` | `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=`（空・Task 6 でユーザーが値を入れる） | 変更（1 行追加） |
| `.dev.vars.example` | ローカル wrangler 用の env テンプレート（tracked・実値は書かない） | 新規 |

**テストファイル:** 各 `.ts` の隣に `.test.ts`（リポジトリ既存規約。`functions/api/share/create.test.ts` / `lib/private/apply-tag-change.test.ts` と同じ）。

---

## Task 1: gauth 共有スキーマ・型

**Files:**
- Create: `lib/sync/gauth-types.ts`
- Test: `lib/sync/gauth-types.test.ts`

**Interfaces:**
- Consumes: なし（zod のみ）
- Produces:
  - `tokenExchangeRequestSchema: z.ZodType` / `type TokenExchangeRequest = { code: string; redirectUri: string }`
  - `tokenRefreshRequestSchema: z.ZodType` / `type TokenRefreshRequest = { refreshToken: string }`
  - `googleTokenResponseSchema: z.ZodType` / `type GoogleTokenResponse = { access_token: string; expires_in: number; token_type: string; scope: string; refresh_token?: string }`
  - `parseTokenExchangeRequest(input: unknown): { ok: true; value: TokenExchangeRequest } | { ok: false; error: string }`
  - `parseTokenRefreshRequest(input: unknown): { ok: true; value: TokenRefreshRequest } | { ok: false; error: string }`
  - `parseGoogleTokenResponse(input: unknown): { ok: true; value: GoogleTokenResponse } | { ok: false; error: string }`

- [ ] **Step 1: 失敗するテストを書く**

`lib/sync/gauth-types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  parseTokenExchangeRequest,
  parseTokenRefreshRequest,
  parseGoogleTokenResponse,
} from './gauth-types'

describe('parseTokenExchangeRequest', () => {
  it('accepts a well-formed body', () => {
    const r = parseTokenExchangeRequest({ code: '4/abc', redirectUri: 'https://allmarks.app' })
    expect(r).toEqual({ ok: true, value: { code: '4/abc', redirectUri: 'https://allmarks.app' } })
  })
  it('rejects a missing code', () => {
    expect(parseTokenExchangeRequest({ redirectUri: 'https://allmarks.app' }).ok).toBe(false)
  })
  it('rejects an empty code', () => {
    expect(parseTokenExchangeRequest({ code: '', redirectUri: 'https://allmarks.app' }).ok).toBe(false)
  })
  it('rejects a non-URL redirectUri', () => {
    expect(parseTokenExchangeRequest({ code: '4/abc', redirectUri: 'not-a-url' }).ok).toBe(false)
  })
  it('rejects a non-object', () => {
    expect(parseTokenExchangeRequest('nope').ok).toBe(false)
    expect(parseTokenExchangeRequest(null).ok).toBe(false)
  })
  it('strips unknown fields (z.object default)', () => {
    const r = parseTokenExchangeRequest({ code: '4/abc', redirectUri: 'https://allmarks.app', evil: 1 })
    expect(r.ok).toBe(true)
    if (r.ok) expect('evil' in r.value).toBe(false)
  })
})

describe('parseTokenRefreshRequest', () => {
  it('accepts a well-formed body', () => {
    expect(parseTokenRefreshRequest({ refreshToken: '1//abc' })).toEqual({
      ok: true, value: { refreshToken: '1//abc' },
    })
  })
  it('rejects an empty refreshToken', () => {
    expect(parseTokenRefreshRequest({ refreshToken: '' }).ok).toBe(false)
  })
})

describe('parseGoogleTokenResponse', () => {
  it('accepts a full authorization_code response (with refresh_token)', () => {
    const g = {
      access_token: 'ya29.a', expires_in: 3599, token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/drive.file openid', refresh_token: '1//r',
    }
    const r = parseGoogleTokenResponse(g)
    expect(r).toEqual({ ok: true, value: g })
  })
  it('accepts a refresh response with no refresh_token', () => {
    const g = { access_token: 'ya29.b', expires_in: 3599, token_type: 'Bearer', scope: 'openid' }
    expect(parseGoogleTokenResponse(g).ok).toBe(true)
  })
  it('rejects a response missing access_token', () => {
    expect(parseGoogleTokenResponse({ expires_in: 3599, token_type: 'Bearer', scope: 'x' }).ok).toBe(false)
  })
  it('rejects a non-numeric expires_in', () => {
    expect(parseGoogleTokenResponse({
      access_token: 'a', expires_in: 'soon', token_type: 'Bearer', scope: 'x',
    }).ok).toBe(false)
  })
  it('rejects a Google error body', () => {
    expect(parseGoogleTokenResponse({ error: 'invalid_grant', error_description: 'Bad Request' }).ok).toBe(false)
  })
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `npx vitest run lib/sync/gauth-types.test.ts`
Expected: FAIL（`gauth-types` が存在しない）

- [ ] **Step 3: 最小実装**

`lib/sync/gauth-types.ts`:

```ts
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/gauth-types.test.ts`
Expected: PASS（16 前後）

- [ ] **Step 5: tsc**

Run: `rtk npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 6: コミット**

```bash
rtk git add lib/sync/gauth-types.ts lib/sync/gauth-types.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): gauth request/response zod schemas + parsers

Shared interface point for the /api/gauth/* Functions and lib/sync/auth.ts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `functions/api/gauth/token.ts`（認可コード → トークン交換）

**Files:**
- Create: `functions/api/gauth/_shared.ts`
- Create: `functions/api/gauth/token.ts`
- Create: `.dev.vars.example`
- Test: `functions/api/gauth/token.test.ts`

**Interfaces:**
- Consumes: `parseTokenExchangeRequest` from `../../../lib/sync/gauth-types`
- Produces:
  - `functions/api/gauth/_shared.ts`（token / refresh 両方が使う）:
    - `readCappedText(request: Request, maxBytes: number): Promise<string | null>`（超過で `null`）
    - `jsonResponse(status: number, body: unknown): Response`（`Content-Type: application/json` + `Cache-Control: no-store`）
    - `postToGoogleToken(params: Readonly<Record<string, string>>): Promise<{ status: number; text: string }>`（`oauth2.googleapis.com/token` に form POST・fetch 例外は `status: 0`）
    - `relayGoogleTokenResponse(status: number, text: string): Response`（2xx → 200 通過 / 0・5xx → 502 / その他 → 400）
  - `functions/api/gauth/token.ts`: `onRequestPost(ctx: { request: Request; env: { GOOGLE_OAUTH_CLIENT_ID: string; GOOGLE_OAUTH_CLIENT_SECRET: string } }): Promise<Response>`
  - 契約: 200 のとき body は Google のトークン JSON をそのまま。エラーは `{ error: string }` JSON（400 = 入力不正 / google_rejected の 4xx、413 = body 過大、500 = env 未設定、502 = Google 到達不可 or Google 5xx）

- [ ] **Step 1: 失敗するテストを書く**

`functions/api/gauth/token.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { onRequestPost } from './token'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const ENV = { GOOGLE_OAUTH_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_OAUTH_CLIENT_SECRET: 'secret-xyz' }

function makeCtx(body: unknown, env: Record<string, string> = ENV) {
  const json = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    request: new Request('https://allmarks.app/api/gauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': String(json.length) },
      body: json,
    }),
    env,
  }
}

const GOOGLE_OK = {
  access_token: 'ya29.aaa', expires_in: 3599, token_type: 'Bearer',
  scope: 'https://www.googleapis.com/auth/drive.file openid', refresh_token: '1//rrr',
}

describe('POST /api/gauth/token', () => {
  it('exchanges the code with Google and passes the token JSON straight through', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(GOOGLE_OK), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await onRequestPost(makeCtx({ code: '4/abc', redirectUri: 'https://allmarks.app' }) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(GOOGLE_OK)

    // Verify the outgoing request to Google
    expect(fetchMock).toHaveBeenCalledOnce()
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toBe('https://oauth2.googleapis.com/token')
    const sent = new URLSearchParams(init.body as string)
    expect(sent.get('code')).toBe('4/abc')
    expect(sent.get('client_id')).toBe(ENV.GOOGLE_OAUTH_CLIENT_ID)
    expect(sent.get('client_secret')).toBe(ENV.GOOGLE_OAUTH_CLIENT_SECRET)
    expect(sent.get('redirect_uri')).toBe('https://allmarks.app')
    expect(sent.get('grant_type')).toBe('authorization_code')
  })

  it('sets Cache-Control: no-store on the success response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(GOOGLE_OK), { status: 200 })))
    const res = await onRequestPost(makeCtx({ code: '4/abc', redirectUri: 'https://allmarks.app' }) as never)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('400 on a missing code (never calls Google)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await onRequestPost(makeCtx({ redirectUri: 'https://allmarks.app' }) as never)
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('400 on malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const res = await onRequestPost(makeCtx('{not json') as never)
    expect(res.status).toBe(400)
  })

  it('500 when the OAuth env vars are not configured', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const res = await onRequestPost(makeCtx({ code: '4/abc', redirectUri: 'https://allmarks.app' }, {}) as never)
    expect(res.status).toBe(500)
  })

  it('400 when Google rejects the code (invalid_grant)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })))
    const res = await onRequestPost(makeCtx({ code: '4/bad', redirectUri: 'https://allmarks.app' }) as never)
    expect(res.status).toBe(400)
    expect((await res.json() as { error: string }).error).toBeTruthy()
  })

  it('502 when Google returns a 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream boom', { status: 503 })))
    const res = await onRequestPost(makeCtx({ code: '4/abc', redirectUri: 'https://allmarks.app' }) as never)
    expect(res.status).toBe(502)
  })

  it('502 when the fetch to Google throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    const res = await onRequestPost(makeCtx({ code: '4/abc', redirectUri: 'https://allmarks.app' }) as never)
    expect(res.status).toBe(502)
  })

  it('413 when the body exceeds the cap (no Content-Length header)', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const huge = JSON.stringify({ code: 'x'.repeat(20_000), redirectUri: 'https://allmarks.app' })
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(new TextEncoder().encode(huge)); c.close() },
    })
    const ctx = {
      request: new Request('https://allmarks.app/api/gauth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: stream, duplex: 'half',
      } as RequestInit & { duplex: 'half' }),
      env: ENV,
    }
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(413)
  })
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `npx vitest run functions/api/gauth/token.test.ts`
Expected: FAIL（`./token` が無い）

- [ ] **Step 3: `_shared.ts` を実装**

`functions/api/gauth/_shared.ts`:

```ts
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
```

- [ ] **Step 4: `token.ts` を実装**

`functions/api/gauth/token.ts`:

```ts
// functions/api/gauth/token.ts
// POST /api/gauth/token — 認可コードを Google のトークンに交換する中継。
//
//   受け取り: { code, redirectUri }  (redirectUri = 呼び出しページの origin)
//   やること: client_secret を足して oauth2.googleapis.com/token に POST し、
//             返ってきた JSON をそのまま返す。
//   保存しない・ログを出さない (stateless)。設計 §4.2。
//
// PKCE は使わない ("ウェブアプリケーション" 型 = client_secret 認証)。詳細は
// docs/superpowers/plans/2026-09-03-device-sync-bundle-2-auth.md「設計上の判断」。
import { parseTokenExchangeRequest } from '../../../lib/sync/gauth-types'
import { readCappedText, jsonResponse, postToGoogleToken, relayGoogleTokenResponse } from './_shared'

interface Env {
  GOOGLE_OAUTH_CLIENT_ID: string
  GOOGLE_OAUTH_CLIENT_SECRET: string
}
interface PagesContext {
  request: Request
  env: Env
}

/** code (~2KB 未満) + redirectUri。余裕を見て 8KB。 */
const MAX_BODY_BYTES = 8 * 1024

export async function onRequestPost(ctx: PagesContext): Promise<Response> {
  if (!ctx.env.GOOGLE_OAUTH_CLIENT_ID || !ctx.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return jsonResponse(500, { error: 'oauth_not_configured' })
  }

  const declared = parseInt(ctx.request.headers.get('content-length') ?? '0', 10)
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: 'body_too_large' })
  }
  const raw = await readCappedText(ctx.request, MAX_BODY_BYTES)
  if (raw === null) return jsonResponse(413, { error: 'body_too_large' })

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonResponse(400, { error: 'malformed_json' })
  }
  const parsed = parseTokenExchangeRequest(body)
  if (!parsed.ok) return jsonResponse(400, { error: 'invalid_request' })

  const { status, text } = await postToGoogleToken({
    code: parsed.value.code,
    client_id: ctx.env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: ctx.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirect_uri: parsed.value.redirectUri,
    grant_type: 'authorization_code',
  })
  return relayGoogleTokenResponse(status, text)
}
```

- [ ] **Step 5: `.dev.vars.example` を作る**

`.dev.vars.example`（tracked・実値は絶対に書かない）:

```
# ローカルで `npx wrangler pages dev out --port 3000` を使うとき用。
# このファイルを `.dev.vars` にコピーして実値を入れる (.dev.vars は git 管理外)。
# 実値は Google Cloud Console の OAuth 2.0 クライアント (ウェブアプリケーション型)。
# 取得手順 = docs/superpowers/plans/2026-09-03-device-sync-bundle-2-auth.md Task 6
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
```

- [ ] **Step 6: テストが通ることを確認**

Run: `npx vitest run functions/api/gauth/token.test.ts`
Expected: PASS（9）

- [ ] **Step 7: ログ・保存が無いことを確認**

Run: `grep -rn "console\.\|env\.SHARE\|KVNamespace\|R2Bucket" functions/api/gauth/`
Expected: 出力なし

- [ ] **Step 8: tsc**

Run: `rtk npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 9: コミット**

```bash
rtk git add functions/api/gauth/_shared.ts functions/api/gauth/token.ts functions/api/gauth/token.test.ts .dev.vars.example
rtk git commit -m "$(cat <<'EOF'
feat(sync): /api/gauth/token — stateless authorization_code exchange

Relays {code, redirectUri} to Google's token endpoint with client_secret
attached; passes the token JSON straight through. Stores nothing, logs
nothing. No PKCE (web-app client type).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `functions/api/gauth/refresh.ts`（refresh token → access token）

**Files:**
- Create: `functions/api/gauth/refresh.ts`
- Test: `functions/api/gauth/refresh.test.ts`

**Interfaces:**
- Consumes: `parseTokenRefreshRequest` from `../../../lib/sync/gauth-types`、`readCappedText` / `jsonResponse` / `postToGoogleToken` / `relayGoogleTokenResponse` from `./_shared`（Task 2 で作成済み）
- Produces: `onRequestPost(ctx: { request: Request; env: { GOOGLE_OAUTH_CLIENT_ID: string; GOOGLE_OAUTH_CLIENT_SECRET: string } }): Promise<Response>`。契約は token.ts と同じ（200 = Google の JSON そのまま・`refresh_token` は通常含まれない / エラーは `{ error }` JSON）

- [ ] **Step 1: 失敗するテストを書く**

`functions/api/gauth/refresh.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { onRequestPost } from './refresh'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const ENV = { GOOGLE_OAUTH_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_OAUTH_CLIENT_SECRET: 'secret-xyz' }

function makeCtx(body: unknown, env: Record<string, string> = ENV) {
  const json = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    request: new Request('https://allmarks.app/api/gauth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': String(json.length) },
      body: json,
    }),
    env,
  }
}

const GOOGLE_REFRESH_OK = {
  access_token: 'ya29.new', expires_in: 3599, token_type: 'Bearer',
  scope: 'https://www.googleapis.com/auth/drive.file openid',
}

describe('POST /api/gauth/refresh', () => {
  it('refreshes the access token and passes the JSON straight through', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(GOOGLE_REFRESH_OK), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await onRequestPost(makeCtx({ refreshToken: '1//rrr' }) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(GOOGLE_REFRESH_OK)

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toBe('https://oauth2.googleapis.com/token')
    const sent = new URLSearchParams(init.body as string)
    expect(sent.get('refresh_token')).toBe('1//rrr')
    expect(sent.get('client_id')).toBe(ENV.GOOGLE_OAUTH_CLIENT_ID)
    expect(sent.get('client_secret')).toBe(ENV.GOOGLE_OAUTH_CLIENT_SECRET)
    expect(sent.get('grant_type')).toBe('refresh_token')
    expect(sent.has('redirect_uri')).toBe(false)
  })

  it('400 on a missing refreshToken (never calls Google)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await onRequestPost(makeCtx({}) as never)
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('500 when the OAuth env vars are not configured', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const res = await onRequestPost(makeCtx({ refreshToken: '1//rrr' }, {}) as never)
    expect(res.status).toBe(500)
  })

  it('400 when Google rejects the refresh token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })))
    const res = await onRequestPost(makeCtx({ refreshToken: '1//dead' }) as never)
    expect(res.status).toBe(400)
  })

  it('502 when the fetch to Google throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    const res = await onRequestPost(makeCtx({ refreshToken: '1//rrr' }) as never)
    expect(res.status).toBe(502)
  })
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `npx vitest run functions/api/gauth/refresh.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`functions/api/gauth/refresh.ts`:

```ts
// functions/api/gauth/refresh.ts
// POST /api/gauth/refresh — refresh token を新しい access token に交換する中継。
//
//   受け取り: { refreshToken }
//   やること: client_secret を足して grant_type=refresh_token で交換 → JSON をそのまま返す。
//   保存しない・ログを出さない (stateless)。設計 §4.2。
import { parseTokenRefreshRequest } from '../../../lib/sync/gauth-types'
import { readCappedText, jsonResponse, postToGoogleToken, relayGoogleTokenResponse } from './_shared'

interface Env {
  GOOGLE_OAUTH_CLIENT_ID: string
  GOOGLE_OAUTH_CLIENT_SECRET: string
}
interface PagesContext {
  request: Request
  env: Env
}

const MAX_BODY_BYTES = 8 * 1024

export async function onRequestPost(ctx: PagesContext): Promise<Response> {
  if (!ctx.env.GOOGLE_OAUTH_CLIENT_ID || !ctx.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return jsonResponse(500, { error: 'oauth_not_configured' })
  }

  const declared = parseInt(ctx.request.headers.get('content-length') ?? '0', 10)
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: 'body_too_large' })
  }
  const raw = await readCappedText(ctx.request, MAX_BODY_BYTES)
  if (raw === null) return jsonResponse(413, { error: 'body_too_large' })

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonResponse(400, { error: 'malformed_json' })
  }
  const parsed = parseTokenRefreshRequest(body)
  if (!parsed.ok) return jsonResponse(400, { error: 'invalid_request' })

  const { status, text } = await postToGoogleToken({
    refresh_token: parsed.value.refreshToken,
    client_id: ctx.env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: ctx.env.GOOGLE_OAUTH_CLIENT_SECRET,
    grant_type: 'refresh_token',
  })
  return relayGoogleTokenResponse(status, text)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run functions/api/gauth/refresh.test.ts`
Expected: PASS（5）

- [ ] **Step 5: tsc**

Run: `rtk npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 6: コミット**

```bash
rtk git add functions/api/gauth/refresh.ts functions/api/gauth/refresh.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): /api/gauth/refresh — stateless refresh_token exchange

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `lib/sync/google-identity.ts`（GIS スクリプトの遅延ロード）

**Files:**
- Create: `lib/sync/google-identity.ts`
- Test: `lib/sync/google-identity.test.ts`

**Interfaces:**
- Consumes: なし（DOM のみ）
- Produces:
  - `loadGoogleIdentityServices(): Promise<GoogleGlobal>`（`window.google` を resolve。二重ロードしない・同時呼び出しは同じ promise を共有・失敗時は promise をリセットして次回リトライ可）
  - `interface GoogleGlobal { accounts: { oauth2: GoogleOAuth2 } }`
  - `interface GoogleOAuth2 { initCodeClient(config: GoogleCodeClientConfig): GoogleCodeClient }`
  - `interface GoogleCodeClient { requestCode(): void }`
  - `interface GoogleCodeClientConfig { client_id: string; scope: string; ux_mode: 'popup'; callback: (r: GoogleCodeResponse) => void; error_callback?: (e: GoogleGsiError) => void }`
  - `interface GoogleCodeResponse { code?: string; scope?: string; error?: string; error_description?: string }`
  - `interface GoogleGsiError { type: string; message?: string }`
  - `declare global { interface Window { google?: GoogleGlobal } }`

- [ ] **Step 1: 失敗するテストを書く**

`lib/sync/google-identity.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { loadGoogleIdentityServices as LoadFn } from './google-identity'

// モジュール先頭の `loadPromise` シングルトンがテスト間に残るので、毎回
// vi.resetModules() + 動的 import で真っさらな状態から始める。
// jsdom は <script> を実際には fetch しないので、appendChild を捕まえて
// onload / onerror を手で発火させる (lib/embed/soundcloud-widget と同じ手法)。
let appended: HTMLScriptElement[]
let load: typeof LoadFn

const fakeGoogle = { accounts: { oauth2: { initCodeClient: () => ({ requestCode() {} }) } } }

beforeEach(async () => {
  vi.resetModules()
  appended = []
  vi.spyOn(document.head, 'appendChild').mockImplementation(((node: Node): Node => {
    if (node instanceof HTMLScriptElement) appended.push(node)
    return node
  }) as typeof document.head.appendChild)
  ;({ loadGoogleIdentityServices: load } = await import('./google-identity'))
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as { google?: unknown }).google
})

describe('loadGoogleIdentityServices', () => {
  it('injects the GIS script once and resolves window.google on load', async () => {
    const p = load()
    expect(appended).toHaveLength(1)
    expect(appended[0].src).toBe('https://accounts.google.com/gsi/client')
    expect(appended[0].async).toBe(true)

    ;(window as { google?: unknown }).google = fakeGoogle
    appended[0].onload?.(new Event('load'))
    await expect(p).resolves.toHaveProperty('accounts.oauth2')
  })

  it('shares one in-flight promise across concurrent callers (one script tag)', async () => {
    const p1 = load()
    const p2 = load()
    expect(appended).toHaveLength(1)
    expect(p1).toBe(p2)
    ;(window as { google?: unknown }).google = fakeGoogle
    appended[0].onload?.(new Event('load'))
    await expect(Promise.all([p1, p2])).resolves.toBeTruthy()
  })

  it('rejects and allows retry when the script fails to load', async () => {
    const p = load()
    appended[0].onerror?.(new Event('error'))
    await expect(p).rejects.toThrow(/load/i)

    // retry produces a fresh script tag (loadPromise was reset to null on error)
    const p2 = load()
    expect(appended).toHaveLength(2)
    ;(window as { google?: unknown }).google = fakeGoogle
    appended[1].onload?.(new Event('load'))
    await expect(p2).resolves.toBeTruthy()
  })

  it('rejects when the script loads but window.google is still missing', async () => {
    const p = load()
    appended[0].onload?.(new Event('load'))
    await expect(p).rejects.toThrow(/missing/i)
  })
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `npx vitest run lib/sync/google-identity.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**（`lib/embed/soundcloud-widget.ts` をなぞる）

`lib/sync/google-identity.ts`:

```ts
// lib/sync/google-identity.ts
// Google Identity Services (GIS) の client ライブラリを 1 回だけロードする。
// lib/embed/soundcloud-widget.ts と同じ「inject once + shared promise」パターン。

/** GIS code client の設定 (使うオプションだけ・popup 固定)。 */
export interface GoogleCodeClientConfig {
  client_id: string
  /** space 区切りのスコープ。 */
  scope: string
  ux_mode: 'popup'
  callback: (response: GoogleCodeResponse) => void
  error_callback?: (error: GoogleGsiError) => void
}

/** popup callback が受け取るオブジェクト。 */
export interface GoogleCodeResponse {
  code?: string
  scope?: string
  error?: string
  error_description?: string
}

/** error_callback が受け取るオブジェクト (ポップアップを閉じた等)。 */
export interface GoogleGsiError {
  type: string
  message?: string
}

export interface GoogleCodeClient {
  requestCode(): void
}

export interface GoogleOAuth2 {
  initCodeClient(config: GoogleCodeClientConfig): GoogleCodeClient
}

export interface GoogleGlobal {
  accounts: { oauth2: GoogleOAuth2 }
}

declare global {
  interface Window {
    google?: GoogleGlobal
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let loadPromise: Promise<GoogleGlobal> | null = null

/**
 * GIS の client script を注入し、`window.google` が使えるようになったら
 * resolve する。ページに 1 回だけ注入・同時呼び出しは同じ promise を共有。
 * 失敗時は `loadPromise` を null に戻すので、次の呼び出しでリトライできる。
 */
export function loadGoogleIdentityServices(): Promise<GoogleGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Identity Services requires a browser environment'))
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google)
  if (loadPromise) return loadPromise

  loadPromise = new Promise<GoogleGlobal>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = (): void => {
      if (window.google?.accounts?.oauth2) {
        resolve(window.google)
      } else {
        loadPromise = null
        reject(new Error('GIS script loaded but window.google.accounts.oauth2 is missing'))
      }
    }
    script.onerror = (): void => {
      loadPromise = null
      reject(new Error('Failed to load the Google Identity Services script'))
    }
    document.head.appendChild(script)
  })
  return loadPromise
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/sync/google-identity.test.ts`
Expected: PASS（4）

- [ ] **Step 5: tsc**

Run: `rtk npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 6: コミット**

```bash
rtk git add lib/sync/google-identity.ts lib/sync/google-identity.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(sync): loadGoogleIdentityServices — lazy one-shot GIS script loader

Mirrors lib/embed/soundcloud-widget.ts (inject once, shared promise, retry
on error).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `lib/sync/auth.ts` ＋ env 配線

**Files:**
- Create: `lib/sync/auth.ts`
- Test: `lib/sync/auth.test.ts`
- Modify: `lib/constants.ts`（1 行追加）
- Modify: `.env.production`（1 行追加）

**Interfaces:**
- Consumes:
  - `loadGoogleIdentityServices`, `GoogleCodeResponse`, `GoogleGsiError` from `./google-identity`
  - `parseGoogleTokenResponse`, `type GoogleTokenResponse` from `./gauth-types`
  - `GOOGLE_OAUTH_CLIENT_ID` from `@/lib/constants`（Task 5 で追加）
- Produces:
  - `const SYNC_OAUTH_SCOPE = 'https://www.googleapis.com/auth/drive.file openid email profile'`
  - `interface SyncTokens { accessToken: string; expiresAt: number; scope: string; refreshToken?: string }`
  - `class GauthError extends Error`
  - `computeExpiresAt(expiresIn: number, now: number): number`（60 秒の安全マージン付き epoch-ms）
  - `isAccessTokenExpired(expiresAt: number, now: number): boolean`
  - `requestAuthCode(): Promise<string>`（GIS ポップアップ同意 → 認可 code）
  - `exchangeCode(code: string, origin?: string): Promise<SyncTokens>`（既定 origin = `window.location.origin`）
  - `refreshAccessToken(refreshToken: string): Promise<SyncTokens>`

- [ ] **Step 1: 失敗するテストを書く**

`lib/sync/auth.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('./google-identity', () => ({
  loadGoogleIdentityServices: vi.fn(),
}))

import {
  computeExpiresAt, isAccessTokenExpired, requestAuthCode, exchangeCode,
  refreshAccessToken, GauthError, SYNC_OAUTH_SCOPE,
} from './auth'
import { loadGoogleIdentityServices } from './google-identity'
import type { GoogleCodeClientConfig, GoogleCodeClient } from './google-identity'

const mockLoad = vi.mocked(loadGoogleIdentityServices)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('computeExpiresAt / isAccessTokenExpired (pure)', () => {
  it('applies a 60s safety margin', () => {
    expect(computeExpiresAt(3600, 1_000_000)).toBe(1_000_000 + (3600 - 60) * 1000)
  })
  it('never returns a time before now (tiny expires_in)', () => {
    expect(computeExpiresAt(10, 1_000_000)).toBe(1_000_000)
  })
  it('isAccessTokenExpired is true at/after expiry', () => {
    expect(isAccessTokenExpired(1000, 999)).toBe(false)
    expect(isAccessTokenExpired(1000, 1000)).toBe(true)
    expect(isAccessTokenExpired(1000, 1001)).toBe(true)
  })
})

function stubGis(initCodeClient: (config: GoogleCodeClientConfig) => GoogleCodeClient): void {
  mockLoad.mockResolvedValue({ accounts: { oauth2: { initCodeClient } } })
}

describe('requestAuthCode', () => {
  it('resolves the code from the GIS popup callback', async () => {
    let captured: GoogleCodeClientConfig | null = null
    stubGis((config) => {
      captured = config
      return { requestCode: () => config.callback({ code: '4/xyz' }) }
    })
    await expect(requestAuthCode()).resolves.toBe('4/xyz')
    expect(captured!.scope).toBe(SYNC_OAUTH_SCOPE)
    expect(captured!.ux_mode).toBe('popup')
  })

  it('rejects with GauthError when the callback carries an error', async () => {
    stubGis((config) => ({ requestCode: () => config.callback({ error: 'access_denied', error_description: 'user said no' }) }))
    await expect(requestAuthCode()).rejects.toBeInstanceOf(GauthError)
  })

  it('rejects with GauthError when error_callback fires (popup closed)', async () => {
    stubGis((config) => ({
      requestCode: () => config.error_callback?.({ type: 'popup_closed' }),
    }))
    await expect(requestAuthCode()).rejects.toBeInstanceOf(GauthError)
  })
})

const GOOGLE_OK = {
  access_token: 'ya29.a', expires_in: 3599, token_type: 'Bearer',
  scope: 'https://www.googleapis.com/auth/drive.file openid', refresh_token: '1//r',
}

describe('exchangeCode', () => {
  it('POSTs {code, redirectUri} to /api/gauth/token and maps to SyncTokens', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(GOOGLE_OK), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

    const tokens = await exchangeCode('4/xyz', 'https://allmarks.app')
    expect(tokens.accessToken).toBe('ya29.a')
    expect(tokens.refreshToken).toBe('1//r')
    expect(tokens.scope).toBe(GOOGLE_OK.scope)
    expect(tokens.expiresAt).toBe(1_000_000 + (3599 - 60) * 1000)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/gauth/token')
    expect(JSON.parse(init.body as string)).toEqual({ code: '4/xyz', redirectUri: 'https://allmarks.app' })
  })

  it('throws GauthError on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"google_rejected"}', { status: 400 })))
    await expect(exchangeCode('4/bad', 'https://allmarks.app')).rejects.toBeInstanceOf(GauthError)
  })

  it('throws GauthError when the response is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>CF error</html>', { status: 200 })))
    await expect(exchangeCode('4/x', 'https://allmarks.app')).rejects.toBeInstanceOf(GauthError)
  })

  it('throws GauthError when the JSON fails schema validation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"access_token":""}', { status: 200 })))
    await expect(exchangeCode('4/x', 'https://allmarks.app')).rejects.toBeInstanceOf(GauthError)
  })
})

describe('refreshAccessToken', () => {
  it('POSTs {refreshToken} to /api/gauth/refresh and maps to SyncTokens (no refreshToken back)', async () => {
    const body = { access_token: 'ya29.new', expires_in: 3599, token_type: 'Bearer', scope: 'openid' }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000)

    const tokens = await refreshAccessToken('1//r')
    expect(tokens.accessToken).toBe('ya29.new')
    expect(tokens.refreshToken).toBeUndefined()
    expect(tokens.expiresAt).toBe(2_000_000 + (3599 - 60) * 1000)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/gauth/refresh')
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: '1//r' })
  })

  it('throws GauthError on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"google_rejected"}', { status: 400 })))
    await expect(refreshAccessToken('1//dead')).rejects.toBeInstanceOf(GauthError)
  })
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `npx vitest run lib/sync/auth.test.ts`
Expected: FAIL

- [ ] **Step 3: `lib/constants.ts` に client id を追加**

`lib/constants.ts` の `SITE_URL` ブロックの直後に:

```ts
/** Google OAuth 2.0 "Web application" client ID for device-sync. Public value
 *  — baked into the client bundle (NEXT_PUBLIC_*). Empty in dev and until the
 *  Cloud Console client exists; the sync UI (bundle 6) stays gated while empty. */
export const GOOGLE_OAUTH_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? ''
```

- [ ] **Step 4: `.env.production` に 1 行追加**

`.env.production` の末尾に:

```
# Device-sync: Google OAuth 2.0 Web client ID (public — baked into the bundle).
# Value comes from Google Cloud Console (see the bundle-2 plan Task 6). The
# client SECRET is NOT here — it lives only in Cloudflare Pages env + .dev.vars.
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=
```

- [ ] **Step 5: `lib/sync/auth.ts` を実装**

```ts
// lib/sync/auth.ts
// 端末間同期の「ログイン受け渡し」オーケストレーション。
//   - requestAuthCode()  : GIS コードモデルの同意ポップアップ → 認可 code
//   - exchangeCode()     : code → /api/gauth/token → SyncTokens
//   - refreshAccessToken(): refresh token → /api/gauth/refresh → SyncTokens
// IndexedDB は触らない (永続化は束4 の sync-store の責務)。呼び出し元はこの束では
// ゼロ。設計 §4.1 / §7.1、および plan「設計上の判断」§2 §3 §5。
import {
  loadGoogleIdentityServices,
  type GoogleCodeResponse,
  type GoogleGsiError,
} from './google-identity'
import { parseGoogleTokenResponse } from './gauth-types'
import { GOOGLE_OAUTH_CLIENT_ID } from '@/lib/constants'

/** 同期に必要な最小スコープ。drive.file = AllMarks が作ったファイルだけ見える。 */
export const SYNC_OAUTH_SCOPE = 'https://www.googleapis.com/auth/drive.file openid email profile'

/** access token 期限の安全マージン (秒)。期限ちょうどの手前で更新させる。 */
const EXPIRY_SAFETY_MARGIN_SEC = 60

export interface SyncTokens {
  accessToken: string
  /** epoch ms。安全マージン適用済み (この時刻を過ぎたら更新する)。 */
  expiresAt: number
  /** Google が返したスコープ (space 区切り)。 */
  scope: string
  /** 初回の code 交換でのみ返る。refresh では返らない。 */
  refreshToken?: string
}

/** 同期の認証まわりで投げる型。呼び出し側は instanceof で拾って「再接続」導線へ。 */
export class GauthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GauthError'
  }
}

/** expires_in(秒) を安全マージン付きの epoch-ms 期限に変換する。純関数。 */
export function computeExpiresAt(expiresIn: number, now: number): number {
  return now + Math.max(0, expiresIn - EXPIRY_SAFETY_MARGIN_SEC) * 1000
}

/** now が expiresAt 以上なら true。純関数。 */
export function isAccessTokenExpired(expiresAt: number, now: number): boolean {
  return now >= expiresAt
}

/**
 * GIS コードモデルの同意ポップアップを開き、認可 code を 1 つ resolve する。
 * ユーザーがポップアップを閉じた / 拒否した場合は GauthError で reject。
 */
export async function requestAuthCode(): Promise<string> {
  const google = await loadGoogleIdentityServices()
  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      scope: SYNC_OAUTH_SCOPE,
      ux_mode: 'popup',
      callback: (response: GoogleCodeResponse): void => {
        if (response.code) {
          resolve(response.code)
        } else {
          reject(new GauthError(response.error_description || response.error || 'no authorization code returned'))
        }
      },
      error_callback: (error: GoogleGsiError): void => {
        reject(new GauthError(error.message || error.type || 'authorization popup failed'))
      },
    })
    client.requestCode()
  })
}

/**
 * 認可 code をトークンに交換する。`origin` は GIS ポップアップ方式の規則により
 * 「このページの origin」でなければならない (plan「設計上の判断」§3)。
 */
export async function exchangeCode(
  code: string,
  origin: string = window.location.origin,
): Promise<SyncTokens> {
  const res = await fetch('/api/gauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri: origin }),
  })
  return toSyncTokens(res)
}

/** stored refresh token で新しい access token を得る。 */
export async function refreshAccessToken(refreshToken: string): Promise<SyncTokens> {
  const res = await fetch('/api/gauth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  return toSyncTokens(res)
}

/** Function の応答を検証して SyncTokens に写す。失敗は全部 GauthError。 */
async function toSyncTokens(res: Response): Promise<SyncTokens> {
  if (!res.ok) {
    throw new GauthError(`gauth endpoint returned ${res.status}`)
  }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new GauthError('gauth response was not JSON')
  }
  const parsed = parseGoogleTokenResponse(body)
  if (!parsed.ok) {
    throw new GauthError(`gauth response failed validation: ${parsed.error}`)
  }
  const g = parsed.value
  return {
    accessToken: g.access_token,
    expiresAt: computeExpiresAt(g.expires_in, Date.now()),
    scope: g.scope,
    refreshToken: g.refresh_token,
  }
}
```

- [ ] **Step 6: テストが通ることを確認**

Run: `npx vitest run lib/sync/auth.test.ts`
Expected: PASS（14 前後）

- [ ] **Step 7: 呼び出し元ゼロを確認**

Run: `git grep -n "sync/auth\|sync/google-identity\|sync/gauth-types" -- '*.ts' '*.tsx'`
Expected: ヒットは `lib/sync/` 内部（`auth.ts` → `google-identity` / `gauth-types`）と `functions/api/gauth/*.ts` と `*.test.ts` のみ。`components/` `app/` `lib/board/` `lib/storage/` 等からのヒットが 0 件であること（この束では UI/engine に配線しない）。

- [ ] **Step 8: tsc + build**

Run: `rtk npx tsc --noEmit && rtk pnpm build`
Expected: tsc エラー 0 / build 成功（`.env.production` の空 env で NEXT_PUBLIC 変数が `''` として埋め込まれるだけ）

- [ ] **Step 9: コミット**

```bash
rtk git add lib/sync/auth.ts lib/sync/auth.test.ts lib/constants.ts .env.production
rtk git commit -m "$(cat <<'EOF'
feat(sync): lib/sync/auth — GIS code-model login handoff

requestAuthCode (popup consent -> code), exchangeCode / refreshAccessToken
(-> /api/gauth/*), pure expiry helpers. No IDB, zero callers this bundle.
Adds NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID (empty until Cloud Console setup).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Google Cloud 側の設定 ＋ Cloudflare シークレット（ユーザー作業・1 回きり）

> **これはコードタスクではない。** 実装者（subagent）はここで停止し、司令塔（親セッション）がユーザーに以下を依頼する。ユーザー作業が終わってから Task 5 の `.env.production` に実値を入れて deploy する。**この Task が終わるまで同期機能は動かないが、ビルド・既存機能には一切影響しない**（`GOOGLE_OAUTH_CLIENT_ID` が空でもビルドは通り、既存挙動は不変）。

### 6-A. Google Cloud Console でプロジェクトと OAuth クライアントを作る

1. **プロジェクト作成**
   - https://console.cloud.google.com/ を開く（Google アカウントでログイン）
   - 画面上部のプロジェクト選択ドロップダウン → 「新しいプロジェクト」
   - プロジェクト名: `AllMarks Sync`（任意）→「作成」→ 作成後、そのプロジェクトを選択

2. **OAuth 同意画面**（左メニュー「API とサービス」→「OAuth 同意画面」）
   - User Type: **外部（External）** →「作成」
   - アプリ情報:
     - アプリ名: `AllMarks`
     - ユーザーサポートメール: 自分の Gmail
     - デベロッパーの連絡先情報: 同じメール
   - 「保存して次へ」
   - **スコープ**: 「スコープを追加または削除」→ 上の表で以下 4 つにチェック → 「更新」→「保存して次へ」
     - `.../auth/drive.file`（フィルタ欄に `drive.file` と入力すると出る。**「制限付き」ではなく「機密性の高いスコープ」でもない**＝審査キュー無し）
     - `openid`
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
   - テストユーザー: 何も足さず「保存して次へ」
   - サマリー画面 →「ダッシュボードに戻る」
   - **「アプリを公開」ボタン →「本番環境にプッシュ」**（公開ステータスを「テスト」から「本番（In production）」へ）。`drive.file` 等は非機密なので Google の審査待ちにならず即公開される

3. **OAuth 2.0 クライアント ID**（「API とサービス」→「認証情報」→「認証情報を作成」→「OAuth クライアント ID」）
   - アプリケーションの種類: **ウェブアプリケーション**
   - 名前: `AllMarks Web`
   - **承認済みの JavaScript 生成元** に 2 つ追加:
     - `http://localhost:3000`
     - `https://allmarks.app`
   - **承認済みのリダイレクト URI** に 2 つ追加（末尾スラッシュ無しの origin をそのまま）:
     - `http://localhost:3000`
     - `https://allmarks.app`
   - 「作成」→ **クライアント ID** と **クライアント シークレット** が表示される（後でも「認証情報」から再表示できる）

4. **ブランド確認**（consent 画面にロゴ／ドメイン所有権の確認）は**公開直前に別途**。同期の動作テストには不要なので今はスキップ。

### 6-B. 値の置き場所

| 値 | 置き場所 | 秘匿 |
|---|---|---|
| **クライアント ID** | ① `.env.production` の `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=`（司令塔が入れて commit）<br>② Cloudflare Pages 環境変数 `GOOGLE_OAUTH_CLIENT_ID`（Function 用） | 公開値（バンドルに載る）。ただし Function は自分の env から読むので CF 側にも要る |
| **クライアント シークレット** | ① Cloudflare Pages 環境変数 `GOOGLE_OAUTH_CLIENT_SECRET`（「シークレットとして暗号化」）<br>② ローカル `wrangler pages dev` 用に `.dev.vars`（`.dev.vars.example` をコピー・git 管理外） | **秘匿**。tracked ファイル・チャットに貼らない |

**Cloudflare Pages 環境変数の入れ方**（ダッシュボード・非エンジニア向け）:
- https://dash.cloudflare.com/ → Workers & Pages → `allmarks` → 「設定」→「環境変数」（Variables and Secrets）
- 「本番（Production）」に 2 つ追加:
  - `GOOGLE_OAUTH_CLIENT_ID` = クライアント ID（種類: テキストで可）
  - `GOOGLE_OAUTH_CLIENT_SECRET` = クライアント シークレット（**種類: シークレット／暗号化**）
- （任意）「プレビュー（Preview）」にも同じ 2 つを入れておくと、別ブランチの preview deploy でも Function が動く
- CLI 派の場合: `npx wrangler pages secret put GOOGLE_OAUTH_CLIENT_SECRET --project-name=allmarks`（対話で貼り付け）／ID は `.env` で `wrangler pages deploy` 時に渡すか同じく secret put

### 6-C. ローカル `.dev.vars`（開発者のみ・任意）

リポジトリ直下で:

```bash
cp .dev.vars.example .dev.vars
# .dev.vars を開いて 2 つの値を貼る (このファイルは git 管理外)
```

疎通テスト: `rtk pnpm build && npx wrangler pages dev out --port 3000` → ブラウザの devtools コンソールから
`fetch('/api/gauth/token',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status)`
→ `400`（`invalid_request`）が返れば Function は生きている（`500` なら env 未読込）。

### 6-D. 完了後（司令塔がやる）

- [ ] `.env.production` の `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=` に実 ID を入れて commit
- [ ] deploy 前ゲート（`rtk npx tsc --noEmit && npx vitest run && rtk pnpm build`）を通す
- [ ] `feat/device-sync-bundle-2` を master にマージ
- [ ] `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- [ ] 本番で `fetch('/api/gauth/token', { method:'POST', ... , body:'{}' })` が `400` を返すことを 1 回確認（Function がデプロイされ env を読めている証拠。Google は叩かれない）

---

## Self-Review（spec 突き合わせ）

**1. Spec coverage:**

| spec 項目 | 対応タスク |
|---|---|
| §4.2 `functions/api/gauth/token.ts`（code→token・secret 付・保存なし） | Task 2 |
| §4.2 `functions/api/gauth/refresh.ts`（refresh_token 交換・保存なし） | Task 3 |
| §4.2 zod で入力検証 | Task 1（スキーマ）＋ Task 2/3（使用） |
| §4.2 secret = `GOOGLE_OAUTH_CLIENT_SECRET`（CF env・`.dev.vars`） | Task 2（`.dev.vars.example`）＋ Task 6-B |
| §4.2 `GOOGLE_OAUTH_CLIENT_ID` も env に | Task 5（`.env.production`）＋ Task 6-B |
| §4.2 `_routes.json` に含める | **不要**と判断（「設計上の判断」§1・自動 routing で配信される） |
| §4.1 `lib/sync/auth.ts`（GIS `initCodeClient` ＋ refresh token 管理 ＋ `/api/gauth` 呼び出し） | Task 4（GIS ロード）＋ Task 5（`auth.ts`） |
| §4.3 Google Cloud 設定（プロジェクト／同意画面／クライアント ID／JS 生成元／リダイレクト URI） | Task 6-A |
| §4.3 `client_id`→`.env.production`、`client_secret`→CF シークレット＋`.dev.vars` | Task 5 ＋ Task 6-B/6-C |
| §7.1 step1-2（同意ポップアップ → code → `/api/gauth/token` → `{access, refresh}`） | Task 5（`requestAuthCode` + `exchangeCode`） |
| §7.1「PKCE verifier」 | **使わない**と判断（「設計上の判断」§2・`initCodeClient` に PKCE オプション無し・client_secret 型クライアント） |
| §12 不変条件（未接続は不変・Function は無保存・¥0・default byte-identical） | Global Constraints ＋ Task 5 Step 7 の呼び出し元ゼロ確認 |
| §11 テスト方針（`auth` = トークン期限・refresh 失敗のユニット / fetch モック） | Task 1/2/3/4/5 の各テスト |

**gap:** refresh token の IDB 永続化・`sync-store`・UI・初回接続フローの実配線は**束2 のスコープ外**（spec §14 の束4・束6）。この plan では意図的に未実装。

**2. Placeholder scan:** 各コードステップに実コードを記載済み。「適切なエラー処理」「TBD」等なし。Task 6 は手動作業だが画面ステップを具体的に列挙済み。

**3. Type consistency:**
- `ParseResult<T>` を Task 1 で定義、Task 2/3 が `parsed.ok` / `parsed.value` で使用 — 一致。
- `SyncTokens`（`accessToken` / `expiresAt` / `scope` / `refreshToken?`）を Task 5 で定義・使用 — Task 5 内で完結。
- `GoogleTokenResponse`（snake_case: `access_token` 等）は Task 1 定義、`auth.ts` の `toSyncTokens` で camelCase の `SyncTokens` に写す — 変換点は 1 箇所のみ。
- `GoogleCodeClientConfig` / `GoogleCodeResponse` / `GoogleGsiError` を Task 4 で定義、Task 5 の `requestAuthCode` と両テストが import — 名前一致。
- Function の `ctx.env` 型（`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`）は Task 2/3 で同一の `interface Env` — 一致。
- `_shared.ts` の `postToGoogleToken` / `relayGoogleTokenResponse` を Task 2 で定義、Task 3 が import — token.ts と refresh.ts はこの 2 関数を共有し、違いは渡す params（`grant_type` と `redirect_uri` の有無）だけ。**verbatim duplication は無い**（レビュー rubric 対策・preflight ruling 済み）。

---

## 実行方式

**Plan complete。`docs/superpowers/plans/2026-09-03-device-sync-bundle-2-auth.md` に保存。**

推奨: **Subagent-Driven**（`superpowers:subagent-driven-development`）。Task 1→5 を fresh subagent で 1 タスクずつ、各タスク後に 2 段レビュー。Task 6 の手前で停止してユーザーに Google Cloud 作業を依頼。

- Task 1 → 2 → 3 は直列（2/3 は 1 の型に依存）。4 は 1〜3 と独立（並行可だが同一ブランチ直列コミットなので順番に）。5 は 1・4 に依存。
- 触ってはいけないファイル: `functions/api/*`（gauth 以外）、`lib/storage/*`、`components/*`、`app/*`、`_routes.json`（作らない）、`wrangler.toml`。
- 全タスク完了後: フルスイート（`npx vitest run`）＋ `rtk pnpm build` ＋ opus 全ブランチレビュー。
