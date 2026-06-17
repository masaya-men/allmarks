import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nProvider } from './I18nProvider'
import type { SupportedLocale, Messages } from './config'

/** 指定 locale/messages を同期注入して render する（プロバイダ依存コンポーネントのテスト用）。 */
export function renderWithLocale(
  ui: ReactElement,
  locale: SupportedLocale,
  messages: Messages,
): RenderResult {
  return render(
    <I18nProvider initialLocale={locale} initialMessages={messages}>
      {ui}
    </I18nProvider>,
  )
}
