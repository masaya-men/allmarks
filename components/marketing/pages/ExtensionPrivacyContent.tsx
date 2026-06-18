'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './legal-page.module.css'

const GITHUB_URL = 'https://github.com/masaya-men/allmarks'

/** 権限行: コード名は固定、purpose だけ翻訳キー。manifest v0.1.20 の実権限に一致。 */
const PERMS = [
  { code: 'activeTab', key: 'activeTab' },
  { code: 'contextMenus', key: 'contextMenus' },
  { code: 'scripting', key: 'scripting' },
  { code: 'offscreen', key: 'offscreen' },
  { code: 'storage', key: 'storage' },
  { code: '<all_urls>', key: 'hostAll' },
] as const

/**
 * 拡張プライバシー本文(審査参照ページ)。manifest/extension コード実体に一致させる:
 * 権限6行(notifications 無し)・host <all_urls>・設定=storage.sync・保存控え=storage.local。
 * GitHub=allmarks。スクロール演出なし。
 */
export function ExtensionPrivacyContent(): React.ReactElement {
  const { t } = useI18n()
  return (
    <article className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.extensionPrivacy.hero.kicker')}
        </p>
        <h1 className={styles.title}>{t('pages.extensionPrivacy.hero.title')}</h1>
        <p className={styles.lead}>{t('pages.extensionPrivacy.hero.lead')}</p>
        <p className={styles.updated}>{t('pages.extensionPrivacy.hero.updated')}</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.does.heading')}</h2>
        <p className={styles.body}>{t('pages.extensionPrivacy.does.body')}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.notCollect.heading')}</h2>
        <p className={styles.body}>{t('pages.extensionPrivacy.notCollect.body')}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.storage.heading')}</h2>
        <p className={styles.body}>{t('pages.extensionPrivacy.storage.body')}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.bridge.heading')}</h2>
        <p className={styles.body}>{t('pages.extensionPrivacy.bridge.body')}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.perms.heading')}</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>{t('pages.extensionPrivacy.perms.colName')}</th>
              <th className={styles.th}>{t('pages.extensionPrivacy.perms.colPurpose')}</th>
            </tr>
          </thead>
          <tbody>
            {PERMS.map((p) => (
              <tr key={p.code}>
                <td className={styles.td}><code className={styles.code}>{p.code}</code></td>
                <td className={styles.td}>{t(`pages.extensionPrivacy.perms.${p.key}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.openSource.heading')}</h2>
        <p className={styles.body}>
          {t('pages.extensionPrivacy.openSource.body')}{' '}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
            github.com/masaya-men/allmarks
          </a>
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.contact.heading')}</h2>
        <p className={styles.body}>
          {t('pages.extensionPrivacy.contact.body')}{' '}
          <Link href="/contact" className={styles.link}>/contact</Link>
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.extensionPrivacy.changes.heading')}</h2>
        <p className={styles.body}>{t('pages.extensionPrivacy.changes.body')}</p>
      </section>
    </article>
  )
}
