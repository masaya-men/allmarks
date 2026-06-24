import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { BoardBackgroundTypography } from '@/components/board/BoardBackgroundTypography'
import { getShutdownAnimationClass } from '@/lib/animation/tag-shutdown'

vi.mock('@/lib/i18n/I18nProvider', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

const tags = [{ id: 't1', name: 'Inspo' }] as never

describe('BoardBackgroundTypography themeId wiring', () => {
  it('paper-atelier + closing で paper-fade の shutdown class が wordmark に乗る', () => {
    const paperFadeClass = getShutdownAnimationClass('paper-fade')
    const { getByTestId } = render(
      <BoardBackgroundTypography
        activeFilter={{ kind: 'tags', tagIds: ['t1'] } as never}
        tags={tags}
        themeId="paper-atelier"
        closing
      />,
    )
    const span = getByTestId('board-bg-typography').querySelector('span')
    expect(span?.className).toContain(paperFadeClass as string)
  })

  it('default テーマ + closing では wave の shutdown class が乗る (= 既存挙動維持)', () => {
    const waveClass = getShutdownAnimationClass('wave')
    const { getByTestId } = render(
      <BoardBackgroundTypography
        activeFilter={{ kind: 'tags', tagIds: ['t1'] } as never}
        tags={tags}
        themeId="dotted-notebook"
        closing
      />,
    )
    const span = getByTestId('board-bg-typography').querySelector('span')
    expect(span?.className).toContain(waveClass as string)
  })
})
