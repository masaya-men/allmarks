'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import en from '@/messages/en.json'
import { SUPPORTED_LOCALES, type SupportedLocale, type Messages, loadMessages } from './config'
import { translate } from './translate'
import { resolveInitialLocale, persistLocale } from './locale-store'

const BAKED_DEFAULT_LOCALE: SupportedLocale = 'en'
const bakedMessages = en as Messages

type I18nValue = {
  locale: SupportedLocale
  t: (key: string) => string
  setLocale: (next: SupportedLocale) => void
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({
  children,
  initialLocale,
  initialMessages,
}: {
  children: ReactNode
  initialLocale?: SupportedLocale
  initialMessages?: Messages
}): React.ReactElement {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale ?? BAKED_DEFAULT_LOCALE)
  const [messages, setMessages] = useState<Messages>(initialMessages ?? bakedMessages)

  // 初回 mount（クライアントのみ）で実際の言語を解決して読み込む。
  // initialLocale 指定時（テスト/明示）は自動解決しない。
  useEffect(() => {
    if (initialLocale) return
    const resolved = resolveInitialLocale()
    if (resolved === BAKED_DEFAULT_LOCALE) return
    let cancelled = false
    loadMessages(resolved).then((m) => {
      if (cancelled) return
      setLocaleState(resolved)
      setMessages(m)
    })
    return () => {
      cancelled = true
    }
  }, [initialLocale])

  const setLocale = useCallback((next: SupportedLocale): void => {
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(next)) return
    persistLocale(next)
    void loadMessages(next).then((m) => {
      setLocaleState(next)
      setMessages(m)
    })
  }, [])

  const value = useMemo<I18nValue>(
    () => ({ locale, t: (key: string) => translate(messages, key), setLocale }),
    [locale, messages, setLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// プロバイダ外で使われたとき（独立コンポーネントテスト・save popup 等）の安全な既定値。
// 英語ベイク・no-op setLocale。throw しない。
const FALLBACK: I18nValue = {
  locale: BAKED_DEFAULT_LOCALE,
  t: (key: string) => translate(bakedMessages, key),
  setLocale: () => {},
}

export function useI18n(): I18nValue {
  return useContext(I18nContext) ?? FALLBACK
}
