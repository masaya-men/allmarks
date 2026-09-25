'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import giftStyles from './gift-page.module.css'

/** functions/api/license/claim.ts の入力上限と同じ(claim secretの最大長)。 */
const MAX_SECRET_LEN = 128

/**
 * ユーザー承認済みの日本語コピー(逐語・他言語化しない)。/gift は日本語専用
 * ページのため i18n キーは使わずここに直接持つ。
 */
const COPY = {
  before: {
    heading: 'AllMarks 同期キーのプレゼント',
    body: 'このリンクから、AllMarks の端末間同期を無料で使えるキーを受け取れます。キーに期限はありません。',
    note: '同期したデータは、あなた自身の Google ドライブに保存されます(Google アカウントが必要です)。',
    button: 'キーを受け取る',
    loading: '受け取っています…',
    fine: 'ボタンを押すと、あなた専用のキーが発行されます。',
  },
  success: {
    heading: 'あなたの同期キー',
    body: 'AllMarks の SETTINGS → SYNC でこのキーを入力してください。最大5台の端末で使えます。',
    copy: 'コピー',
    copied: 'コピーしました',
    open: 'AllMarks を開く',
    note: 'このキーはあとから表示し直すことができません。安全な場所に保存してください。',
  },
  invalid: 'このリンクは無効か、受け取れる数の上限に達しています。',
  error: 'うまく受け取れませんでした。しばらくしてからもう一度お試しください。',
} as const

interface ClaimApiResponse {
  readonly ok: boolean
  readonly key?: string
  readonly reason?: string
}

function isClaimApiResponse(value: unknown): value is ClaimApiResponse {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).ok === 'boolean'
}

type ViewState =
  | { readonly kind: 'form'; readonly networkError: boolean }
  | { readonly kind: 'loading' }
  | { readonly kind: 'success'; readonly key: string }
  | { readonly kind: 'invalid' }

/**
 * 同期キー無料プレゼントページ本文(functions/claim.ts が 302 redirect する
 * /gift?c=... 専用、日本語のみ)。静的書き出し(output:'export')のページ内で
 * useSearchParams を使うため、実処理は Suspense 配下の子に置く(PurchaseContent
 * と同じ形)。
 */
export function GiftContent(): ReactElement {
  return (
    <Suspense fallback={<LoadingArticle />}>
      <GiftInner />
    </Suspense>
  )
}

function LoadingArticle(): ReactElement {
  return (
    <GiftLayout testId="gift-state-loading">
      <TicketFacts />
    </GiftLayout>
  )
}

function isValidSecret(secret: string | null): secret is string {
  return typeof secret === 'string' && secret.length > 0 && secret.length <= MAX_SECRET_LEN
}

function GiftInner(): ReactElement {
  const searchParams = useSearchParams()
  const secret = searchParams.get('c')
  const secretValid = isValidSecret(secret)

  const [state, setState] = useState<ViewState>(secretValid ? { kind: 'form', networkError: false } : { kind: 'invalid' })
  const mountedRef = useRef(true)
  useEffect(() => {
    return (): void => {
      mountedRef.current = false
    }
  }, [])

  const handleReceive = useCallback((): void => {
    if (!secretValid) return
    setState({ kind: 'loading' })
    void (async (): Promise<void> => {
      let body: unknown = null
      try {
        const res = await fetch('/api/license/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ c: secret }),
        })
        body = await res.json()
      } catch {
        if (mountedRef.current) setState({ kind: 'form', networkError: true })
        return
      }
      if (!mountedRef.current) return
      if (isClaimApiResponse(body) && body.ok && typeof body.key === 'string') {
        setState({ kind: 'success', key: body.key })
        return
      }
      if (isClaimApiResponse(body) && body.reason === 'invalid') {
        setState({ kind: 'invalid' })
        return
      }
      // not-configured / sign-failed / unrecognized shape / non-JSON: treat as
      // a transient failure the user can retry, not a dead link.
      setState({ kind: 'form', networkError: true })
    })()
  }, [secret, secretValid])

  if (state.kind === 'invalid') {
    return (
      <GiftLayout testId="gift-state-invalid">
        <p className={giftStyles.error} data-testid="gift-invalid-message">{COPY.invalid}</p>
      </GiftLayout>
    )
  }

  if (state.kind === 'success') {
    return (
      <GiftLayout testId="gift-state-success">
        <div className={`${giftStyles.tkLabel} ${giftStyles.keyLabel}`}>{COPY.success.heading}</div>
        <div className={giftStyles.keyBox} data-testid="gift-key-value">{state.key}</div>
        <div className={giftStyles.pair}>
          <CopyButton value={state.key} />
          <Link href="/board" className={giftStyles.btnLight} data-testid="gift-open-link">
            {COPY.success.open} ↗
          </Link>
        </div>
        <p className={giftStyles.warn}>
          {COPY.success.body}
          <br />
          {COPY.success.note}
        </p>
      </GiftLayout>
    )
  }

  const loading = state.kind === 'loading'
  const networkError = state.kind === 'form' && state.networkError

  return (
    <GiftLayout testId={loading ? 'gift-state-loading' : 'gift-state-form'}>
      <TicketFacts />
      {networkError ? (
        <p className={giftStyles.error} data-testid="gift-error-message">{COPY.error}</p>
      ) : null}
      <button
        type="button"
        className={giftStyles.cta}
        onClick={handleReceive}
        disabled={loading}
        data-testid="gift-receive-button"
      >
        <span className={giftStyles.ctaDot} aria-hidden="true" />
        {loading ? COPY.before.loading : COPY.before.button}
        {loading ? null : <span className={giftStyles.ctaArrow} aria-hidden="true">→</span>}
      </button>
      <p className={giftStyles.fine}>{COPY.before.fine}</p>
    </GiftLayout>
  )
}

function CopyButton({ value }: { value: string }): ReactElement {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return (): void => window.clearTimeout(id)
  }, [copied])

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // クリップボード不可(非secureコンテキスト等)。キー本文は選択コピー可能なので
      // ここでは何もしない(嘘の「コピーしました」を出さない)。
    }
  }

  return (
    <button
      type="button"
      className={giftStyles.btnDark}
      onClick={(): void => {
        void handleCopy()
      }}
      data-testid="gift-copy-button"
    >
      {copied ? COPY.success.copied : COPY.success.copy}
    </button>
  )
}

/**
 * Page frame: title + lede on the left, the "gift ticket" card on the right
 * (stacks on narrow screens). `children` is the ticket body for the current state.
 */
function GiftLayout({ testId, children }: { testId: string; children: ReactNode }): ReactElement {
  return (
    <article className={giftStyles.root} data-testid={testId}>
      <section>
        <div className={giftStyles.eyebrow}>
          <span className={giftStyles.eyebrowDot} aria-hidden="true" />
          GIFT
        </div>
        <h1 className={giftStyles.title}>
          AllMarks
          <span className={giftStyles.titleJp}>同期キーの<br />プレゼント</span>
        </h1>
        <p className={giftStyles.lede}>{COPY.before.body}</p>
      </section>
      <section>
        <div className={giftStyles.ticket}>
          <div className={giftStyles.shine} aria-hidden="true" />
          <div className={giftStyles.perf} aria-hidden="true" />
          <div className={giftStyles.tkTop}>
            <div>
              <div className={giftStyles.tkLabel}>SYNC KEY</div>
              <div className={giftStyles.tkTitle}>端末間同期</div>
            </div>
            <span className={giftStyles.tkBadge}>無料・期限なし</span>
          </div>
          <div className={giftStyles.tkBody}>{children}</div>
        </div>
      </section>
    </article>
  )
}

function TicketFacts(): ReactElement {
  return (
    <ul className={giftStyles.facts}>
      <li className={giftStyles.fact}>
        <span className={giftStyles.factKey}>期限</span>
        <span><b className={giftStyles.factStrong}>ありません。</b>ずっと使えます。</span>
      </li>
      <li className={giftStyles.fact}>
        <span className={giftStyles.factKey}>端末</span>
        <span>1つのキーで<b className={giftStyles.factStrong}>最大5台</b>まで。</span>
      </li>
      <li className={giftStyles.fact}>
        <span className={giftStyles.factKey}>保存先</span>
        <span>{COPY.before.note}</span>
      </li>
    </ul>
  )
}
