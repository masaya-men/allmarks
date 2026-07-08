// lib/share/create-hosted-share.ts
// 共有データ + (任意) 正規化済みスクショ画像で /s 共有を作成し、
// /s リンクと /og 画像 URL を返す。作成直後に OG URL を一度 fetch して
// CF エッジ & SNS クローラー向けにキャッシュを温める (LoPo recipe: 投稿前に温める)。
//
// copy-share-link.ts の「thumb 無し」版に対し、こちらは thumb を載せる版。
// createShare の引数は KVShareEntry ({ share, thumb? }) と互換。
import type { ApiResult } from './api-client'
import type { CreateShareResponse, ShareDataV2 } from './types-v2'

export type CreateHostedShareResult =
  | { readonly ok: true; readonly url: string; readonly ogUrl: string }
  | { readonly ok: false; readonly message: string }

export type CreateHostedShareDeps = {
  /** Build the v2 payload from the current selection (board order, filter:null). */
  readonly buildShare: () => ShareDataV2
  /** 正規化済み JPEG data-URL。未指定なら thumb 無しで作成 (プレビューは既定カード)。 */
  readonly thumb?: string
  /** POST /api/share/create ({ share, thumb? })。 */
  readonly createShare: (entry: { share: ShareDataV2; thumb?: string }) => Promise<ApiResult<CreateShareResponse>>
  /** window.location.origin。 */
  readonly origin: string
  /** OG 画像 URL をキャッシュに温める副作用 (fire-and-forget)。省略可 (テスト等)。 */
  readonly warm?: (ogUrl: string) => void
}

/** 画像付き (or 無し) の /s 共有を作成し、/s と /og の URL を返す。 */
export async function createHostedShare(deps: CreateHostedShareDeps): Promise<CreateHostedShareResult> {
  let share: ShareDataV2
  try {
    share = deps.buildShare()
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'build error' }
  }

  const entry = deps.thumb ? { share, thumb: deps.thumb } : { share }
  const result = await deps.createShare(entry)
  if (!result.ok) {
    return { ok: false, message: result.message }
  }

  const id = result.data.id
  const url = `${deps.origin}/s/${id}`
  const ogUrl = `${deps.origin}/og/${id}.jpg`
  // 投稿前にエッジ & crawler が拾いやすいよう一度取得 (失敗は無視)。
  deps.warm?.(ogUrl)
  return { ok: true, url, ogUrl }
}
