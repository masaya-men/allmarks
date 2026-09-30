import Link from 'next/link'
import { navHref } from '@/lib/i18n/locale-urls'
import styles from './SyncPlan.module.css'

/**
 * SyncPlan — paid-plan section of the LP (s226, paid launch). Copy is the
 * approved v10 mock's Sync block (docs/private/lp-v10-mock.html 477–492).
 * Japanese only for now: LandingPage renders it for `ja` alone until the
 * other 14 locales are translated. The mock's pinned laptop→phone animation
 * is not ported yet; the right side is a static price "ticket" with the same
 * light sweep as the /gift and /purchase key tickets.
 */
export function SyncPlan(): React.ReactElement {
  const pricing = navHref('ja', 'pricing')
  return (
    <section id="sync" className={styles.sync}>
      <div className={`wrap ${styles.grid}`}>
        <div>
          <p className="label">
            <i className="ln" />
            Sync
          </p>
          <h2 className="h2">どの端末でも、<br />同じボード。</h2>
          <p className="body">
            同期プランでは、パソコン・スマートフォン・タブレットで同じボードを使えます。データはご自身の Google ドライブに保存されます。1つのキーで5台まで使えます。
          </p>
          <div className={styles.cta}>
            <Link href={pricing} className="btn roll" data-testid="lp-sync-pricing">
              <span className="rl">
                <span>料金を見る</span>
                <span aria-hidden="true">料金を見る</span>
              </span>
              <span className="arr" aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <Link href={pricing} className={styles.ticket} aria-label="料金を見る">
          <span className={styles.shine} aria-hidden="true" />
          <span className={styles.tkLabel}>SYNC PLAN</span>
          <span className={styles.price}>
            <strong>¥500</strong>
            <span>/月(税込)</span>
          </span>
          <span className={styles.perf} aria-hidden="true" />
          <span className={styles.facts}>
            <span>年額なら ¥5,000</span>
            <span>1つのキーで5台まで</span>
            <span>基本機能はすべて無料</span>
          </span>
        </Link>
      </div>
    </section>
  )
}
