'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { localeToTranslatorLang } from '@/lib/translate/locale-map'
import {
  isTranslatorSupported, detectLanguage, getTranslatorAvailability, translateText,
} from '@/lib/translate/translator-api'
import { getTextTransition } from '@/lib/animation/text-transition'

type Phase = 'idle' | 'loading' | 'exiting'

export type TweetTranslationView = {
  /** ボタンを描画してよいか (非対応/同言語/検出不可/unavailable は false)。 */
  showButton: boolean
  /** ローカライズ済みのボタン文言 (Translate / Show original)。 */
  buttonLabel: string
  /** 本文要素に表示する現在のテキスト (原文 / 訳文 / スクランブル中フレーム)。 */
  displayText: string
  /** 翻訳失敗時 true (小さく Translation unavailable を出す)。 */
  failed: boolean
  /** 退場/登場アニメを当てる本文要素への ref (消費側が付ける)。 */
  bodyRef: React.RefObject<HTMLElement | null>
  /** phase 由来で本文要素へ足す class (loading=じじっ / exiting=CRT shutdown)。 */
  bodyClassName: string
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
  const transition = useMemo(() => getTextTransition(themeId), [themeId])

  const [showButton, setShowButton] = useState(false)
  const [showingTranslation, setShowingTranslation] = useState(false)
  const [displayText, setDisplayText] = useState(originalText)
  const [failed, setFailed] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')

  const bodyRef = useRef<HTMLElement | null>(null)
  const sourceLangRef = useRef<string | null>(null)
  const translatedRef = useRef<string | null>(null)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const entryCancelRef = useRef<(() => void) | null>(null)

  const stopAnim = useCallback((): void => {
    if (exitTimerRef.current) { clearTimeout(exitTimerRef.current); exitTimerRef.current = null }
    if (entryCancelRef.current) { entryCancelRef.current(); entryCancelRef.current = null }
  }, [])

  // 原文が変わったら全リセット (カード切替)。
  useEffect(() => {
    stopAnim()
    setDisplayText(originalText)
    setShowingTranslation(false)
    setFailed(false)
    setPhase('idle')
    translatedRef.current = null
  }, [originalText, stopAnim])

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

  // アンマウント時に進行中アニメを止める。
  useEffect(() => (): void => { stopAnim() }, [stopAnim])

  // 現在の本文 → `to` へ: CRT shutdown「ぶつん」→ テキスト差替え → boot-up「登場」+ 軽スクランブル。
  const swapTo = useCallback((to: string): void => {
    stopAnim()
    if (prefersReducedMotion()) {
      setPhase('idle')
      setDisplayText(to)
      return
    }
    setPhase('exiting')
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null
      setPhase('idle')
      entryCancelRef.current = transition.playEntry({
        el: bodyRef.current,
        finalText: to,
        setText: setDisplayText,
        reducedMotion: false,
      })
    }, transition.exitMs)
  }, [stopAnim, transition])

  const toggle = useCallback((): void => {
    setFailed(false)
    // 訳 → 原文 (即・再翻訳しない)
    if (showingTranslation) {
      setShowingTranslation(false)
      swapTo(originalText)
      return
    }
    // 原文 → 訳 (キャッシュ済みなら即 swap)
    if (translatedRef.current !== null) {
      setShowingTranslation(true)
      swapTo(translatedRef.current)
      return
    }
    // 初回翻訳: 翻訳中は「じじっ」インジケーターを回し、解決したら swap。
    const source = sourceLangRef.current
    if (!source) { setFailed(true); return }
    setShowingTranslation(true)
    setPhase('loading')
    void (async (): Promise<void> => {
      try {
        const out = await translateText({ source, target: localeToTranslatorLang(locale), text: originalText })
        translatedRef.current = out
        swapTo(out)
      } catch {
        setShowingTranslation(false)
        setFailed(true)
        setPhase('idle')
      }
    })()
  }, [showingTranslation, originalText, locale, swapTo])

  const bodyClassName = phase === 'loading'
    ? (transition.loadingClass ?? '')
    : phase === 'exiting'
      ? (transition.exitClass ?? '')
      : ''

  return {
    showButton,
    buttonLabel: showingTranslation ? t('board.lightbox.showOriginal') : t('board.lightbox.translate'),
    displayText,
    failed,
    bodyRef,
    bodyClassName,
    toggle,
  }
}
