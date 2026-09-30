'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import { localePath } from '@/lib/i18n/locale-urls'
import { ChromeButton } from './ChromeButton'
import styles from './BoardChrome.module.css'

/**
 * Outer-frame chrome for /board: the AllMarks wordmark in the top-left margin,
 * linking back to the marketing home (= a way out of the board to the LP).
 *
 * Rendered as a {@link ChromeButton} link variant so it is visually and
 * behaviourally identical to the header menu (TUNE / SHARE …): same monospace
 * font, idle micro-scramble, hover scramble burst + RGB glitch. Sharing the
 * component means a future chrome theme swaps the wordmark and the header menu
 * together. This module only positions it in the dark top margin + fades it
 * with the rest of the chrome while the Lightbox is open.
 *
 * The bottom marketing link strip (Guide/About/Privacy/Terms) was dropped when
 * the board went edge-to-edge (no bottom margin to host it); it returns in a
 * future footer redesign. The top-left wordmark needs no bottom margin.
 */
export function BoardChrome({ hidden = false }: { readonly hidden?: boolean }): React.ReactElement {
  const { locale } = useI18n()
  // 言語つきのホーム(例 /ja)へ直接飛ぶ。'/' だと client 遷移でサーバーの言語振り分けが走らず英語 LP に着く。
  return (
    <div className={hidden ? `${styles.brandSlot} ${styles.brandHidden}` : styles.brandSlot}>
      <ChromeButton href={localePath(locale)} label="AllMarks" aria-label="AllMarks home" />
    </div>
  )
}
