import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ThemeId } from '@/lib/board/types'
import { listThemeIds } from '@/lib/board/theme-registry'
import { resolveThemeCustomization, isDefaultCustomization } from '@/lib/board/theme-customization'
import { BOARD_FILTER_ALL } from '@/lib/board/board-filter-helpers'
import { BOARD_SLIDERS } from '@/lib/board/constants'
import { ExtensionEntry } from './ExtensionEntry'
import { ThemeModal } from './ThemeModal'
import { TuneTrigger } from './TuneTrigger'
import { FilterPill } from './FilterPill'

/**
 * サブ1 (theme-sub1-chrome-skin-tokens) Task 6 — 「全テーマ × 全 chrome パネルが
 * 抜けなく描画される」を jsdom で固定するロックテスト。
 *
 * サブ1 は chrome の直書き値を `var(--chrome-*, 現行値)` に置換しただけ(トークン配線の
 * み)で、まだどのテーマにも専用の皮は無い＝全テーマが同じ中立フォールバックで描画される
 * はず。サブ2/3 で皮(テーマ別 CSS ブロック / JS 分岐)が入ったとき、「あるテーマだけパネル
 * が消える／中身が空になる」退行が起きたらこのテストが真っ先に落ちる。
 *
 * data-theme-id は BoardRoot が実際に <html> へ書く属性 (BoardRoot.tsx:901 —
 * `el.setAttribute('data-theme-id', themeId)`) を模す。皮の CSS/JS 分岐は将来この属性
 * (または同じ themeId 値の prop) を読むので、テストもこれを張った状態で render する。
 *
 * カバー対象 (jsdom で単体 render 可能な chrome パネル):
 *  - SETTINGS ドロワー (ExtensionEntry → ChromeDrawer)
 *  - THEMES ドロワー (ThemeModal → ChromeDrawer + ThemePicker + ThemeCustomizeSection)
 *  - TUNE (TuneTrigger — .drawer は常設 DOM。FaderColumn × 2 + TunePresetColumn)
 *  - FilterPill のドロップダウン
 *
 * カバー対象外 (見せかけの pass を避けるため意図的に外す):
 *  - ChromeButton / TuneTrigger / FilterPill の実際の computed style(トークンが実際に
 *    解決される値)— CSS module の実カスケードは jsdom では走らないため、これは
 *    tests/e2e/chrome-skin-tokens.spec.ts (Playwright, 実ブラウザ) の担当。ここでは
 *    「テーマが変わってもパネルの構造・主要 testid が欠けないか」のみを見る。
 */

function setThemeAttr(id: ThemeId): void {
  document.documentElement.setAttribute('data-theme-id', id)
}

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('data-theme-id')
})

const extensionEntryBaseProps = {
  quickTagEnabled: true,
  onQuickTagToggle: (): void => {},
  onOpenBookmarkletModal: (): void => {},
  onOpenThemeModal: (): void => {},
  customWidthCount: 0,
  onResetCardSizes: (): void => {},
  onSortNewestFirst: (): void => {},
}

describe('chrome no-gap coverage — every theme renders every chrome panel', () => {
  const ids = listThemeIds()

  it('sanity: the registry still has more than one theme (guards against a silent shrink to 1)', () => {
    expect(ids.length).toBeGreaterThan(1)
  })

  it('SETTINGS drawer (ExtensionEntry) renders its full content for every theme', () => {
    for (const id of ids) {
      setThemeAttr(id)
      const { getByTestId, unmount } = render(
        <ExtensionEntry {...extensionEntryBaseProps} themeId={id} isOpen onOpenChange={(): void => {}} />,
      )
      expect(getByTestId('extension-settings'), `theme=${id}`).toBeTruthy()
      expect(getByTestId('extension-settings-drawer'), `theme=${id}`).toBeTruthy()
      expect(getByTestId('quick-tag-toggle'), `theme=${id}`).toBeTruthy()
      expect(getByTestId('open-theme-modal'), `theme=${id}`).toBeTruthy()
      expect(getByTestId('layout-reset-sizes'), `theme=${id}`).toBeTruthy()
      expect(getByTestId('layout-sort-newest'), `theme=${id}`).toBeTruthy()
      unmount()
    }
  })

  it('THEMES drawer (ThemeModal) renders the full theme list + (when customizable) CUSTOMIZE for every theme', () => {
    for (const id of ids) {
      setThemeAttr(id)
      const customization = resolveThemeCustomization(id, undefined)
      const { getByTestId, queryByTestId, unmount } = render(
        <ThemeModal
          isOpen
          onClose={(): void => {}}
          themeId={id}
          onThemeChange={(): void => {}}
          customization={customization}
          isDefaultCustomization={isDefaultCustomization(id, undefined)}
          onCustomize={(): void => {}}
        />,
      )
      expect(getByTestId('theme-modal'), `theme=${id}`).toBeTruthy()
      // Every registered theme must appear as a pickable row regardless of
      // which one is currently active — the picker (one flat list) must
      // never gap a theme out.
      for (const otherId of ids) {
        expect(getByTestId(`theme-button-${otherId}`), `active=${id} button=${otherId}`).toBeTruthy()
      }
      // CUSTOMIZE is a legitimate, pre-existing gate on theme `kind` (only
      // 'pattern' themes with registered defaults get it) — not a skin gap.
      // Lock its expected presence so a future skin change can't silently
      // flip it either way.
      if (customization) {
        expect(getByTestId('theme-customize'), `theme=${id}`).toBeTruthy()
      } else {
        expect(queryByTestId('theme-customize'), `theme=${id}`).toBeNull()
      }
      unmount()
    }
  })

  it('TUNE (TuneTrigger) renders its fader + preset controls for every theme', () => {
    for (const id of ids) {
      setThemeAttr(id)
      const { getByTestId, getAllByTestId, unmount } = render(
        <TuneTrigger
          widthPx={BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX}
          gapPx={BOARD_SLIDERS.CARD_GAP_DEFAULT_PX}
          onChangeWidth={(): void => {}}
          onChangeGap={(): void => {}}
          onReset={(): void => {}}
          onApplyPreset={(): void => {}}
          roundedCorners
          onToggleCorners={(): void => {}}
        />,
      )
      expect(getByTestId('tune-trigger'), `theme=${id}`).toBeTruthy()
      expect(getByTestId('tune-drawer'), `theme=${id}`).toBeTruthy()
      expect(getAllByTestId('fader-handle'), `theme=${id}`).toHaveLength(2) // W + G
      expect(getByTestId('tune-corners-toggle'), `theme=${id}`).toBeTruthy()
      unmount()
    }
  })

  it('FilterPill dropdown renders for every theme', () => {
    for (const id of ids) {
      setThemeAttr(id)
      const { getByTestId, unmount } = render(
        <FilterPill
          value={BOARD_FILTER_ALL}
          onChange={(): void => {}}
          tags={[]}
          counts={{ all: 0, inbox: 0, archive: 0, dead: 0 }}
        />,
      )
      expect(getByTestId('filter-pill'), `theme=${id}`).toBeTruthy()
      expect(getByTestId('filter-pill-menu'), `theme=${id}`).toBeTruthy()
      unmount()
    }
  })
})
