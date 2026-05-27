'use client'
import { useEffect, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { fetchShare } from '@/lib/share/api-client'
import { sanitizeShareDataV2 } from '@/lib/share/validate-v2'
import type { ShareDataV2 } from '@/lib/share/types-v2'
import styles from './ReceiverLanding.module.css'

type LandingState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: ShareDataV2 }
  | { readonly kind: 'error'; readonly code: 'not_found' | 'expired' | 'invalid' | 'server'; readonly message: string }

type Props = { readonly shareId: string }

export function ReceiverLanding({ shareId }: Props): ReactElement {
  const [state, setState] = useState<LandingState>({ kind: 'loading' })
  const router = useRouter()

  useEffect((): void => {
    void (async (): Promise<void> => {
      const result = await fetchShare(shareId)
      if (!result.ok) {
        const code = result.error === 'not_found' ? 'not_found' : 'server'
        setState({ kind: 'error', code, message: result.message })
        return
      }
      const parsed = sanitizeShareDataV2(result.data.share)
      if (!parsed.ok) {
        setState({ kind: 'error', code: 'invalid', message: parsed.error })
        return
      }
      setState({ kind: 'ready', data: parsed.data })
    })()
  }, [shareId])

  if (state.kind === 'loading') {
    return (
      <div className={styles.shell}>
        <p className={styles.loadingText}>LOADING SHARED COLLECTION</p>
      </div>
    )
  }

  if (state.kind === 'error') {
    const isExpired = state.code === 'not_found'
    return (
      <div className={styles.shell}>
        <div className={styles.errorBox}>
          <p className={styles.errorTitle}>
            {isExpired ? 'This share has expired or was never created' : 'Could not load share'}
          </p>
          <p className={styles.errorMessage}>{state.message}</p>
          <button
            type="button"
            className={styles.errorCta}
            onClick={(): void => router.push('/board')}
          >GO TO ALLMARKS</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <span className={styles.logo}>A</span>
        {state.data.filter && state.data.tags && (
          <span className={styles.filterContext}>
            · FILTERED: {state.data.filter.tagIds.map((id) => state.data.tags?.[id]?.n ?? '?').join(' + ')}
          </span>
        )}
      </header>
      <main className={styles.boardArea}>
        {/* Task 18: real masonry layout here */}
        {state.data.cards.map((c) => (
          <div key={c.u} className={styles.tempCard}>
            {c.th && <img src={c.th} alt="" />}
            <p>{c.t}</p>
          </div>
        ))}
      </main>
      <footer className={styles.stickyCta}>
        <button type="button" className={styles.ctaPrimary} data-testid="bulk-import-btn">
          IMPORT ALL {state.data.cards.length}
        </button>
        <button
          type="button"
          className={styles.ctaSecondary}
          onClick={(): void => router.push(`/s/${shareId}/triage`)}
          data-testid="triage-btn"
        >PICK ONE BY ONE</button>
      </footer>
    </div>
  )
}
