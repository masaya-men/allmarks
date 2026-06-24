'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { localeToTranslatorLang } from '@/lib/translate/locale-map'
import {
  isTranslatorSupported, detectLanguage, getTranslatorAvailability, translateText,
} from '@/lib/translate/translator-api'
import { getTextTransition, type TextTransitionHandle } from '@/lib/animation/text-transition'

export type TweetTranslationView = {
  /** ボタンを描画してよいか (非対応/同言語/検出不可/unavailable は false)。 */
  showButton: boolean
  /** ローカライズ済みのボタン文言 (Translate / Show original)。 */
  buttonLabel: string
  /** 段落に表示すべき現在のテキスト (原文 / スクランブル中 / 訳文)。 */
  displayText: string
  /** 翻訳失敗時 true (小さく Translation unavailable を出す)。 */
  failed: boolean
  /** glitch を当てるフレームか。 */
  glitch: boolean
  /** ボタン onClick。 */
  toggle: () => void
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useTweetTranslation({
  originalText,
  themeId = 'default',
}: {
  originalText: string
  themeId?: string
}): TweetTranslationView {
  const { locale, t } = useI18n()
  const [showButton, setShowButton] = useState(false)
  const [showingTranslation, setShowingTranslation] = useState(false)
  const [displayText, setDisplayText] = useState(originalText)
  const [failed, setFailed] = useState(false)
  const [glitch, setGlitch] = useState(false)

  const sourceLangRef = useRef<string | null>(null)
  const translatedRef = useRef<string | null>(null)
  const handleRef = useRef<TextTransitionHandle | null>(null)

  // 原文が変わったら全リセット (カード切替)。
  useEffect(() => {
    setDisplayText(originalText)
    setShowingTranslation(false)
    setFailed(false)
    translatedRef.current = null
  }, [originalText])

  // mount 時プローブ: 対応か / 原文言語 / availability を確かめてボタン可否を決める。
  useEffect(() => {
    let cancelled = false
    setShowButton(false)
    if (!isTranslatorSupported() || originalText.trim().length === 0) return
    const target = localeToTranslatorLang(locale)
    void (async (): Promise<void> => {
      const source = await detectLanguage(originalText)
      if (cancelled || !source) return
      if (source === target || source === locale) return // 同言語は出さない
      const availability = await getTranslatorAvailability(source, target)
      if (cancelled || availability === 'unavailable') return
      sourceLangRef.current = source
      setShowButton(true)
    })()
    return (): void => { cancelled = true }
  }, [originalText, locale])

  // アンマウント / 原文変更時に進行中アニメを止める。
  useEffect(() => (): void => { handleRef.current?.cancel() }, [originalText])

  const runTransition = useCallback((from: string, to: string | null): TextTransitionHandle => {
    handleRef.current?.cancel()
    const handle = getTextTransition(themeId).run({
      fromText: from,
      toText: to,
      onFrame: setDisplayText,
      onGlitch: setGlitch,
      reducedMotion: prefersReducedMotion(),
    })
    handleRef.current = handle
    return handle
  }, [themeId])

  const toggle = useCallback((): void => {
    setFailed(false)
    // 訳 → 原文 (即・再翻訳しない)
    if (showingTranslation) {
      setShowingTranslation(false)
      runTransition(translatedRef.current ?? originalText, originalText)
      return
    }
    // 原文 → 訳 (キャッシュ済みなら即着地)
    if (translatedRef.current !== null) {
      setShowingTranslation(true)
      runTransition(originalText, translatedRef.current)
      return
    }
    // 初回翻訳: スクランブルをローダー兼用で回し、解決したら settle。
    setShowingTranslation(true)
    const handle = runTransition(originalText, null)
    const source = sourceLangRef.current
    if (!source) { setShowingTranslation(false); setFailed(true); handle.cancel(); return }
    void (async (): Promise<void> => {
      try {
        const out = await translateText({ source, target: localeToTranslatorLang(locale), text: originalText })
        translatedRef.current = out
        handle.settle(out)
      } catch {
        setShowingTranslation(false)
        setFailed(true)
        handle.settle(originalText)
      }
    })()
  }, [showingTranslation, originalText, locale, runTransition])

  return {
    showButton,
    buttonLabel: showingTranslation ? t('board.lightbox.showOriginal') : t('board.lightbox.translate'),
    displayText,
    failed,
    glitch,
    toggle,
  }
}
