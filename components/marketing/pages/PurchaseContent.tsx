'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { navHref } from '@/lib/i18n/locale-urls'
import { renderLinkedText, type RichLinkTarget } from '@/lib/i18n/rich-text'
import legalStyles from './legal-page.module.css'
import styles from './purchase-page.module.css'

/** Paddle transaction id shape (functions/api/license/purchase.ts の TXN_PATTERN と同じ)。 */
const TXN_PATTERN = /^txn_[a-z0-9]{10,40}$/i
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 30000

interface PurchaseApiResponse {
  readonly ok: boolean
  readonly key?: string
  readonly reason?: string
}

function isPurchaseApiResponse(value: unknown): value is PurchaseApiResponse {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).ok === 'boolean'
}

type FlowResult =
  | { readonly kind: 'success'; readonly key: string }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'error' }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'cancelled' }

/** Mutable flag a caller flips to stop applying a stale request's result
 *  (unmount, or a newer submission superseding an in-flight one). */
interface CancelToken {
  cancelled: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * POST /api/license/purchase を叩き、reason:'processing' の間は2秒おきに
 * 合計30秒まで再試行する(design: 決済直後は Paddle 側のサブスク確定が
 * 少し遅れることがある)。ok:true で鍵を得るか、リトライ上限、確定的な
 * エラー(not-found/not-paid/invalid はまとめて'not-found'、それ以外は
 * 'error')のいずれかで終了する。
 */
async function runPurchaseFlow(txn: string, token: CancelToken): Promise<FlowResult> {
  const startedAt = Date.now()
  for (;;) {
    let body: unknown = null
    try {
      const res = await fetch('/api/license/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txn }),
      })
      body = await res.json()
    } catch {
      return { kind: 'error' }
    }
    if (token.cancelled) return { kind: 'cancelled' }
    if (!isPurchaseApiResponse(body)) return { kind: 'error' }
    if (body.ok && typeof body.key === 'string') return { kind: 'success', key: body.key }

    if (body.reason === 'processing') {
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) return { kind: 'timeout' }
      await sleep(POLL_INTERVAL_MS)
      if (token.cancelled) return { kind: 'cancelled' }
      continue
    }
    if (body.reason === 'not-found' || body.reason === 'not-paid' || body.reason === 'invalid') {
      return { kind: 'not-found' }
    }
    // upstream / not-configured / sign-failed / anything unrecognized
    return { kind: 'error' }
  }
}

type ViewState =
  | { readonly kind: 'form' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'success'; readonly key: string }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'error' }

/**
 * 購入完了/キー再表示ページ本文(s221)。静的書き出し(output:'export')の
 * ページ内で useSearchParams を使うため、実処理は Suspense 配下の子に置く
 * (シェル自体はサーバーコンポーネントのまま)。
 */
export function PurchaseContent(): ReactElement {
  return (
    <Suspense fallback={<LoadingMessage />}>
      <PurchaseInner />
    </Suspense>
  )
}

function LoadingMessage(): ReactElement {
  const { t } = useI18n()
  return (
    <article className={legalStyles.root} data-testid="purchase-state-loading">
      <p className={legalStyles.body}>{t('pages.purchase.confirming')}</p>
    </article>
  )
}

function PurchaseInner(): ReactElement {
  const { t, locale } = useI18n()
  const searchParams = useSearchParams()
  const txnFromUrl = searchParams.get('txn')

  const [state, setState] = useState<ViewState>(txnFromUrl ? { kind: 'loading' } : { kind: 'form' })
  const cancelRef = useRef<CancelToken | null>(null)

  const runFlow = useCallback((txn: string): void => {
    if (cancelRef.current) cancelRef.current.cancelled = true
    const token: CancelToken = { cancelled: false }
    cancelRef.current = token
    setState({ kind: 'loading' })
    void runPurchaseFlow(txn, token).then((result) => {
      if (token.cancelled || result.kind === 'cancelled') return
      if (result.kind === 'success') setState({ kind: 'success', key: result.key })
      else setState({ kind: result.kind })
    })
  }, [])

  useEffect(() => {
    if (txnFromUrl) runFlow(txnFromUrl)
    return (): void => {
      if (cancelRef.current) cancelRef.current.cancelled = true
    }
    // txnFromUrl は初回マウント時の値だけを見る(URL 変化の追従は対象外)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const links: Record<string, RichLinkTarget> = { contact: { href: navHref(locale, 'contact') } }

  if (state.kind === 'form') {
    return (
      <article className={legalStyles.root} data-testid="purchase-state-form">
        <LostKeyForm t={t} onSubmit={runFlow} onInvalid={(): void => setState({ kind: 'not-found' })} />
      </article>
    )
  }

  if (state.kind === 'loading') {
    return (
      <article className={legalStyles.root} data-testid="purchase-state-loading">
        <p className={legalStyles.body}>{t('pages.purchase.confirming')}</p>
      </article>
    )
  }

  if (state.kind === 'timeout') {
    return (
      <article className={legalStyles.root} data-testid="purchase-state-timeout">
        <p className={legalStyles.body}>{t('pages.purchase.processing')}</p>
      </article>
    )
  }

  if (state.kind === 'not-found') {
    return (
      <article className={legalStyles.root} data-testid="purchase-state-not-found">
        <p className={legalStyles.body}>{renderLinkedText(t('pages.purchase.notFound'), links, legalStyles.link)}</p>
      </article>
    )
  }

  if (state.kind === 'error') {
    return (
      <article className={legalStyles.root} data-testid="purchase-state-error">
        <p className={legalStyles.body}>{t('pages.purchase.error')}</p>
      </article>
    )
  }

  return (
    <article className={legalStyles.root} data-testid="purchase-state-success">
      <header className={legalStyles.hero}>
        <h1 className={legalStyles.title}>{t('pages.purchase.success.heading')}</h1>
      </header>
      <section className={legalStyles.section}>
        <h2 className={legalStyles.subheading}>{t('pages.purchase.success.subheading')}</h2>
        <p className={legalStyles.body}>{t('pages.purchase.success.body')}</p>
        <div className={styles.keyBox} data-testid="purchase-key-value">{state.key}</div>
        <div className={styles.actions}>
          <CopyButton t={t} value={state.key} />
          <Link href="/board" className={styles.openLink} data-testid="purchase-open-link">
            {t('pages.purchase.success.open')}
          </Link>
        </div>
        <p className={legalStyles.note}>{t('pages.purchase.success.note')}</p>
      </section>
      <LostKeyForm t={t} onSubmit={runFlow} onInvalid={(): void => setState({ kind: 'not-found' })} />
    </article>
  )
}

function CopyButton({ t, value }: { t: (key: string) => string; value: string }): ReactElement {
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
      data-testid="purchase-copy-button"
    >
      {copied ? t('pages.purchase.success.copied') : t('pages.purchase.success.copy')}
    </button>
  )
}

function LostKeyForm({
  t,
  onSubmit,
  onInvalid,
}: {
  t: (key: string) => string
  onSubmit: (txn: string) => void
  onInvalid: () => void
}): ReactElement {
  const [value, setValue] = useState('')

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!TXN_PATTERN.test(trimmed)) {
      onInvalid()
      return
    }
    onSubmit(trimmed)
  }

  return (
    <section className={legalStyles.section}>
      <h2 className={legalStyles.heading}>{t('pages.purchase.lost.heading')}</h2>
      <form className={styles.lostForm} onSubmit={handleSubmit}>
        <input
          type="text"
          className={styles.lostInput}
          placeholder={t('pages.purchase.lost.placeholder')}
          value={value}
          onChange={(e): void => setValue(e.target.value)}
          data-testid="purchase-lost-input"
        />
        <button type="submit" className={styles.lostButton} data-testid="purchase-lost-submit">
          {t('pages.purchase.lost.button')}
        </button>
      </form>
    </section>
  )
}
