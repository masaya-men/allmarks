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
