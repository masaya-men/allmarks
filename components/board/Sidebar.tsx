'use client'

import type { ReactElement } from 'react'
import { LiquidGlass } from './LiquidGlass'
import { BookmarkletInstall } from '@/components/bookmarklet/BookmarkletInstall'
import { t } from '@/lib/i18n/t'
import type { BoardFilter } from '@/lib/board/types'
import {
  BOARD_FILTER_ALL, BOARD_FILTER_INBOX, BOARD_FILTER_ARCHIVE,
  boardFilterEquals, isTagsFilter,
} from '@/lib/board/board-filter-helpers'
import type { TagRecord } from '@/lib/storage/indexeddb'
import styles from './Sidebar.module.css'

type Props = {
  readonly collapsed: boolean
  readonly onToggle: () => void
  readonly counts: { readonly all: number; readonly inbox: number; readonly archive: number }
  readonly activeFilter: BoardFilter
  readonly onFilterChange: (f: BoardFilter) => void
  readonly tags: ReadonlyArray<TagRecord>
  readonly tagCounts: Readonly<Record<string, number>>
  readonly onCreateTag: () => void
  readonly onOpenBookmarkletModal?: () => void
  readonly onTriageStart?: () => void
}

export function Sidebar({
  collapsed, onToggle, counts, activeFilter, onFilterChange,
  tags, tagCounts, onCreateTag, onOpenBookmarkletModal, onTriageStart,
}: Props): ReactElement {
  const isActiveTag = (id: string): boolean =>
    isTagsFilter(activeFilter) && activeFilter.tagIds.length === 1 && activeFilter.tagIds[0] === id

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`.trim()}
      data-testid="board-sidebar"
      aria-label="ボードナビゲーション"
    >
      <LiquidGlass className={styles.sidebarGlass}>
        <div className={styles.inner}>
          <div className={styles.brand}>
            <span className={styles.brandName}>AllMarks</span>
            <button
              type="button"
              className={styles.collapseBtn}
              onClick={onToggle}
              aria-label={collapsed ? t('board.sidebar.expandAria') : t('board.sidebar.collapseAria')}
            >{collapsed ? '⇥' : '⇤'}</button>
          </div>

          <div className={styles.search}>
            <span className={styles.searchIcon}>🔍</span>
            <span className={styles.searchPlaceholder}>{t('board.sidebar.searchPlaceholder')}</span>
            <span className={styles.searchHint}>{t('board.sidebar.searchHint')}</span>
          </div>

          <div className={styles.sectionHeader}>{t('board.sidebar.libraryHeader')}</div>
          <button type="button"
            className={`${styles.navItem} ${boardFilterEquals(activeFilter, BOARD_FILTER_ALL) ? styles.active : ''}`.trim()}
            onClick={() => onFilterChange(BOARD_FILTER_ALL)}>
            <span className={styles.navLabel}>{t('board.sidebar.all')}</span>
            <span className={styles.navCount}>{counts.all}</span>
          </button>
          <button type="button"
            className={`${styles.navItem} ${boardFilterEquals(activeFilter, BOARD_FILTER_INBOX) ? styles.active : ''}`.trim()}
            onClick={() => onFilterChange(BOARD_FILTER_INBOX)}>
            <span className={styles.navLabel}>{t('board.sidebar.inbox')}</span>
            <span className={`${styles.navCount} ${counts.inbox > 0 ? styles.navCountHot : ''}`.trim()}>{counts.inbox}</span>
          </button>
          <button type="button"
            className={`${styles.navItem} ${boardFilterEquals(activeFilter, BOARD_FILTER_ARCHIVE) ? styles.active : ''}`.trim()}
            onClick={() => onFilterChange(BOARD_FILTER_ARCHIVE)}>
            <span className={styles.navLabel}>{t('board.sidebar.archive')}</span>
            <span className={styles.navCount}>{counts.archive}</span>
          </button>

          {counts.inbox > 0 && onTriageStart && (
            <button type="button" className={styles.triageCta} onClick={onTriageStart}>
              {t('board.sidebar.triageCta')}
            </button>
          )}

          <BookmarkletInstall onClick={onOpenBookmarkletModal ?? (() => {})} />

          <div className={styles.sectionHeader}>{t('board.sidebar.tagsHeader')}</div>
          {tags.map((m) => {
            const f: BoardFilter = { kind: 'tags', tagIds: [m.id], mode: 'and' }
            const active = isActiveTag(m.id)
            return (
              <button key={m.id} type="button"
                className={`${styles.navItem} ${active ? styles.active : ''}`.trim()}
                onClick={() => onFilterChange(f)}>
                <span className={styles.tagDot} style={{ background: m.color }} />
                <span className={styles.navLabel}>{m.name}</span>
                <span className={styles.navCount}>{tagCounts[m.id] ?? 0}</span>
              </button>
            )
          })}
          <button type="button" className={styles.newTagBtn} onClick={onCreateTag}>
            {t('board.sidebar.newTag')}
          </button>

          <div className={styles.spacer} />
          <div className={styles.signature}>{t('board.sidebar.signature')}</div>
        </div>
      </LiquidGlass>
    </aside>
  )
}
