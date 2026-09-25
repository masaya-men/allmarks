'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import giftStyles from './gift-page.module.css'
import legalStyles from './legal-page.module.css'
import styles from './purchase-page.module.css'

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
    <article className={legalStyles.root} data-testid="gift-state-loading">
      <header className={legalStyles.hero}>
        <h1 className={legalStyles.title}><GiftHeading /></h1>
      </header>
    </article>
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
      <article className={legalStyles.root} data-testid="gift-state-invalid">
        <header className={legalStyles.hero}>
          <h1 className={legalStyles.title}><GiftHeading /></h1>
        </header>
        <section className={legalStyles.section}>
          <p className={legalStyles.body} data-testid="gift-invalid-message">{COPY.invalid}</p>
        </section>
      </article>
    )
  }

  if (state.kind === 'success') {
    return (
      <article className={legalStyles.root} data-testid="gift-state-success">
        <header className={legalStyles.hero}>
          <h1 className={legalStyles.title}>{COPY.success.heading}</h1>
        </header>
        <section className={legalStyles.section}>
          <p className={legalStyles.body}>{COPY.success.body}</p>
          <div className={styles.keyBox} data-testid="gift-key-value">{state.key}</div>
          <div className={styles.actions}>
            <CopyButton value={state.key} />
            <Link href="/board" className={styles.openLink} data-testid="gift-open-link">
              {COPY.success.open}
            </Link>
          </div>
          <p className={legalStyles.note}>{COPY.success.note}</p>
        </section>
      </article>
    )
  }

  const loading = state.kind === 'loading'
  const networkError = state.kind === 'form' && state.networkError

  return (
    <article className={legalStyles.root} data-testid={loading ? 'gift-state-loading' : 'gift-state-form'}>
      <header className={legalStyles.hero}>
        <h1 className={legalStyles.title}><GiftHeading /></h1>
      </header>
      <section className={legalStyles.section}>
        <p className={legalStyles.body}>{COPY.before.body}</p>
        <p className={legalStyles.note}>{COPY.before.note}</p>
        {networkError ? (
          <p className={legalStyles.body} data-testid="gift-error-message">{COPY.error}</p>
        ) : null}
        <div className={`${styles.actions} ${giftStyles.receiveActions}`}>
          <button
            type="button"
            className={styles.openLink}
            onClick={handleReceive}
            disabled={loading}
            data-testid="gift-receive-button"
          >
            {COPY.before.button}
          </button>
        </div>
      </section>
    </article>
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
      className={styles.copyButton}
      onClick={(): void => {
        void handleCopy()
      }}
      data-testid="gift-copy-button"
    >
      {copied ? COPY.success.copied : COPY.success.copy}
    </button>
  )
}

/** Hero title split as 「AllMarks」 / 「同期キーのプレゼント」 (user-requested two-line layout). */
function GiftHeading(): ReactElement {
  return (
    <>
      <span className={giftStyles.titleLine}>AllMarks</span>
      <span className={giftStyles.titleLine}>同期キーのプレゼント</span>
    </>
  )
}
