# 端末間同期 束5（最小K3＝同期の有料ゲート）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 署名付きライセンスキーで同期機能を解錠する「本物の最小K3」を作る。Cloudflare Worker 2本（発券 `/claim`・発動 `/activate`）＋ クライアント側のオフライン署名検証・IndexedDB永続化・ゲート判定関数（`isSyncUnlocked`）を実装する。

**Architecture:** Ed25519 非対称署名。開発者だけが持つ秘密鍵（Cloudflare Secret）でWorkerがキーに署名し、クライアントは同梱した公開鍵でオフライン検証する（サーバーはキーの真贋確認に関与しない＝オフラインでも解錠済みは有効）。発動台数（5台キャップ）だけをWorkerのKVで管理する。**この束もアプリ本体からの呼び出し元ゼロ**（`SETTINGS`のキー入力UI・`SyncPanel`の解錠導線は束6）＝既存挙動は1pxも変わらない。

**Tech Stack:** TypeScript strict, Web Crypto API（`crypto.subtle`, `Ed25519`）, `zod`, Cloudflare Pages Functions + KV, vitest + `fake-indexeddb/auto`。

**Spec:** `docs/private/2026-07-01-k3-unlock-design.md`（Ed25519方式・Worker設計・KVデータモデルの元設計。ただしこのspecは有料**テーマ**向けに書かれたもので `scope` を単一文字列 `'all-paid'` としている点に注意）／ `docs/private/2026-09-02-device-sync-design.md` §10・§15「束5/6着手前に必ず読む・未解決の申し送り」の1番（このspec外だが束5完了と同時に片付ける）。実行者は本計画書に加えてこの2つのspecの該当節も読むこと。

## Global Constraints

- **`scope` は配列 `readonly string[]`**（元spec `k3-unlock-design.md` §3 の単一文字列 `'all-paid'` から変更）。理由: `docs/private/IDEAS.md`（社内メモ）に「K3はper-themeスコープとall-paidスコープの両方を出せる設計」という前提が明記されており、`device-sync-design.md` §10 も「license-storeの`scope`に`'sync'`を含むか」という複数値ゲートで書かれている。この束が発券するキーは常に `scope: ['sync']` のみ（テーマの解錠は別束・`EMPTY_LICENSES`は無傷のまま）。
- **Ed25519 は動作確認済み**（このセッションでNode 24 + jsdom vitest環境で `crypto.subtle.generateKey/exportKey/sign/importKey/verify` の完全な往復を実機テスト済み）。標準名 `'Ed25519'` を使う（Cloudflare Workers公式ドキュメント推奨・`'NODE-ED25519'`はレガシー名で使わない）。ブラウザ対応はChrome137+/Safari17+/Firefox130+（2025年時点で主要ブラウザ全対応・カバレッジ約79%+）。未対応ブラウザは例外を投げるので、`verifyLicenseKey`は`try/catch`で`'unsupported'`ステータスに落とす（クラッシュさせない）。
- **`deviceId` は新規に作らない**。束1で作った `lib/sync/device-id.ts` の `getDeviceId(db)` を再利用する（そのJSDocに「K3の発動台数カウントに使う」と明記済み＝設計時から想定済みの再利用）。
- **フェイルオープンの境界を厳密に守る**: Worker/ネットワーク障害時（fetch失敗・タイムアウト・不正なレスポンス・`{ok:false,reason:'unknown-key'}`）は署名検証済みのキーを信頼してローカルで解錠する。**明示的な `{ok:false,reason:'cap-exceeded'}` だけは本物の拒否**（フェイルオープンしない）。この境界をあいまいにしない。
- **KVに保存するのは `issued:<kid>`・`act:<kid>`・`claim:<secret>` の3種のみ**。ブクマ・URL・個人情報は一切書かない（設計不変条件）。TTLは付けない（ライセンスは恒久・v1に解約無効化は無い）。
- **`/claim`のIPレート制限はコードで作らない**（`docs/private/2026-07-01-k3-unlock-design.md` §4.1 濫用対策(b)）。既存の運用方針（N-62コスト監査バッチ2＝WAFレート制限はユーザーのCloudflareダッシュボード操作）を踏襲し、コード側は `maxIssue`（claimSecretごとの発券総数キャップ）と5台の発動キャップだけを実装する。
- **秘密鍵は絶対にチャット/commitに出さない**: `scripts/generate-k3-keypair.mjs` は開発者が自分のターミナルで実行し、`K3_PRIVATE_KEY`（Worker Secret）はその場で `wrangler pages secret put` に直接貼る。**この計画のどのタスクも秘密鍵の実値を生成・表示・commitしない**。公開鍵（非秘密）は `.env.production` の `NEXT_PUBLIC_K3_PUBLIC_KEY=`（空のまま・束2の `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=` と同じ空default パターン）に、鍵生成後に開発者自身が値を貼る。
- **束2の申し送り「`vi.mock('@/lib/constants')` のテスト工作は避ける」を踏襲**: `verifyLicenseKey(keyString, publicKeyB64url = K3_PUBLIC_KEY)` のようにデフォルト引数で公開鍵を注入可能にし、テストは実際に生成したテスト用鍵ペアを渡す（`@/lib/constants` を一切mockしない）。
- **この束も呼び出し元ゼロ**（`components/`・`app/` のどこからも import されない）。SETTINGSのキー入力UIは束6。
- 各タスクの最後に `npx tsc --noEmit` が0件・そのタスクのテストファイルがgreenであることを確認してからcommitする。フル回帰（`npx vitest run`）は最終タスク完了後にまとめて実行する。
- コマンド先頭に `rtk` を付ける（CLAUDE.md既定）。`--no-verify` は禁止。vitestは素の `npx vitest`（`rtk npx` は既知の不具合・使わない）。
- **`/claim` ページの英語コピーはドラフト**。Task 4 に実装するが、ユーザーの確認（実装前に実際の文面を見せる、というCLAUDE.md既定ルール）はこの計画書の提示時点で行う。ユーザーからの訂正が無ければそのまま実装してよい。

---

## File Structure

| ファイル | 責務 | 作成/変更 |
|---|---|---|
| `lib/board/license-types.ts` | ライセンスキーのワイヤーフォーマット（zodスキーマ・base64url・`payload.signature`のエンコード/デコード）。crypto呼び出しは無い純粋関数のみ。 | 新規（Task 1） |
| `scripts/generate-k3-keypair.mjs` | Ed25519鍵ペア生成の一回限りCLIスクリプト（開発者が手元で実行）。 | 新規（Task 1） |
| `lib/board/license-crypto.ts` | クライアント側のオフラインEd25519署名検証（`verifyLicenseKey`）。 | 新規（Task 2） |
| `lib/constants.ts` | `K3_PUBLIC_KEY` 定数を追加（`NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`と同じ空defaultパターン）。 | 変更（Task 2） |
| `.env.production` | `NEXT_PUBLIC_K3_PUBLIC_KEY=`（空）を追加。 | 変更（Task 2） |
| `lib/board/license-store.ts` | IndexedDB `settings` ストアへのライセンス状態の読み書き（`saveLicense`/`loadLicense`/`clearLicense`）。既存の `board-config.ts`/`sync-store.ts` と同じパターン＝**DBバージョンアップ不要**。 | 新規（Task 3） |
| `lib/board/theme-entitlement.ts` | `isThemeUnlocked` の隣に `isSyncUnlocked` を追加（設計§10の指定場所）。 | 変更（Task 3） |
| `functions/claim.ts` | `GET /claim?c=<secret>` — 発券。キー署名・KV書き込み・HTML表示。 | 新規（Task 4） |
| `wrangler.toml` | `K3_KV` バインディングを追加（IDは開発者が`wrangler kv namespace create`で作成）。 | 変更（Task 4） |
| `.dev.vars.example` | `K3_PRIVATE_KEY=`（空）を追加。 | 変更（Task 4） |
| `functions/activate.ts` | `POST /activate {kid,deviceId}` — 発動台数カウント（5台キャップ・冪等）。 | 新規（Task 5） |
| `lib/board/license-activate.ts` | クライアント側オーケストレーション（`activateLicenseKey`）＝検証→`/activate`呼び出し→フェイルオープン判定→永続化。束6のUIが呼ぶ入口。 | 新規（Task 6） |

---

### Task 1: `license-types.ts` — ワイヤーフォーマット（純粋関数）＋鍵生成スクリプト

**Files:**
- Create: `lib/board/license-types.ts`
- Create: `lib/board/license-types.test.ts`
- Create: `scripts/generate-k3-keypair.mjs`

**Interfaces:**
- Consumes: `zod`（外部パッケージ）のみ。
- Produces: `LicensePayload` 型・`parseLicensePayload(input): ParseResult<LicensePayload>`・`bytesToBase64Url(bytes): string`・`base64UrlToBytes(b64url): Uint8Array`・`payloadSigningBytes(payloadB64url): Uint8Array`・`encodeLicensePayload(payload): string`・`encodeLicenseKey(payloadB64url, signature): string`・`decodeLicenseKey(keyString): DecodedLicenseKey | null`。Task 2（クライアント検証）・Task 4（Worker署名）が使う。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/board/license-types.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseLicensePayload, bytesToBase64Url, base64UrlToBytes, payloadSigningBytes,
  encodeLicensePayload, encodeLicenseKey, decodeLicenseKey, type LicensePayload,
} from './license-types'

describe('parseLicensePayload', () => {
  it('accepts a well-formed v1 payload', () => {
    const r = parseLicensePayload({ kid: 'abc', scope: ['sync'], v: 1, iat: 1_780_000_000_000 })
    expect(r.ok).toBe(true)
  })
  it('rejects a wrong version', () => {
    const r = parseLicensePayload({ kid: 'abc', scope: ['sync'], v: 2, iat: 1 })
    expect(r.ok).toBe(false)
  })
  it('rejects an empty scope array', () => {
    const r = parseLicensePayload({ kid: 'abc', scope: [], v: 1, iat: 1 })
    expect(r.ok).toBe(false)
  })
  it('rejects a non-object', () => {
    expect(parseLicensePayload('not-an-object').ok).toBe(false)
  })
})

describe('base64url round-trip', () => {
  it('bytesToBase64Url / base64UrlToBytes round-trips arbitrary bytes, no padding chars', () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 16, 32, 64, 128])
    const encoded = bytesToBase64Url(bytes)
    expect(encoded).not.toMatch(/[+/=]/)
    expect(base64UrlToBytes(encoded)).toEqual(bytes)
  })
})

describe('encodeLicensePayload / decodeLicenseKey', () => {
  const payload: LicensePayload = { kid: 'kid-1', scope: ['sync'], v: 1, iat: 1_780_000_000_000 }

  it('decodeLicenseKey round-trips a well-formed key string', () => {
    const payloadB64url = encodeLicensePayload(payload)
    const fakeSignature = new Uint8Array(64).fill(7) // decodeLicenseKey doesn't verify — any 64 bytes
    const keyString = encodeLicenseKey(payloadB64url, fakeSignature)
    const decoded = decodeLicenseKey(keyString)
    expect(decoded).not.toBeNull()
    expect(decoded?.payload).toEqual(payload)
    expect(decoded?.payloadB64url).toBe(payloadB64url)
    expect(decoded?.signature).toEqual(fakeSignature)
  })

  it('payloadSigningBytes is the UTF-8 bytes of the payload segment (what gets signed)', () => {
    const payloadB64url = encodeLicensePayload(payload)
    const decoded = decodeLicenseKey(encodeLicenseKey(payloadB64url, new Uint8Array(64)))
    expect(payloadSigningBytes(decoded!.payloadB64url)).toEqual(new TextEncoder().encode(payloadB64url))
  })

  it('returns null for a key string with the wrong number of parts', () => {
    expect(decodeLicenseKey('only-one-part')).toBeNull()
    expect(decodeLicenseKey('a.b.c')).toBeNull()
  })

  it('returns null for malformed base64url in the payload segment', () => {
    expect(decodeLicenseKey('not-valid-base64!!!.' + bytesToBase64Url(new Uint8Array(64)))).toBeNull()
  })

  it('returns null when the decoded payload fails schema validation', () => {
    const badPayload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ kid: 'x' }))) // missing scope/v/iat
    expect(decodeLicenseKey(badPayload + '.' + bytesToBase64Url(new Uint8Array(64)))).toBeNull()
  })

  it('returns null when the signature segment is not exactly 64 bytes', () => {
    const payloadB64url = encodeLicensePayload(payload)
    expect(decodeLicenseKey(payloadB64url + '.' + bytesToBase64Url(new Uint8Array(63)))).toBeNull()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/board/license-types.test.ts`
Expected: FAIL（`./license-types` が存在しない）

- [ ] **Step 3: 実装**

```ts
// lib/board/license-types.ts
// K3ライセンスキーのワイヤーフォーマット。crypto呼び出しは無い純粋関数のみ
// （署名/検証はTask2のlicense-crypto.tsとfunctions/claim.tsがそれぞれ行う）。
// 設計: docs/private/2026-07-01-k3-unlock-design.md §3 ／
// docs/private/2026-09-02-device-sync-design.md §10（scope配列化はこの束での変更）。
import { z } from 'zod'

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

function issues(e: z.ZodError): string {
  return e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
}

/** 署名対象のペイロード。`scope` は将来の拡張（'all-paid' 等）を見越した配列。
 *  v1が発券するのは常に `['sync']` のみ（テーマ解錠は別束・別スコープ値）。 */
export const licensePayloadSchema = z.object({
  kid: z.string().min(1).max(64),
  scope: z.array(z.string().min(1).max(32)).min(1).max(8),
  v: z.literal(1),
  iat: z.number().int().positive(),
})
export type LicensePayload = z.infer<typeof licensePayloadSchema>

export function parseLicensePayload(input: unknown): ParseResult<LicensePayload> {
  const r = licensePayloadSchema.safeParse(input)
  return r.success ? { ok: true, value: r.data } : { ok: false, error: issues(r.error) }
}

// ── base64url（パディング無し）。Worker(workerd)・ブラウザどちらも atob/btoa を持つ ──

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 実際にEd25519署名するバイト列＝base64urlペイロード文字列そのもののUTF-8バイト。
 *  JSONを再シリアライズしたものではなく「符号化済み文字列」自体を署名するので、
 *  署名側/検証側でJSONキー順等の正規化を気にする必要が無い。 */
export function payloadSigningBytes(payloadB64url: string): Uint8Array {
  return new TextEncoder().encode(payloadB64url)
}

export function encodeLicensePayload(payload: LicensePayload): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
}

/** `<base64url(payload JSON)>.<base64url(Ed25519 signature, 64 bytes)>`。
 *  v1のペイロードは小さいので全体で200文字前後＝テキスト欄に貼れる長さ。 */
export function encodeLicenseKey(payloadB64url: string, signature: Uint8Array): string {
  return `${payloadB64url}.${bytesToBase64Url(signature)}`
}

export interface DecodedLicenseKey {
  readonly payloadB64url: string
  readonly payload: LicensePayload
  readonly signature: Uint8Array
}

/** ワイヤーフォーマット＋JSONスキーマだけを検証する（署名検証はしない＝crypto不使用。
 *  署名検証はlicense-crypto.tsのverifyLicenseKeyの仕事）。壊れた入力は全て null。 */
export function decodeLicenseKey(keyString: string): DecodedLicenseKey | null {
  const parts = keyString.trim().split('.')
  if (parts.length !== 2) return null
  const [payloadB64url, sigB64url] = parts
  if (!payloadB64url || !sigB64url) return null

  let payloadJson: unknown
  try {
    payloadJson = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64url)))
  } catch {
    return null
  }
  const parsed = parseLicensePayload(payloadJson)
  if (!parsed.ok) return null

  let signature: Uint8Array
  try {
    signature = base64UrlToBytes(sigB64url)
  } catch {
    return null
  }
  if (signature.byteLength !== 64) return null // Ed25519の署名は常に64バイト

  return { payloadB64url, payload: parsed.value, signature }
}
```

```js
// scripts/generate-k3-keypair.mjs
// K3のEd25519鍵ペアを生成する一回限りのCLIスクリプト（鍵ローテーション時も使う）。
// 実行: node scripts/generate-k3-keypair.mjs
//
// 出力される2つの値の扱い:
//   K3_PUBLIC_KEY  → 秘密ではない。.env.production の NEXT_PUBLIC_K3_PUBLIC_KEY= に貼る。
//   K3_PRIVATE_KEY → 絶対にcommitしない。`wrangler pages secret put K3_PRIVATE_KEY`
//                    を実行してその場で貼る（chatにも貼らない）。
//
// base64urlエンコードは lib/board/license-types.ts の bytesToBase64Url と
// 同じ変換（依存を避けるためここでは Buffer で再実装）。
function bytesToBase64Url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
const rawPublic = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
const pkcs8Private = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey))

console.log('K3_PUBLIC_KEY (not secret — paste into .env.production NEXT_PUBLIC_K3_PUBLIC_KEY=):')
console.log(bytesToBase64Url(rawPublic))
console.log('')
console.log('K3_PRIVATE_KEY (SECRET — do not commit, do not paste in chat):')
console.log('  wrangler pages secret put K3_PRIVATE_KEY --project-name=allmarks')
console.log('  (paste the value below when prompted)')
console.log(bytesToBase64Url(pkcs8Private))
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/board/license-types.test.ts`
Expected: PASS（全9ケース）

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit`
Expected: 0件

- [ ] **Step 6: commit**

```bash
git add lib/board/license-types.ts lib/board/license-types.test.ts scripts/generate-k3-keypair.mjs
git commit -m "feat(k3): add license key wire format (base64url payload.signature codec)"
```

---

### Task 2: `license-crypto.ts` — クライアント側オフライン署名検証

**Files:**
- Create: `lib/board/license-crypto.ts`
- Create: `lib/board/license-crypto.test.ts`
- Modify: `lib/constants.ts`
- Modify: `.env.production`

**Interfaces:**
- Consumes: Task1の `decodeLicenseKey`/`payloadSigningBytes`/`base64UrlToBytes`/`LicensePayload`。
- Produces: `verifyLicenseKey(keyString, publicKeyB64url?): Promise<VerifyLicenseKeyResult>`・`VerifyLicenseKeyResult` 型。Task6が使う。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/board/license-crypto.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { verifyLicenseKey } from './license-crypto'
import { encodeLicensePayload, encodeLicenseKey, bytesToBase64Url, type LicensePayload } from './license-types'

async function generateTestKeyPair() {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const publicKeyB64url = bytesToBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey)))
  return { keyPair, publicKeyB64url }
}

async function signKey(payload: LicensePayload, privateKey: CryptoKey): Promise<string> {
  const payloadB64url = encodeLicensePayload(payload)
  const signature = new Uint8Array(
    await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(payloadB64url)),
  )
  return encodeLicenseKey(payloadB64url, signature)
}

afterEach(() => { vi.restoreAllMocks() })

describe('verifyLicenseKey', () => {
  const payload: LicensePayload = { kid: 'kid-1', scope: ['sync'], v: 1, iat: 1_780_000_000_000 }

  it('valid: a correctly-signed key verifies against its own public key', async () => {
    const { keyPair, publicKeyB64url } = await generateTestKeyPair()
    const keyString = await signKey(payload, keyPair.privateKey)
    const result = await verifyLicenseKey(keyString, publicKeyB64url)
    expect(result).toEqual({ status: 'valid', payload })
  })

  it('invalid: a key signed by a DIFFERENT keypair fails verification', async () => {
    const signer = await generateTestKeyPair()
    const verifier = await generateTestKeyPair() // different keypair's public key
    const keyString = await signKey(payload, signer.keyPair.privateKey)
    const result = await verifyLicenseKey(keyString, verifier.publicKeyB64url)
    expect(result).toEqual({ status: 'invalid' })
  })

  it('invalid: a tampered payload (scope changed after signing) fails verification', async () => {
    const { keyPair, publicKeyB64url } = await generateTestKeyPair()
    const keyString = await signKey(payload, keyPair.privateKey)
    const [, sigPart] = keyString.split('.')
    const tamperedPayloadB64url = encodeLicensePayload({ ...payload, scope: ['sync', 'all-paid'] })
    const result = await verifyLicenseKey(`${tamperedPayloadB64url}.${sigPart}`, publicKeyB64url)
    expect(result).toEqual({ status: 'invalid' })
  })

  it('invalid: malformed key string (wrong format) never throws', async () => {
    const { publicKeyB64url } = await generateTestKeyPair()
    const result = await verifyLicenseKey('not-a-valid-key', publicKeyB64url)
    expect(result).toEqual({ status: 'invalid' })
  })

  it('unsupported: importKey rejecting (e.g. browser without Ed25519) is caught, never throws', async () => {
    const { keyPair, publicKeyB64url } = await generateTestKeyPair()
    const keyString = await signKey(payload, keyPair.privateKey)
    vi.spyOn(crypto.subtle, 'importKey').mockRejectedValueOnce(new Error('Ed25519 not supported'))
    const result = await verifyLicenseKey(keyString, publicKeyB64url)
    expect(result).toEqual({ status: 'unsupported' })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/board/license-crypto.test.ts`
Expected: FAIL（`./license-crypto` が存在しない）

- [ ] **Step 3: `lib/constants.ts` に定数を追加**

`GOOGLE_OAUTH_CLIENT_ID`（`lib/constants.ts:17`付近）の直後に追加:

```ts
/** K3ライセンスキーのEd25519公開鍵（base64url, raw 32バイト）。秘密ではない
 *  （クライアントに同梱して安全）。鍵ペア未生成の間は空文字＝
 *  scripts/generate-k3-keypair.mjs 実行後に .env.production へ値を貼る
 *  （NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID と同じ「空default」パターン）。 */
export const K3_PUBLIC_KEY = process.env.NEXT_PUBLIC_K3_PUBLIC_KEY ?? ''
```

`.env.production` に1行追加（`NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=...`の下）:

```
NEXT_PUBLIC_K3_PUBLIC_KEY=
```

- [ ] **Step 4: `license-crypto.ts` を実装**

```ts
// lib/board/license-crypto.ts
// K3ライセンスキーのオフライン署名検証。ネットワークに一切触れない。
// 設計: docs/private/2026-07-01-k3-unlock-design.md §3。
import { decodeLicenseKey, payloadSigningBytes, base64UrlToBytes, type LicensePayload } from './license-types'
import { K3_PUBLIC_KEY } from '@/lib/constants'

export type VerifyLicenseKeyResult =
  | { readonly status: 'valid'; readonly payload: LicensePayload }
  | { readonly status: 'invalid' }
  | { readonly status: 'unsupported' }

/**
 * Ed25519署名をオフライン検証する。`publicKeyB64url` は既定で本物の公開鍵
 * （lib/constants.ts）を使うが、引数で差し替え可能（束2の申し送り＝
 * `vi.mock('@/lib/constants')` を避けるためのテスト用の注入経路）。
 * 'unsupported' = このブラウザのWeb CryptoにEd25519が無い（2025年より前の
 * エンジン）、または公開鍵が未設定（鍵ペア生成前の空文字）のいずれか。
 * 例外は投げない。
 */
export async function verifyLicenseKey(
  keyString: string,
  publicKeyB64url: string = K3_PUBLIC_KEY,
): Promise<VerifyLicenseKeyResult> {
  const decoded = decodeLicenseKey(keyString)
  if (!decoded) return { status: 'invalid' }

  let publicKey: CryptoKey
  try {
    publicKey = await crypto.subtle.importKey('raw', base64UrlToBytes(publicKeyB64url), { name: 'Ed25519' }, true, ['verify'])
  } catch {
    return { status: 'unsupported' }
  }

  let verified: boolean
  try {
    verified = await crypto.subtle.verify('Ed25519', publicKey, decoded.signature, payloadSigningBytes(decoded.payloadB64url))
  } catch {
    return { status: 'unsupported' }
  }
  return verified ? { status: 'valid', payload: decoded.payload } : { status: 'invalid' }
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run lib/board/license-crypto.test.ts`
Expected: PASS（全5ケース）

- [ ] **Step 6: 型チェック**

Run: `npx tsc --noEmit`
Expected: 0件

- [ ] **Step 7: commit**

```bash
git add lib/board/license-crypto.ts lib/board/license-crypto.test.ts lib/constants.ts .env.production
git commit -m "feat(k3): add offline Ed25519 license key verification"
```

---

### Task 3: `license-store.ts` ＋ `isSyncUnlocked`

**Files:**
- Create: `lib/board/license-store.ts`
- Create: `lib/board/license-store.test.ts`
- Modify: `lib/board/theme-entitlement.ts`
- Modify: `lib/board/theme-entitlement.test.ts`

**Interfaces:**
- Consumes: `idb`（`IDBPDatabase`）のみ。
- Produces: `LicenseState` 型・`saveLicense(db, state): Promise<void>`・`loadLicense(db): Promise<LicenseState | null>`・`clearLicense(db): Promise<void>`・`isSyncUnlocked(state): boolean`。Task6が使う。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/board/license-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { saveLicense, loadLicense, clearLicense, type LicenseState } from './license-store'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) { if (info.name) indexedDB.deleteDatabase(info.name) }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('license-store', () => {
  it('returns null when nothing saved', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await loadLicense(d)).toBeNull()
  })

  it('round-trips a saved license', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const state: LicenseState = { kid: 'kid-1', deviceId: 'device-1', scope: ['sync'], validatedAt: 1_780_000_000_000 }
    await saveLicense(d, state)
    expect(await loadLicense(d)).toEqual(state)
  })

  it('a later save overwrites the previous license (not merged)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveLicense(d, { kid: 'kid-1', deviceId: 'device-1', scope: ['sync'], validatedAt: 1 })
    await saveLicense(d, { kid: 'kid-2', deviceId: 'device-1', scope: ['sync'], validatedAt: 2 })
    const loaded = await loadLicense(d)
    expect(loaded?.kid).toBe('kid-2')
  })

  it('clearLicense removes the stored license', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveLicense(d, { kid: 'kid-1', deviceId: 'device-1', scope: ['sync'], validatedAt: 1 })
    await clearLicense(d)
    expect(await loadLicense(d)).toBeNull()
  })
})
```

追記（既存ファイルに追加）:

```ts
// lib/board/theme-entitlement.test.ts に追記
import { isSyncUnlocked } from './theme-entitlement'
import type { LicenseState } from './license-store'

describe('isSyncUnlocked', () => {
  it('locked when no license has ever been activated', () => {
    expect(isSyncUnlocked(null)).toBe(false)
  })
  it('locked when the license scope does not include sync', () => {
    const state: LicenseState = { kid: 'k', deviceId: 'd', scope: ['all-paid'], validatedAt: 1 }
    expect(isSyncUnlocked(state)).toBe(false)
  })
  it('unlocked when the license scope includes sync', () => {
    const state: LicenseState = { kid: 'k', deviceId: 'd', scope: ['sync'], validatedAt: 1 }
    expect(isSyncUnlocked(state)).toBe(true)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/board/license-store.test.ts lib/board/theme-entitlement.test.ts`
Expected: FAIL（`./license-store` が存在しない／`isSyncUnlocked` が未export）

- [ ] **Step 3: `license-store.ts` を実装**

```ts
// lib/board/license-store.ts
// K3ライセンス状態のIndexedDB永続化。既存のsync-store.ts/board-config.tsと
// 同じパターン＝settingsストアの新規キーを使うだけ（DBバージョンアップ不要）。
import type { IDBPDatabase } from 'idb'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const LICENSE_KEY = 'license'

export interface LicenseState {
  readonly kid: string
  readonly deviceId: string
  readonly scope: readonly string[]
  readonly validatedAt: number
}

interface LicenseRecord extends LicenseState {
  readonly key: typeof LICENSE_KEY
}

export async function saveLicense(db: DbLike, state: LicenseState): Promise<void> {
  const record: LicenseRecord = { key: LICENSE_KEY, ...state }
  await db.put('settings', record)
}

export async function loadLicense(db: DbLike): Promise<LicenseState | null> {
  const record = (await db.get('settings', LICENSE_KEY)) as LicenseRecord | undefined
  if (!record) return null
  const { key: _key, ...state } = record
  return state
}

export async function clearLicense(db: DbLike): Promise<void> {
  await db.delete('settings', LICENSE_KEY)
}
```

- [ ] **Step 4: `theme-entitlement.ts` に `isSyncUnlocked` を追加**

```ts
// lib/board/theme-entitlement.ts に追記（末尾）
import type { LicenseState } from './license-store'

/** 同期機能が解錠されているか。isThemeUnlockedと同じ土台に置く（設計
 *  device-sync-design.md §10）＝既にロードした状態を受け取るだけの純関数、
 *  自分ではIOしない。`state` はこの端末で一度もキーを発動していなければ null。 */
export function isSyncUnlocked(state: LicenseState | null): boolean {
  return state !== null && state.scope.includes('sync')
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run lib/board/license-store.test.ts lib/board/theme-entitlement.test.ts`
Expected: PASS（license-store 4ケース＋isSyncUnlocked 3ケース＋既存3ケース）

- [ ] **Step 6: 型チェック**

Run: `npx tsc --noEmit`
Expected: 0件

- [ ] **Step 7: commit**

```bash
git add lib/board/license-store.ts lib/board/license-store.test.ts lib/board/theme-entitlement.ts lib/board/theme-entitlement.test.ts
git commit -m "feat(k3): add license IndexedDB store and isSyncUnlocked gate"
```

---

### Task 4: `functions/claim.ts` — 発券エンドポイント

**Files:**
- Create: `functions/claim.ts`
- Create: `functions/claim.test.ts`
- Modify: `wrangler.toml`
- Modify: `.dev.vars.example`

**Interfaces:**
- Consumes: Task1の `encodeLicensePayload`/`encodeLicenseKey`/`base64UrlToBytes`/`payloadSigningBytes`/`LicensePayload`。
- Produces: `GET /claim?c=<secret>` エンドポイント（`onRequestGet`をexport、テスト用）。KVスキーマ: `claim:<secret>` → `{label,issuedCount,maxIssue,active}`（開発者が手動で seed する）、`issued:<kid>` → `{claimSecret,iat}`（このタスクが書く。Task5が読む）。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// functions/claim.test.ts
import { describe, it, expect, vi } from 'vitest'
import { onRequestGet } from './claim'

async function makeTestKeys() {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey))
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
  const toB64url = (b: Uint8Array) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return { publicKeyB64url: toB64url(raw), privateKeyB64url: toB64url(pkcs8) }
}

function makeCtx(url: string, kvStore: Map<string, string>, privateKeyB64url: string) {
  const K3_KV = {
    get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => { kvStore.set(k, v) }),
  }
  const ctx = { request: new Request(url), env: { K3_KV, K3_PRIVATE_KEY: privateKeyB64url } } // gitleaks:allow (locally-generated ephemeral test keypair, not a real secret)
  return { ctx, K3_KV }
}

describe('GET /claim', () => {
  it('mints a key, writes issued: and bumps claim: issuedCount, returns 200 HTML containing the key', async () => {
    const { publicKeyB64url, privateKeyB64url } = await makeTestKeys()
    const kvStore = new Map<string, string>()
    kvStore.set('claim:secret1', JSON.stringify({ label: 'launch', issuedCount: 0, maxIssue: 10, active: true }))
    const { ctx, K3_KV } = makeCtx('https://allmarks.app/claim?c=secret1', kvStore, privateKeyB64url)

    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(200)
    const html = await res.text()

    // 発行されたキーを本文から抽出して署名検証する（デコードして検証まで通すのが
    // 「本当に正しい鍵で署名されたか」の唯一の確実な検証）
    const match = html.match(/[\w-]+\.[\w-]+/)
    expect(match).not.toBeNull()
    const keyString = match![0]
    const [payloadB64url, sigB64url] = keyString.split('.')
    const toBytes = (b64url: string) => {
      const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
      return new Uint8Array(Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64'))
    }
    const pub = await crypto.subtle.importKey('raw', toBytes(publicKeyB64url), { name: 'Ed25519' }, true, ['verify'])
    const ok = await crypto.subtle.verify('Ed25519', pub, toBytes(sigB64url), new TextEncoder().encode(payloadB64url))
    expect(ok).toBe(true)
    const payload = JSON.parse(new TextDecoder().decode(toBytes(payloadB64url)))
    expect(payload.scope).toEqual(['sync'])
    expect(payload.v).toBe(1)

    expect(K3_KV.put).toHaveBeenCalledWith(`issued:${payload.kid}`, expect.any(String))
    const updatedClaim = JSON.parse(kvStore.get('claim:secret1')!)
    expect(updatedClaim.issuedCount).toBe(1)
  })

  it('returns an error page (200 HTML, no key) for an unknown claimSecret', async () => {
    const { privateKeyB64url } = await makeTestKeys()
    const { ctx } = makeCtx('https://allmarks.app/claim?c=doesnotexist', new Map(), privateKeyB64url)
    const res = await onRequestGet(ctx as never)
    const html = await res.text()
    expect(html).not.toMatch(/[\w-]{20,}\.[\w-]{20,}/) // no key-shaped string in the body
  })

  it('returns an error page when the claim record is inactive', async () => {
    const { privateKeyB64url } = await makeTestKeys()
    const kvStore = new Map<string, string>([['claim:secret1', JSON.stringify({ label: 'x', issuedCount: 0, maxIssue: 10, active: false })]])
    const { ctx } = makeCtx('https://allmarks.app/claim?c=secret1', kvStore, privateKeyB64url)
    const res = await onRequestGet(ctx as never)
    const html = await res.text()
    expect(html).not.toMatch(/[\w-]{20,}\.[\w-]{20,}/)
  })

  it('returns an error page when issuedCount has reached maxIssue', async () => {
    const { privateKeyB64url } = await makeTestKeys()
    const kvStore = new Map<string, string>([['claim:secret1', JSON.stringify({ label: 'x', issuedCount: 10, maxIssue: 10, active: true })]])
    const { ctx } = makeCtx('https://allmarks.app/claim?c=secret1', kvStore, privateKeyB64url)
    const res = await onRequestGet(ctx as never)
    const html = await res.text()
    expect(html).not.toMatch(/[\w-]{20,}\.[\w-]{20,}/)
  })

  it('returns an error page when the c param is missing', async () => {
    const { privateKeyB64url } = await makeTestKeys()
    const { ctx } = makeCtx('https://allmarks.app/claim', new Map(), privateKeyB64url)
    const res = await onRequestGet(ctx as never)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).not.toMatch(/[\w-]{20,}\.[\w-]{20,}/)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run functions/claim.test.ts`
Expected: FAIL（`./claim` が存在しない）

- [ ] **Step 3: `wrangler.toml` に `K3_KV` バインディングを追加**

既存の `[[kv_namespaces]]`（`SHARE_KV`）ブロックの下に追加（IDは開発者が手動で作成——Step8の後にある「運用メモ」参照）:

```toml
# K3（最小・応援者限定の解錠ゲート）: 発券記録・発動台数のみを持つ。ブクマ/
# 個人情報は一切書かない（docs/private/2026-07-01-k3-unlock-design.md §4.3）。
# 作成: `wrangler kv namespace create K3_KV` / `wrangler kv namespace create K3_KV --preview`
# → 出力されたIDを下記に貼る → commit → deploy。
[[kv_namespaces]]
binding = "K3_KV"
id = "REPLACE_WITH_WRANGLER_OUTPUT_ID"
preview_id = "REPLACE_WITH_WRANGLER_OUTPUT_PREVIEW_ID"
```

- [ ] **Step 4: `.dev.vars.example` に1行追加**

```
K3_PRIVATE_KEY=
```

- [ ] **Step 5: `functions/claim.ts` を実装**

```ts
// functions/claim.ts
// GET /claim?c=<claimSecret> — 会員限定リンクを踏んだ支援者にK3ライセンス
// キーを発券して画面表示する。署名するのはここだけ（秘密鍵はWorker Secret）。
// 設計: docs/private/2026-07-01-k3-unlock-design.md §4.1。
import {
  encodeLicensePayload, encodeLicenseKey, base64UrlToBytes, payloadSigningBytes, type LicensePayload,
} from '../lib/board/license-types'

interface KVNamespace {
  get(key: string, options?: { type?: 'text' }): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

interface Env {
  K3_KV: KVNamespace
  /** base64url pkcs8 Ed25519 private key。scripts/generate-k3-keypair.mjs で生成
   *  して `wrangler pages secret put K3_PRIVATE_KEY` で設定する（未設定なら空）。 */
  K3_PRIVATE_KEY: string
}

interface PagesContext {
  request: Request
  env: Env
}

interface ClaimRecord {
  label: string
  issuedCount: number
  maxIssue: number
  active: boolean
}

const MAX_SECRET_LEN = 128
const K3_SCOPE: readonly string[] = ['sync']

function htmlPage(body: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AllMarks — Sync Key</title>
<style>
body{background:#0a0a0a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:48px 24px;line-height:1.6}
h1{font-size:20px;font-weight:600;margin:0 0 8px}
code{display:block;word-break:break-all;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;font-family:ui-monospace,monospace;font-size:13px;margin:16px 0}
button{background:#fff;color:#0a0a0a;border:none;border-radius:6px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer}
p{color:#999;font-size:14px}
</style></head><body>${body}</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )
}

function errorPage(message: string): Response {
  return htmlPage(`<h1>Link not available</h1><p>${message}</p>`)
}

async function signPayload(payload: LicensePayload, privateKeyB64url: string): Promise<string> {
  const privateKey = await crypto.subtle.importKey('pkcs8', base64UrlToBytes(privateKeyB64url), { name: 'Ed25519' }, false, ['sign'])
  const payloadB64url = encodeLicensePayload(payload)
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', privateKey, payloadSigningBytes(payloadB64url)))
  return encodeLicenseKey(payloadB64url, signature)
}

export async function onRequestGet(ctx: PagesContext): Promise<Response> {
  const url = new URL(ctx.request.url)
  const secret = url.searchParams.get('c')
  if (!secret || secret.length === 0 || secret.length > MAX_SECRET_LEN) {
    return errorPage('This link is missing or malformed.')
  }

  const raw = await ctx.env.K3_KV.get(`claim:${secret}`)
  if (!raw) return errorPage('This link is invalid or has expired.')

  let record: ClaimRecord
  try {
    record = JSON.parse(raw) as ClaimRecord
  } catch {
    return errorPage('This link is invalid or has expired.')
  }

  if (!record.active) return errorPage('This link is no longer active.')
  if (record.issuedCount >= record.maxIssue) return errorPage('This link has reached its limit. Please contact the developer for a new one.')
  if (!ctx.env.K3_PRIVATE_KEY) return errorPage('Key signing is not configured yet. Please try again later.')

  const kid = crypto.randomUUID()
  const payload: LicensePayload = { kid, scope: [...K3_SCOPE], v: 1, iat: Date.now() }

  let key: string
  try {
    key = await signPayload(payload, ctx.env.K3_PRIVATE_KEY)
  } catch {
    return errorPage('Key signing failed. Please try again later.')
  }

  await ctx.env.K3_KV.put(`issued:${kid}`, JSON.stringify({ claimSecret: secret, iat: payload.iat }))
  await ctx.env.K3_KV.put(`claim:${secret}`, JSON.stringify({ ...record, issuedCount: record.issuedCount + 1 }))

  return htmlPage(`
<h1>Your AllMarks sync key</h1>
<p>Paste this into AllMarks — SETTINGS — Enter your key.</p>
<code id="key">${key}</code>
<button onclick="navigator.clipboard.writeText(document.getElementById('key').textContent)">Copy key</button>
<p>This key works on up to 5 devices. Save it somewhere — this page won't show it again.</p>
`)
}
```

- [ ] **Step 6: テストが通ることを確認**

Run: `npx vitest run functions/claim.test.ts`
Expected: PASS（全5ケース）

- [ ] **Step 7: 型チェック**

Run: `npx tsc --noEmit`
Expected: 0件

- [ ] **Step 8: commit**

```bash
git add functions/claim.ts functions/claim.test.ts wrangler.toml .dev.vars.example
git commit -m "feat(k3): add /claim issuance endpoint"
```

> **運用メモ（commitしない・ユーザーが後で手動実行）**: `wrangler kv namespace create K3_KV`＋`--preview`実行→IDをwrangler.tomlに反映→`node scripts/generate-k3-keypair.mjs`実行→公開鍵を`.env.production`へ・秘密鍵を`wrangler pages secret put K3_PRIVATE_KEY`へ→claimレコードを1件seed:
> `wrangler kv key put --binding=K3_KV "claim:<好きな合言葉>" '{"label":"launch","issuedCount":0,"maxIssue":50,"active":true}'`

---

### Task 5: `functions/activate.ts` — 発動エンドポイント

**Files:**
- Create: `functions/activate.ts`
- Create: `functions/activate.test.ts`

**Interfaces:**
- Consumes: `zod`のみ（型はこのファイル内で定義。Task1/4への依存なし）。
- Produces: `POST /activate` エンドポイント。契約: リクエスト `{kid:string, deviceId:string}` → レスポンス常に200 `{ok:true}` / `{ok:false, reason:'cap-exceeded'}` / `{ok:false, reason:'unknown-key'}` / `{ok:false, reason:'invalid'}`（400/413はバリデーション失敗のみ）。Task6のクライアントがこの契約に依存する。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// functions/activate.test.ts
import { describe, it, expect, vi } from 'vitest'
import { onRequestPost } from './activate'

function makeCtx(body: unknown, kvStore: Map<string, string>) {
  const json = JSON.stringify(body)
  const K3_KV = {
    get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => { kvStore.set(k, v) }),
  }
  const ctx = {
    request: new Request('https://allmarks.app/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': String(json.length) },
      body: json,
    }),
    env: { K3_KV },
  }
  return { ctx, K3_KV, kvStore }
}

describe('POST /activate', () => {
  it('first activation for a device: adds it and returns ok:true', async () => {
    const kvStore = new Map<string, string>([['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })]])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'device-a' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(JSON.parse(store.get('act:kid-1')!)).toEqual(['device-a'])
  })

  it('idempotent: re-activating the same device does not grow the set or reject', async () => {
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      ['act:kid-1', JSON.stringify(['device-a', 'device-b'])],
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'device-a' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    expect(JSON.parse(store.get('act:kid-1')!)).toEqual(['device-a', 'device-b'])
  })

  it('boundary: the 5th distinct device succeeds', async () => {
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      ['act:kid-1', JSON.stringify(['d1', 'd2', 'd3', 'd4'])],
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'd5' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: true })
    expect(JSON.parse(store.get('act:kid-1')!)).toHaveLength(5)
  })

  it('boundary: the 6th distinct device is rejected with cap-exceeded', async () => {
    const kvStore = new Map<string, string>([
      ['issued:kid-1', JSON.stringify({ claimSecret: 's', iat: 1 })],
      ['act:kid-1', JSON.stringify(['d1', 'd2', 'd3', 'd4', 'd5'])],
    ])
    const { ctx, kvStore: store } = makeCtx({ kid: 'kid-1', deviceId: 'd6' }, kvStore)
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: false, reason: 'cap-exceeded' })
    expect(JSON.parse(store.get('act:kid-1')!)).toHaveLength(5) // unchanged
  })

  it('unknown kid (never issued): ok:false reason:unknown-key, no KV write', async () => {
    const { ctx, K3_KV } = makeCtx({ kid: 'never-issued', deviceId: 'd1' }, new Map())
    const res = await onRequestPost(ctx as never)
    expect(await res.json()).toEqual({ ok: false, reason: 'unknown-key' })
    expect(K3_KV.put).not.toHaveBeenCalled()
  })

  it('malformed body: 400 ok:false reason:invalid', async () => {
    const kvStore = new Map<string, string>()
    const { ctx } = makeCtx({ kid: 123, deviceId: 'd1' }, kvStore) // kid wrong type
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, reason: 'invalid' })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run functions/activate.test.ts`
Expected: FAIL（`./activate` が存在しない）

- [ ] **Step 3: 実装**

```ts
// functions/activate.ts
// POST /activate {kid, deviceId} — 発動台数をカウントする（5台キャップ・冪等）。
// 署名検証はクライアント側で済んでいる前提（license-crypto.ts）。ここでは
// kidが発券済みかの整合確認と、台数カウントだけを行う。
// 設計: docs/private/2026-07-01-k3-unlock-design.md §4.2。
import { z } from 'zod'

interface KVNamespace {
  get(key: string, options?: { type?: 'text' }): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

interface Env {
  K3_KV: KVNamespace
}

interface PagesContext {
  request: Request
  env: Env
}

const MAX_BODY_BYTES = 2 * 1024
const MAX_ACTIVATIONS = 5

const activateRequestSchema = z.object({
  kid: z.string().min(1).max(64),
  deviceId: z.string().min(1).max(64),
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/** functions/api/share/create.ts の readBodyCapped と同じ発想（DoS対策の
 *  ストリーム上限読み）。activate/claimはbody無しのGETも多いので独立実装
 *  （dedupはfunctions/_lib/集約の別チケットに委ねる＝既存の方針を踏襲）。 */
async function readCappedText(request: Request, maxBytes: number): Promise<string | null> {
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

export async function onRequestPost(ctx: PagesContext): Promise<Response> {
  const raw = await readCappedText(ctx.request, MAX_BODY_BYTES)
  if (raw === null) return jsonResponse(413, { ok: false, reason: 'invalid' })

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonResponse(400, { ok: false, reason: 'invalid' })
  }

  const parsed = activateRequestSchema.safeParse(body)
  if (!parsed.success) return jsonResponse(400, { ok: false, reason: 'invalid' })
  const { kid, deviceId } = parsed.data

  const issued = await ctx.env.K3_KV.get(`issued:${kid}`)
  if (!issued) return jsonResponse(200, { ok: false, reason: 'unknown-key' })

  const actRaw = await ctx.env.K3_KV.get(`act:${kid}`)
  let devices: string[] = []
  if (actRaw) {
    try {
      const parsedDevices: unknown = JSON.parse(actRaw)
      if (Array.isArray(parsedDevices)) devices = parsedDevices.filter((d): d is string => typeof d === 'string')
    } catch {
      devices = []
    }
  }

  if (devices.includes(deviceId)) return jsonResponse(200, { ok: true })
  if (devices.length >= MAX_ACTIVATIONS) return jsonResponse(200, { ok: false, reason: 'cap-exceeded' })

  devices.push(deviceId)
  await ctx.env.K3_KV.put(`act:${kid}`, JSON.stringify(devices))
  return jsonResponse(200, { ok: true })
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run functions/activate.test.ts`
Expected: PASS（全7ケース）

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit`
Expected: 0件

- [ ] **Step 6: commit**

```bash
git add functions/activate.ts functions/activate.test.ts
git commit -m "feat(k3): add /activate device-cap endpoint"
```

---

### Task 6: `license-activate.ts` — クライアントオーケストレーション（フェイルオープン）

**Files:**
- Create: `lib/board/license-activate.ts`
- Create: `lib/board/license-activate.test.ts`

**Interfaces:**
- Consumes: Task2の `verifyLicenseKey`、Task3の `saveLicense`/`LicenseState`、`lib/sync/device-id.ts`の`getDeviceId`（束1・既存）、Task5の `/activate` 契約。
- Produces: `activateLicenseKey(db, keyString, publicKeyB64url?): Promise<ActivateLicenseKeyResult>`・`ActivateLicenseKeyResult`型。**束6のUIがここを呼ぶ（この束では呼び出し元ゼロ）**。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// lib/board/license-activate.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { activateLicenseKey } from './license-activate'
import { loadLicense } from './license-store'
import { encodeLicensePayload, encodeLicenseKey, bytesToBase64Url, type LicensePayload } from './license-types'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) { if (info.name) indexedDB.deleteDatabase(info.name) }
})
afterEach(() => { if (db) { db.close(); db = null }; vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function makeSignedKey(payload: LicensePayload) {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const publicKeyB64url = bytesToBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey)))
  const payloadB64url = encodeLicensePayload(payload)
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', keyPair.privateKey, new TextEncoder().encode(payloadB64url)))
  return { keyString: encodeLicenseKey(payloadB64url, signature), publicKeyB64url }
}

const payload: LicensePayload = { kid: 'kid-1', scope: ['sync'], v: 1, iat: 1_780_000_000_000 }

describe('activateLicenseKey', () => {
  it('invalid-key: a bad signature is rejected before any network call', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const result = await activateLicenseKey(d, 'not-a-real-key')
    expect(result).toEqual({ status: 'invalid-key' })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(await loadLicense(d)).toBeNull()
  })

  it('unlocked (verified:true): server confirms activation, license is persisted', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const { keyString, publicKeyB64url } = await makeSignedKey(payload)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })))

    const result = await activateLicenseKey(d, keyString, publicKeyB64url)
    expect(result).toEqual({ status: 'unlocked', scope: ['sync'], verified: true })
    const saved = await loadLicense(d)
    expect(saved?.kid).toBe('kid-1')
    expect(saved?.scope).toEqual(['sync'])
  })

  it('cap-exceeded: hard deny, nothing persisted', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const { keyString, publicKeyB64url } = await makeSignedKey(payload)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, reason: 'cap-exceeded' }), { status: 200 }),
    ))

    const result = await activateLicenseKey(d, keyString, publicKeyB64url)
    expect(result).toEqual({ status: 'cap-exceeded' })
    expect(await loadLicense(d)).toBeNull()
  })

  it('fail-open (verified:false): network error still unlocks locally (valid signature trusted)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const { keyString, publicKeyB64url } = await makeSignedKey(payload)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await activateLicenseKey(d, keyString, publicKeyB64url)
    expect(result).toEqual({ status: 'unlocked', scope: ['sync'], verified: false })
    const saved = await loadLicense(d)
    expect(saved?.kid).toBe('kid-1')
  })

  it('fail-open (verified:false): an unknown-key server response also unlocks locally', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const { keyString, publicKeyB64url } = await makeSignedKey(payload)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, reason: 'unknown-key' }), { status: 200 }),
    ))

    const result = await activateLicenseKey(d, keyString, publicKeyB64url)
    expect(result).toEqual({ status: 'unlocked', scope: ['sync'], verified: false })
    expect(await loadLicense(d)).not.toBeNull()
  })

  it('same deviceId is stable across calls (reuses getDeviceId, not a fresh uuid each time)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const { keyString, publicKeyB64url } = await makeSignedKey(payload)
    let capturedBody: { deviceId?: string } = {}
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init!.body as string)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }))

    await activateLicenseKey(d, keyString, publicKeyB64url)
    const firstDeviceId = capturedBody.deviceId
    await activateLicenseKey(d, keyString, publicKeyB64url)
    expect(capturedBody.deviceId).toBe(firstDeviceId)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/board/license-activate.test.ts`
Expected: FAIL（`./license-activate` が存在しない）

- [ ] **Step 3: 実装**

```ts
// lib/board/license-activate.ts
// K3ライセンスキー入力のクライアント側オーケストレーション。
// 署名をオフライン検証→/activateで発動台数を確認→フェイルオープン判定→
// 永続化、の一連の流れ。束6のSETTINGS UIがこの関数を呼ぶ（この束では
// 呼び出し元ゼロ）。設計: docs/private/2026-09-02-device-sync-design.md §10。
import type { IDBPDatabase } from 'idb'
import { verifyLicenseKey } from './license-crypto'
import { saveLicense, type LicenseState } from './license-store'
import { getDeviceId } from '@/lib/sync/device-id'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

export type ActivateLicenseKeyResult =
  | { readonly status: 'unlocked'; readonly scope: readonly string[]; readonly verified: boolean }
  | { readonly status: 'invalid-key' }
  | { readonly status: 'unsupported' }
  | { readonly status: 'cap-exceeded' }

interface ActivateResponseBody {
  readonly ok: boolean
  readonly reason?: string
}

function isActivateResponseBody(v: unknown): v is ActivateResponseBody {
  return typeof v === 'object' && v !== null && typeof (v as { ok?: unknown }).ok === 'boolean'
}

/**
 * キー文字列を発動する。
 *  1. オフラインで署名検証（不正なキーはここで即rejectし、ネットワークに触らない）
 *  2. `/activate` に device を報告して5台キャップを確認
 *  3. フェイルオープン境界（device-sync-design.md §10）:
 *     - 明示的な `{ok:false,reason:'cap-exceeded'}` だけが本物の拒否
 *     - それ以外（ネットワーク失敗・タイムアウト・不正レスポンス・
 *       `unknown-key`）は署名が本物である以上、解錠して `verified:false`
 *       で返す（サーバーが台数を数えられなかっただけ、という扱い）
 */
export async function activateLicenseKey(
  db: DbLike,
  keyString: string,
  publicKeyB64url?: string,
): Promise<ActivateLicenseKeyResult> {
  const verified = await verifyLicenseKey(keyString, publicKeyB64url)
  if (verified.status === 'unsupported') return { status: 'unsupported' }
  if (verified.status === 'invalid') return { status: 'invalid-key' }

  const deviceId = await getDeviceId(db)
  const { kid, scope } = verified.payload

  let confirmed = false
  try {
    const res = await fetch('/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kid, deviceId }),
    })
    if (res.ok) {
      const body: unknown = await res.json()
      if (isActivateResponseBody(body)) {
        if (body.ok) {
          confirmed = true
        } else if (body.reason === 'cap-exceeded') {
          return { status: 'cap-exceeded' }
        }
        // 他の明示的reason（'unknown-key'等）はフェイルオープンへフォールスルー
      }
    }
  } catch {
    // ネットワーク失敗 — フェイルオープンへフォールスルー
  }

  const state: LicenseState = { kid, deviceId, scope, validatedAt: Date.now() }
  await saveLicense(db, state)
  return { status: 'unlocked', scope, verified: confirmed }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/board/license-activate.test.ts`
Expected: PASS（全6ケース）

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit`
Expected: 0件

- [ ] **Step 6: commit**

```bash
git add lib/board/license-activate.ts lib/board/license-activate.test.ts
git commit -m "feat(k3): add client-side activation orchestration (fail-open)"
```

---

## Definition of Done（束5）

- [ ] 6タスク全てcommit済み。
- [ ] `npx tsc --noEmit` — 0件。
- [ ] `npx vitest run` — フルスイートgreen（既存分含め・回帰ゼロ）。
- [ ] `npx eslint .`（プロジェクトの既存lintコマンド）— 0件（新規混入エラーなし。既存の無関係1件は許容・bundle4と同じ基準）。
- [ ] `rtk pnpm build` — 成功。
- [ ] `git grep -n "from '@/lib/board/license-activate'\|from '@/lib/board/license-store'\|isSyncUnlocked" -- 'app/**' 'components/**'` — 0件（呼び出し元ゼロ・既存挙動不変を確認）。
- [ ] opus全ブランチレビュー実施 → Critical/Importantゼロを確認してからmasterマージ。
- [ ] `docs/private/2026-09-02-device-sync-design.md` §15 に束5の申し送り（束6への引き継ぎ事項・特に「SETTINGSのキー入力UIはactivateLicenseKeyを呼ぶだけでよい」「`unsupported`/`invalid-key`/`cap-exceeded`/`unlocked(verified:false)`の4状態をUIでどう見せるか」）を追記。
- [ ] `docs/CURRENT_GOAL.md` / `docs/TODO.md` を束5完了・束6着手の内容に更新。
- [ ] マージ後（ユーザー手動）: `wrangler kv namespace create K3_KV`(+`--preview`) → `wrangler.toml`にID反映 → `node scripts/generate-k3-keypair.mjs` → 公開鍵を`.env.production`・秘密鍵を`wrangler pages secret put K3_PRIVATE_KEY`へ → claimレコードを1件seed。
