// lib/billing/paddle-checkout.ts
// Paddle.js v2 のロード(1回だけ・promise共有)+ Initialize(1回だけ)+
// オーバーレイ Checkout オープン。lib/sync/google-identity.ts と同じ
// 「inject once + shared promise」パターン。
//
// checkout.completed イベントで取引ID(txn_…)を受け取り、purchase ページへ
// リダイレクトする(遷移先での Paddle API 確認は functions 側の別タスク)。
// 完了イベントには購入者のメールアドレス等は一切読み出さない(transaction_id のみ)。

import { navHref } from '@/lib/i18n/locale-urls'
import type { SupportedLocale } from '@/lib/i18n/config'
import type { PaddleCheckoutConfig } from './paddle-config'

const SCRIPT_SRC = 'https://cdn.paddle.com/paddle/v2/paddle.js'

/** eventCallback には checkout.completed 以外(loaded/closed 等)も飛んでくる。
 *  ここで読むのは name と(completed 時の) data.transaction_id だけなので、
 *  Paddle の全イベント種別は型に持ち込まない受け皿型にする。 */
interface PaddleEvent {
  readonly name: string
  readonly data?: { readonly transaction_id?: unknown }
}

export interface PaddleGlobal {
  readonly Environment: { readonly set: (env: 'sandbox') => void }
  readonly Initialize: (options: {
    readonly token: string
    readonly eventCallback: (event: PaddleEvent) => void
  }) => void
  readonly Checkout: {
    readonly open: (options: {
      readonly items: ReadonlyArray<{ readonly priceId: string; readonly quantity: number }>
      readonly settings: { readonly displayMode: 'overlay' }
    }) => void
  }
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal
  }
}

let loadPromise: Promise<PaddleGlobal> | null = null
let initialized = false
/** checkout.completed のリダイレクト先を作る locale。open() のたびに更新するので、
 *  Initialize は1回きりでも常に「直近にチェックアウトを開いたときの locale」で
 *  リダイレクトできる(Initialize 時点の locale に固定されない)。 */
let redirectLocale: SupportedLocale = 'en'

/** Paddle.js を注入し `window.Paddle` が使えるようになったら resolve する。
 *  ページに1回だけ注入・同時呼び出しは同じ promise を共有。失敗時は
 *  loadPromise を null に戻し、次の呼び出しでリトライできるようにする。 */
function loadPaddleScript(): Promise<PaddleGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Paddle checkout requires a browser environment'))
  }
  if (window.Paddle) return Promise.resolve(window.Paddle)
  if (loadPromise) return loadPromise

  loadPromise = new Promise<PaddleGlobal>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = (): void => {
      if (window.Paddle) {
        resolve(window.Paddle)
      } else {
        loadPromise = null
        reject(new Error('paddle.js loaded but window.Paddle is missing'))
      }
    }
    script.onerror = (): void => {
      loadPromise = null
      reject(new Error('Failed to load paddle.js'))
    }
    document.head.appendChild(script)
  })
  return loadPromise
}

function handlePaddleEvent(event: PaddleEvent): void {
  if (event.name !== 'checkout.completed') return
  const transactionId = event.data?.transaction_id
  if (typeof transactionId !== 'string' || transactionId === '') return
  // 型は現状 string を許すが、'purchase' はまだ LOCALIZED_INTRO_SUBPATHS 未登録
  // の可能性がある(他エージェントが並行登録中)。未登録の間は navHref が
  // フラット '/purchase' にフォールバックするだけで、ここでの型は崩れない。
  const target = `${navHref(redirectLocale, 'purchase')}?txn=${encodeURIComponent(transactionId)}`
  window.location.assign(target)
}

function ensureInitialized(paddle: PaddleGlobal, config: PaddleCheckoutConfig): void {
  if (initialized) return
  if (config.environment === 'sandbox') {
    paddle.Environment.set('sandbox')
  }
  paddle.Initialize({ token: config.clientToken, eventCallback: handlePaddleEvent })
  initialized = true
}

/**
 * Paddle のオーバーレイ Checkout を開く。paddle.js の遅延ロード(初回のみ)→
 * Initialize(初回のみ)→ Checkout.open の順で行う。
 * locale は checkout.completed 後のリダイレクト先(購入ページ)の言語プレフィックスに使う
 * — Paddle 自体の表示言語(settings.locale)は指定しない(対応ロケール一覧が
 * 未確認のため、Paddle の自動判定に委ねる)。
 */
export async function openPaddleCheckout(config: PaddleCheckoutConfig, locale: SupportedLocale): Promise<void> {
  redirectLocale = locale
  const paddle = await loadPaddleScript()
  ensureInitialized(paddle, config)
  paddle.Checkout.open({
    items: [{ priceId: config.priceId, quantity: 1 }],
    settings: { displayMode: 'overlay' },
  })
}
