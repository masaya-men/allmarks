import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { BoardChrome } from './BoardChrome'

let mockLocale = 'ja'
vi.mock('@/lib/i18n/I18nProvider', () => ({ useI18n: () => ({ locale: mockLocale }) }))

describe('BoardChrome wordmark', () => {
  it('links to the locale home', () => {
    mockLocale = 'ja'
    const { container } = render(<BoardChrome />)
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/ja')
  })
  it('links to / for English', () => {
    mockLocale = 'en'
    const { container } = render(<BoardChrome />)
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/')
  })
})
