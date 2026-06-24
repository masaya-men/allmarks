# ツイート翻訳機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 外国語ツイート本文を、Lightbox 内で端末内 Chrome Translator API により原文↔訳をワンタップ切替できるようにする（切替アニメはテーマ差し替え可能、デフォルト=scramble+glitch）。

**Architecture:** 純ロジック（言語コード対応・API ラッパ・テキスト遷移ストラテジ）を `lib/` に小さく分離し、状態機械フック `useTweetTranslation` が統括、既存 `TweetText`（Lightbox.tsx 内）が消費する。翻訳エンジンは端末内 Translator/LanguageDetector（サーバー送信なし・¥0）。切替演出は `getTextTransition(theme)` レジストリ（既存 `getEntryAnimation` パターン踏襲）で、デフォルトは既存スクランブル資産を流用した scramble+glitch。

**Tech Stack:** TypeScript strict / React（'use client'）/ vitest + @testing-library/react / Chrome 端末内 Translator API + LanguageDetector API / 既存 `lib/board/scramble.ts`。

## Global Constraints

- `strict: true`、`any` 禁止（`unknown` + 型ガード）、return type 明示。
- 翻訳は **端末内のみ**・サーバー送信なし・APIキー不要・¥0。訳文は **IndexedDB / item に保存しない**（メモリキャッシュのみ）。
- 非対応ブラウザ（モバイル/Firefox/Safari）・`availability='unavailable'`・原文言語＝翻訳先言語・言語検出失敗 のときは **ボタンを描画しない**。
- 翻訳先 = アプリ現在表示言語 `useI18n().locale`（15言語: `ja,en,zh,ko,es,fr,de,pt,it,nl,tr,ru,ar,th,vi`）。
- UI 文言は世界共通の平易英語（`Translate` / `Show original`）。エラー表現は強い見た目にしない（優しいフィードバック方針）。
- 切替アニメは `getTextTransition(theme)` でテーマ差し替え可能。デフォルト=scramble+glitch（chromatic-aberration text-shadow `2px 0 0 #ff3a5a, -2px 0 0 #5aefff` が確定言語）。
- reduce-motion 時はスクランブル/グリッチを発火させず訳文を即表示。
- 各 commit 前に `rtk tsc && rtk vitest run`。i18n キーは15言語すべてに追加。
- 既知フレーキー `tests/lib/channel.test.ts` は full run でたまに落ちる→再実行で green（本機能と無関係）。

**スコープ判断（実装者向けメモ）**: spec §5.2 は「`use-idle-scramble` の burst ロジックを抽出して共用」と書くが、本計画では**稼働中の React フックを改変せず**、`lib/board/scramble.ts` の基本部品（`SCRAMBLE_CHARS`/`pickRandomChar`）だけを流用して text-transition 側に純粋関数として再実装する（フレームワーク非依存の命令的ランナーが必要なため・既存 ChromeButton の回帰リスク回避）。スクランブルの見た目・文字セットは共通＝spec の意図は満たす。

---

### Task 1: i18n キー追加（15言語）

**Files:**
- Modify: `messages/ja.json`, `messages/en.json`, `messages/zh.json`, `messages/ko.json`, `messages/es.json`, `messages/fr.json`, `messages/de.json`, `messages/pt.json`, `messages/it.json`, `messages/nl.json`, `messages/tr.json`, `messages/ru.json`, `messages/ar.json`, `messages/th.json`, `messages/vi.json`
- Test: `tests/i18n/translate-keys.test.ts`（既存の全キー照合テストがあればそこに統合。無ければ新規）

**Interfaces:**
- Produces: `board.lightbox.translate` / `board.lightbox.showOriginal` / `board.lightbox.translationFailed` の3キー（各 locale の `board.lightbox` オブジェクトに追加）。

- [ ] **Step 1: 失敗するテストを書く**

`tests/i18n/translate-keys.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

const KEYS = ['translate', 'showOriginal', 'translationFailed'] as const

describe('tweet translate i18n keys', () => {
  it('every locale defines board.lightbox.{translate,showOriginal,translationFailed} non-empty', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const msgs = (await import(`@/messages/${locale}.json`)).default as Record<string, unknown>
      const board = msgs.board as Record<string, unknown>
      const lightbox = board?.lightbox as Record<string, string>
      for (const k of KEYS) {
        expect(typeof lightbox?.[k], `${locale}.board.lightbox.${k}`).toBe('string')
        expect((lightbox?.[k] ?? '').length, `${locale}.board.lightbox.${k}`).toBeGreaterThan(0)
      }
    }
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `rtk vitest run tests/i18n/translate-keys.test.ts`
Expected: FAIL（キー未定義）

- [ ] **Step 3: 各 messages/<locale>.json の `board.lightbox` に3キー追加**

値（`translate` / `showOriginal` / `translationFailed`）:
- en: `"Translate"` / `"Show original"` / `"Translation unavailable"`
- ja: `"翻訳"` / `"原文を表示"` / `"翻訳できません"`
- zh: `"翻译"` / `"显示原文"` / `"无法翻译"`
- ko: `"번역"` / `"원문 보기"` / `"번역할 수 없습니다"`
- es: `"Traducir"` / `"Ver original"` / `"Traducción no disponible"`
- fr: `"Traduire"` / `"Voir l’original"` / `"Traduction indisponible"`
- de: `"Übersetzen"` / `"Original anzeigen"` / `"Übersetzung nicht verfügbar"`
- pt: `"Traduzir"` / `"Ver original"` / `"Tradução indisponível"`
- it: `"Traduci"` / `"Mostra originale"` / `"Traduzione non disponibile"`
- nl: `"Vertalen"` / `"Origineel tonen"` / `"Vertaling niet beschikbaar"`
- tr: `"Çevir"` / `"Orijinali göster"` / `"Çeviri kullanılamıyor"`
- ru: `"Перевести"` / `"Показать оригинал"` / `"Перевод недоступен"`
- ar: `"ترجمة"` / `"عرض النص الأصلي"` / `"الترجمة غير متاحة"`
- th: `"แปล"` / `"ดูต้นฉบับ"` / `"ไม่สามารถแปลได้"`
- vi: `"Dịch"` / `"Xem bản gốc"` / `"Không thể dịch"`

既存 `board.lightbox.openSource` と同じオブジェクト内に追加（末尾カンマ・JSON 妥当性に注意）。

- [ ] **Step 4: テスト成功を確認**

Run: `rtk vitest run tests/i18n/translate-keys.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add messages/ tests/i18n/translate-keys.test.ts
rtk git commit -m "i18n(translate): add tweet translate UI keys (15 locales)"
```

---

### Task 2: 言語コード対応づけ（純関数）

**Files:**
- Create: `lib/translate/locale-map.ts`
- Test: `lib/translate/locale-map.test.ts`

**Interfaces:**
- Consumes: `SupportedLocale`（`@/lib/i18n/config`）
- Produces: `localeToTranslatorLang(locale: SupportedLocale): string`

- [ ] **Step 1: 失敗するテストを書く**

`lib/translate/locale-map.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'
import { localeToTranslatorLang } from './locale-map'

describe('localeToTranslatorLang', () => {
  it('maps zh to simplified Chinese (zh-Hans)', () => {
    expect(localeToTranslatorLang('zh')).toBe('zh-Hans')
  })
  it('passes through primary subtags unchanged', () => {
    expect(localeToTranslatorLang('ja')).toBe('ja')
    expect(localeToTranslatorLang('en')).toBe('en')
    expect(localeToTranslatorLang('pt')).toBe('pt')
  })
  it('returns a non-empty BCP-47 tag for every supported locale', () => {
    for (const l of SUPPORTED_LOCALES) {
      expect(localeToTranslatorLang(l).length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `rtk vitest run lib/translate/locale-map.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`lib/translate/locale-map.ts`:
```ts
import type { SupportedLocale } from '@/lib/i18n/config'

/** アプリ locale → Translator API の BCP-47 言語タグ。
 *  zh のみ簡体字 (zh-Hans) を既定にする。他は primary subtag をそのまま使う。
 *  繁体字 (zh-Hant) のユーザー選択は将来課題 (本実装では簡体字固定)。 */
const TRANSLATOR_LANG_BY_LOCALE: Record<SupportedLocale, string> = {
  ja: 'ja', en: 'en', zh: 'zh-Hans', ko: 'ko',
  es: 'es', fr: 'fr', de: 'de', pt: 'pt', it: 'it',
  nl: 'nl', tr: 'tr', ru: 'ru', ar: 'ar', th: 'th', vi: 'vi',
}

export function localeToTranslatorLang(locale: SupportedLocale): string {
  return TRANSLATOR_LANG_BY_LOCALE[locale]
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `rtk vitest run lib/translate/locale-map.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add lib/translate/locale-map.ts lib/translate/locale-map.test.ts
rtk git commit -m "feat(translate): locale to Translator BCP-47 lang map"
```

---

### Task 3: Translator/LanguageDetector 薄いラッパ

**Files:**
- Create: `lib/translate/translator-api.ts`
- Test: `lib/translate/translator-api.test.ts`

**Interfaces:**
- Produces:
  - `type TranslatorAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'`
  - `isTranslatorSupported(): boolean`
  - `detectLanguage(text: string): Promise<string | null>`（confidence < 0.5 や検出不能は null）
  - `getTranslatorAvailability(source: string, target: string): Promise<TranslatorAvailability>`
  - `translateText(args: { source: string; target: string; text: string; onProgress?: (loaded: number) => void }): Promise<string>`

- [ ] **Step 1: 失敗するテストを書く**

`lib/translate/translator-api.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isTranslatorSupported, detectLanguage, getTranslatorAvailability, translateText,
} from './translator-api'

const g = globalThis as unknown as Record<string, unknown>

afterEach(() => {
  delete g.Translator
  delete g.LanguageDetector
  vi.restoreAllMocks()
})

describe('translator-api', () => {
  it('isTranslatorSupported is false when globals are absent', () => {
    expect(isTranslatorSupported()).toBe(false)
  })

  it('isTranslatorSupported is true when both globals exist', () => {
    g.Translator = {}
    g.LanguageDetector = {}
    expect(isTranslatorSupported()).toBe(true)
  })

  it('detectLanguage returns the top language above the confidence floor', async () => {
    g.LanguageDetector = {
      create: vi.fn(async () => ({
        detect: vi.fn(async () => [
          { detectedLanguage: 'es', confidence: 0.92 },
          { detectedLanguage: 'pt', confidence: 0.05 },
        ]),
      })),
    }
    expect(await detectLanguage('Hola mundo')).toBe('es')
  })

  it('detectLanguage returns null below the confidence floor', async () => {
    g.LanguageDetector = {
      create: vi.fn(async () => ({
        detect: vi.fn(async () => [{ detectedLanguage: 'es', confidence: 0.2 }]),
      })),
    }
    expect(await detectLanguage('???')).toBeNull()
  })

  it('getTranslatorAvailability forwards the API verdict', async () => {
    g.Translator = { availability: vi.fn(async () => 'downloadable') }
    expect(await getTranslatorAvailability('es', 'en')).toBe('downloadable')
  })

  it('translateText creates a translator and returns the translation', async () => {
    const translate = vi.fn(async (t: string) => `EN(${t})`)
    g.Translator = { create: vi.fn(async () => ({ translate })) }
    expect(await translateText({ source: 'es', target: 'en', text: 'Hola' })).toBe('EN(Hola)')
    expect(translate).toHaveBeenCalledWith('Hola')
  })

  it('translateText reports download progress via monitor', async () => {
    const translate = vi.fn(async () => 'ok')
    g.Translator = {
      create: vi.fn(async (opts: { monitor?: (m: { addEventListener: (e: string, cb: (ev: { loaded: number }) => void) => void }) => void }) => {
        opts.monitor?.({ addEventListener: (_e, cb) => cb({ loaded: 0.5 }) })
        return { translate }
      }),
    }
    const seen: number[] = []
    await translateText({ source: 'es', target: 'en', text: 'x', onProgress: (l) => seen.push(l) })
    expect(seen).toContain(0.5)
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `rtk vitest run lib/translate/translator-api.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`lib/translate/translator-api.ts`:
```ts
export type TranslatorAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

// Chrome 端末内 API のグローバル形 (実装時の最新仕様に追従させる薄い境界)。
type LanguageDetectorResult = { detectedLanguage: string; confidence: number }
type LanguageDetectorGlobal = {
  create: () => Promise<{ detect: (text: string) => Promise<LanguageDetectorResult[]> }>
}
type DownloadMonitor = { addEventListener: (event: 'downloadprogress', cb: (ev: { loaded: number }) => void) => void }
type TranslatorGlobal = {
  availability?: (opts: { sourceLanguage: string; targetLanguage: string }) => Promise<TranslatorAvailability>
  create: (opts: {
    sourceLanguage: string
    targetLanguage: string
    monitor?: (m: DownloadMonitor) => void
  }) => Promise<{ translate: (text: string) => Promise<string> }>
}

const DETECT_CONFIDENCE_FLOOR = 0.5

function readGlobal<T>(name: string): T | undefined {
  if (typeof self === 'undefined') return undefined
  return (self as unknown as Record<string, unknown>)[name] as T | undefined
}

export function isTranslatorSupported(): boolean {
  return Boolean(readGlobal('Translator')) && Boolean(readGlobal('LanguageDetector'))
}

export async function detectLanguage(text: string): Promise<string | null> {
  const ld = readGlobal<LanguageDetectorGlobal>('LanguageDetector')
  if (!ld) return null
  try {
    const detector = await ld.create()
    const results = await detector.detect(text)
    const top = results[0]
    if (!top || top.confidence < DETECT_CONFIDENCE_FLOOR) return null
    return top.detectedLanguage
  } catch {
    return null
  }
}

export async function getTranslatorAvailability(source: string, target: string): Promise<TranslatorAvailability> {
  const tr = readGlobal<TranslatorGlobal>('Translator')
  if (!tr?.availability) return 'unavailable'
  try {
    return await tr.availability({ sourceLanguage: source, targetLanguage: target })
  } catch {
    return 'unavailable'
  }
}

export async function translateText(args: {
  source: string
  target: string
  text: string
  onProgress?: (loaded: number) => void
}): Promise<string> {
  const tr = readGlobal<TranslatorGlobal>('Translator')
  if (!tr) throw new Error('Translator API unavailable')
  const translator = await tr.create({
    sourceLanguage: args.source,
    targetLanguage: args.target,
    monitor: args.onProgress
      ? (m): void => m.addEventListener('downloadprogress', (ev) => args.onProgress?.(ev.loaded))
      : undefined,
  })
  return translator.translate(args.text)
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `rtk vitest run lib/translate/translator-api.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add lib/translate/translator-api.ts lib/translate/translator-api.test.ts
rtk git commit -m "feat(translate): thin Chrome Translator/LanguageDetector wrapper"
```

---

### Task 4: テキスト遷移レジストリ + scramble テーマ

**Files:**
- Create: `lib/animation/text-transition/index.ts`
- Create: `lib/animation/text-transition/themes/scramble.ts`
- Test: `lib/animation/text-transition/scramble.test.ts`

**Interfaces:**
- Consumes: `SCRAMBLE_CHARS`, `pickRandomChar`（`@/lib/board/scramble`）
- Produces:
  - `type TextTransitionHandle = { settle: (finalText: string) => void; cancel: () => void }`
  - `type TextTransitionRunArgs = { fromText: string; toText: string | null; onFrame: (text: string) => void; onGlitch?: (active: boolean) => void; reducedMotion: boolean }`
  - `type TextTransition = { run: (args: TextTransitionRunArgs) => TextTransitionHandle }`
  - `getTextTransition(theme: string): TextTransition`
  - （scramble.ts 内で test 用に export）`buildSettleSchedule(len: number, rand?: () => number): number[]`、`computeRevealFrame(target: string, elapsedMs: number, schedule: number[]): string`

- [ ] **Step 1: 失敗するテストを書く**

`lib/animation/text-transition/scramble.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { getTextTransition } from './index'
import { buildSettleSchedule, computeRevealFrame } from './themes/scramble'

describe('scramble reveal math', () => {
  it('buildSettleSchedule grows monotonically and matches length', () => {
    const s = buildSettleSchedule(5, () => 0) // rand=0 → deterministic
    expect(s).toHaveLength(5)
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1])
  })

  it('computeRevealFrame shows target chars where settled, preserves spaces and length', () => {
    const target = 'ab cd'
    const schedule = [10, 20, 30, 40, 50]
    const frame = computeRevealFrame(target, 1000, schedule) // all settled
    expect(frame).toBe('ab cd')
    const early = computeRevealFrame(target, 0, schedule) // none settled
    expect(early.length).toBe(target.length)
    expect(early[2]).toBe(' ') // space index always preserved
  })
})

describe('getTextTransition (default theme)', () => {
  it('reduced-motion immediately emits toText with no glitch', () => {
    const onFrame = vi.fn()
    const onGlitch = vi.fn()
    const t = getTextTransition('default')
    t.run({ fromText: 'Hola', toText: 'Hello', onFrame, onGlitch, reducedMotion: true })
    expect(onFrame).toHaveBeenLastCalledWith('Hello')
    expect(onGlitch).not.toHaveBeenCalled()
  })

  it('reduced-motion with null toText keeps fromText until settle', () => {
    const onFrame = vi.fn()
    const t = getTextTransition('default')
    const h = t.run({ fromText: 'Hola', toText: null, onFrame, reducedMotion: true })
    expect(onFrame).toHaveBeenLastCalledWith('Hola')
    h.settle('Hello')
    expect(onFrame).toHaveBeenLastCalledWith('Hello')
  })

  it('unknown theme falls back to default (no throw)', () => {
    expect(() => getTextTransition('does-not-exist').run({
      fromText: 'a', toText: 'b', onFrame: () => {}, reducedMotion: true,
    })).not.toThrow()
  })

  it('cancel after settle stops further frames in reduced-motion path', () => {
    const onFrame = vi.fn()
    const t = getTextTransition('default')
    const h = t.run({ fromText: 'a', toText: 'b', onFrame, reducedMotion: true })
    h.cancel()
    const callsAfterCancel = onFrame.mock.calls.length
    h.settle('c')
    expect(onFrame.mock.calls.length).toBe(callsAfterCancel) // no new frame
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `rtk vitest run lib/animation/text-transition/scramble.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`lib/animation/text-transition/themes/scramble.ts`:
```ts
import { pickRandomChar } from '@/lib/board/scramble'
import type { TextTransition, TextTransitionHandle, TextTransitionRunArgs } from '../index'

const STEP_MS = 14       // per-char stagger (= use-idle-scramble burst step)
const BASE_MS = 120
const SPREAD_MS = 80
const GLITCH_MS = 120

/** 各文字が「着地」する経過時刻(ms)の配列。i 番目 = i*STEP + BASE + rand*SPREAD。 */
export function buildSettleSchedule(len: number, rand: () => number = Math.random): number[] {
  const out: number[] = []
  for (let i = 0; i < len; i++) out.push(i * STEP_MS + BASE_MS + rand() * SPREAD_MS)
  return out
}

/** 経過時刻に応じた表示文字列。settled なら target、未 settle はスクランブル文字。
 *  空白は常に空白のまま(幅の揺れ防止)。長さは target と一致。 */
export function computeRevealFrame(target: string, elapsedMs: number, schedule: number[]): string {
  const chars = [...target]
  return chars
    .map((c, i) => {
      if (c === ' ') return ' '
      if (elapsedMs >= (schedule[i] ?? 0)) return c
      return pickRandomChar()
    })
    .join('')
}

function allScrambled(text: string): string {
  return [...text].map((c) => (c === ' ' ? ' ' : pickRandomChar())).join('')
}

export function createScrambleTransition(): TextTransition {
  return {
    run(args: TextTransitionRunArgs): TextTransitionHandle {
      const { onFrame, onGlitch, reducedMotion } = args
      let cancelled = false
      let raf: number | null = null

      // reduced-motion: アニメ無し。toText があれば即着地、無ければ fromText 維持。
      if (reducedMotion) {
        onFrame(args.toText ?? args.fromText)
        return {
          settle: (finalText: string): void => {
            if (cancelled) return
            onFrame(finalText)
          },
          cancel: (): void => { cancelled = true },
        }
      }

      const startReveal = (target: string): void => {
        if (cancelled) return
        const schedule = buildSettleSchedule([...target].length)
        const start = performance.now()
        onGlitch?.(true)
        const glitchTimer = setTimeout(() => { if (!cancelled) onGlitch?.(false) }, GLITCH_MS)
        const tick = (): void => {
          if (cancelled) { clearTimeout(glitchTimer); return }
          const elapsed = performance.now() - start
          onFrame(computeRevealFrame(target, elapsed, schedule))
          if (elapsed < schedule[schedule.length - 1]) {
            raf = requestAnimationFrame(tick)
          } else {
            onFrame(target)
          }
        }
        raf = requestAnimationFrame(tick)
      }

      const loadLoop = (): void => {
        if (cancelled) return
        onFrame(allScrambled(args.fromText))
        raf = requestAnimationFrame(loadLoop)
      }

      if (args.toText !== null) {
        startReveal(args.toText)
      } else {
        loadLoop() // DL/翻訳待ち = スクランブルし続ける(ローダー兼用)
      }

      return {
        settle: (finalText: string): void => {
          if (cancelled) return
          if (raf !== null) { cancelAnimationFrame(raf); raf = null }
          startReveal(finalText)
        },
        cancel: (): void => {
          cancelled = true
          if (raf !== null) { cancelAnimationFrame(raf); raf = null }
        },
      }
    },
  }
}
```

`lib/animation/text-transition/index.ts`:
```ts
import { createScrambleTransition } from './themes/scramble'

export type TextTransitionHandle = {
  /** 訳文(or 原文)が確定したら呼ぶ。スクランブルがその文字列に着地する。 */
  settle: (finalText: string) => void
  /** 進行中の遷移を中断 (Lightbox を閉じた / カード切替時)。 */
  cancel: () => void
}

export type TextTransitionRunArgs = {
  /** 切替前のテキスト (原文 or 直前の訳文)。 */
  fromText: string
  /** 切替後のテキスト。null = まだ未確定 (DL/翻訳中) → スクランブルをループ。 */
  toText: string | null
  /** tick ごとに「いま表示すべき文字列」を渡す。 */
  onFrame: (text: string) => void
  /** 切替の山場で chromatic-aberration glitch を on/off する。 */
  onGlitch?: (active: boolean) => void
  reducedMotion: boolean
}

export type TextTransition = {
  run: (args: TextTransitionRunArgs) => TextTransitionHandle
}

/** テーマ key → テキスト遷移ストラテジ。未対応 theme は default(scramble+glitch)。
 *  将来テーマは case 追加 (例: wave = CSS crossfade ストラテジ)。
 *  getEntryAnimation (lib/animation/tag-entry) と同じ思想。 */
export function getTextTransition(theme: string): TextTransition {
  switch (theme) {
    case 'scramble':
    case 'default':
    default:
      return createScrambleTransition()
  }
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `rtk vitest run lib/animation/text-transition/scramble.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add lib/animation/text-transition/
rtk git commit -m "feat(translate): theme-swappable text-transition registry + scramble+glitch default"
```

---

### Task 5: useTweetTranslation フック（状態機械）

**Files:**
- Create: `lib/board/use-tweet-translation.ts`
- Test: `lib/board/use-tweet-translation.test.tsx`

**Interfaces:**
- Consumes: `isTranslatorSupported` / `detectLanguage` / `getTranslatorAvailability` / `translateText`（translator-api）、`localeToTranslatorLang`（locale-map）、`getTextTransition`（text-transition）、`useI18n`（locale + t）。
- Produces:
  - `type TweetTranslationView = { showButton: boolean; buttonLabel: string; displayText: string; failed: boolean; toggle: () => void; glitch: boolean }`
  - `useTweetTranslation(args: { originalText: string; themeId?: string }): TweetTranslationView`

- [ ] **Step 1: 失敗するテストを書く**

`lib/board/use-tweet-translation.test.tsx`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@/lib/translate/translator-api', () => ({
  isTranslatorSupported: vi.fn(() => true),
  detectLanguage: vi.fn(async () => 'es'),
  getTranslatorAvailability: vi.fn(async () => 'available'),
  translateText: vi.fn(async (a: { text: string }) => `EN(${a.text})`),
}))
// テキスト遷移は決定論化: toText を即 onFrame、settle も即 onFrame。
vi.mock('@/lib/animation/text-transition', () => ({
  getTextTransition: () => ({
    run: (args: { toText: string | null; onFrame: (t: string) => void }) => {
      if (args.toText !== null) args.onFrame(args.toText)
      return { settle: (f: string) => args.onFrame(f), cancel: () => {} }
    },
  }),
}))

import { useTweetTranslation } from './use-tweet-translation'
import * as api from '@/lib/translate/translator-api'

beforeEach(() => vi.clearAllMocks())

describe('useTweetTranslation', () => {
  it('shows the button when supported, source≠target, availability ok', async () => {
    const { result } = renderHook(() => useTweetTranslation({ originalText: 'Hola mundo' }))
    await waitFor(() => expect(result.current.showButton).toBe(true))
    expect(result.current.displayText).toBe('Hola mundo')
  })

  it('hides the button when the Translator API is unsupported', async () => {
    vi.mocked(api.isTranslatorSupported).mockReturnValueOnce(false)
    const { result } = renderHook(() => useTweetTranslation({ originalText: 'Hola' }))
    await waitFor(() => expect(api.isTranslatorSupported).toHaveBeenCalled())
    expect(result.current.showButton).toBe(false)
  })

  it('hides the button when detected source equals target locale', async () => {
    vi.mocked(api.detectLanguage).mockResolvedValueOnce('en') // FALLBACK locale = en
    const { result } = renderHook(() => useTweetTranslation({ originalText: 'Hello' }))
    await waitFor(() => expect(api.detectLanguage).toHaveBeenCalled())
    expect(result.current.showButton).toBe(false)
  })

  it('hides the button when availability is unavailable', async () => {
    vi.mocked(api.getTranslatorAvailability).mockResolvedValueOnce('unavailable')
    const { result } = renderHook(() => useTweetTranslation({ originalText: 'Hola' }))
    await waitFor(() => expect(api.getTranslatorAvailability).toHaveBeenCalled())
    expect(result.current.showButton).toBe(false)
  })

  it('toggle translates, then toggles back to original without re-translating', async () => {
    const { result } = renderHook(() => useTweetTranslation({ originalText: 'Hola' }))
    await waitFor(() => expect(result.current.showButton).toBe(true))
    await act(async () => { result.current.toggle() })
    await waitFor(() => expect(result.current.displayText).toBe('EN(Hola)'))
    expect(api.translateText).toHaveBeenCalledTimes(1)
    await act(async () => { result.current.toggle() }) // back to original
    await waitFor(() => expect(result.current.displayText).toBe('Hola'))
    await act(async () => { result.current.toggle() }) // forward again (cached)
    await waitFor(() => expect(result.current.displayText).toBe('EN(Hola)'))
    expect(api.translateText).toHaveBeenCalledTimes(1) // not re-translated
  })

  it('sets failed when translate rejects, keeps original text', async () => {
    vi.mocked(api.translateText).mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useTweetTranslation({ originalText: 'Hola' }))
    await waitFor(() => expect(result.current.showButton).toBe(true))
    await act(async () => { result.current.toggle() })
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.displayText).toBe('Hola')
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `rtk vitest run lib/board/use-tweet-translation.test.tsx`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`lib/board/use-tweet-translation.ts`:
```ts
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
```

- [ ] **Step 4: テスト成功を確認**

Run: `rtk vitest run lib/board/use-tweet-translation.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add lib/board/use-tweet-translation.ts lib/board/use-tweet-translation.test.tsx
rtk git commit -m "feat(translate): useTweetTranslation state machine hook"
```

---

### Task 6: TweetText 配線 + CSS（UI）

**Files:**
- Modify: `components/board/Lightbox.tsx`（`TweetText` 関数、L1702-1748 付近）
- Modify: `components/board/Lightbox.module.css`（`.metaCtaGroup` 付近 L759、`.tweetBody` L733 付近）

**Interfaces:**
- Consumes: `useTweetTranslation`（Task 5）、`styles.translateToggle` / `styles.tweetBodyGlitch` / `styles.translateFailed`（本タスクで追加）。

- [ ] **Step 1: CSS を追加**

`components/board/Lightbox.module.css`、`.sourceLink` 定義の直後（L771 付近）に追記:
```css
/* Tweet translate toggle — bare text affordance, matches .sourceLink weight. */
.translateToggle {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--text-body);
  text-decoration: underline;
  font-size: 13px;
  font-family: var(--font-sans);
}
.translateToggle:hover { color: var(--text-primary); }

.translateFailed {
  color: var(--text-meta);
  font-size: 12px;
  font-family: var(--font-sans);
}

/* chromatic-aberration glitch (= AllMarks 確定言語) for the body swap moment. */
.tweetBodyGlitch {
  text-shadow: 2px 0 0 #ff3a5a, -2px 0 0 #5aefff;
}
```

- [ ] **Step 2: `TweetText` を改修**

`components/board/Lightbox.tsx` の `import` 群に追加:
```ts
import { useTweetTranslation } from '@/lib/board/use-tweet-translation'
```

`TweetText` 本体を次に置き換え（L1702-1748）。本文段落を翻訳フックの `displayText` で描画し、`metaCtaGroup` 内に翻訳トグルを追加する:
```tsx
function TweetText({
  item,
  meta,
  hideBody = false,
}: {
  readonly item: LightboxItem
  readonly meta: TweetMeta | null
  readonly hideBody?: boolean
}): ReactNode {
  const { t } = useI18n()
  const authorName = meta?.authorName ?? ''
  const authorHandle = meta?.authorHandle ?? ''
  const originalText = meta?.text ?? item.title
  const tr = useTweetTranslation({ originalText })
  const bodyText = hideBody ? '' : tr.displayText
  return (
    <>
      {(authorName || authorHandle || meta?.authorAvatar) && (
        <div className={styles.tweetAuthor}>
          {meta?.authorAvatar && (
            <img
              src={meta.authorAvatar}
              alt={authorName || authorHandle}
              className={styles.tweetAvatar}
            />
          )}
          <div className={styles.tweetAuthorMeta}>
            {authorName && <div className={styles.tweetAuthorName}>{authorName}</div>}
            {authorHandle && <div className={styles.tweetAuthorHandle}>@{authorHandle}</div>}
          </div>
        </div>
      )}
      {!hideBody && (
        <p className={`${styles.tweetBody}${tr.glitch ? ` ${styles.tweetBodyGlitch}` : ''}`}>
          {bodyText}
        </p>
      )}
      <div className={styles.metaCtaGroup}>
        {!hideBody && tr.showButton && (
          <button
            type="button"
            className={styles.translateToggle}
            onClick={(e): void => { e.stopPropagation(); tr.toggle() }}
            aria-pressed={tr.buttonLabel === t('board.lightbox.showOriginal')}
          >
            {tr.buttonLabel}
          </button>
        )}
        {tr.failed && (
          <span className={styles.translateFailed}>{t('board.lightbox.translationFailed')}</span>
        )}
        <a
          href={safeExternalUrl(item.url)}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.sourceLink}
          onClick={(e): void => e.stopPropagation()}
        >
          {t('board.lightbox.openSource')} →
        </a>
      </div>
    </>
  )
}
```

注: 翻訳ボタンは `hideBody`（text-only tweet が左 TextCard に本文を出すケース）では出さない。本文が右カラムに無いので翻訳対象が表示されないため。

- [ ] **Step 3: 型・テスト・ビルドを確認**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0 errors / 全 test PASS（1652 + 本機能分の新規）

- [ ] **Step 4: コミット**

```bash
rtk git add components/board/Lightbox.tsx components/board/Lightbox.module.css
rtk git commit -m "feat(translate): wire translate toggle into Lightbox TweetText"
```

- [ ] **Step 5: 本番デプロイ + 実機目視確認**

```bash
npx wrangler whoami
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="tweet translate"
```
確認（対応 = デスクトップ Chrome 安定版）:
- 外国語ツイートを Lightbox で開く → 右カラムに `Translate` が出る。
- 押す → (初回はスクランブルがローダーとして回り) 本文が scramble+glitch で訳文に切替、ボタンが `Show original` に変化。
- 再押下 → 原文へ即戻る。
- 日本語ツイート（= 表示言語 ja と同言語）では `Translate` が出ない。
- Firefox/Safari/モバイルでは何も出ない（壊れた見た目を出さない）。
- reduce-motion ON ではスクランブルせず訳が即出る。

---

## Self-Review

**1. Spec coverage:**
- §3 端末内 Translator/LanguageDetector → Task 3 ✓
- §4 振る舞い（トリガー/案A切替/都度翻訳/保存しない/翻訳先=locale/非対応非表示/同言語非表示）→ Task 5（状態機械）+ Task 6（UI）✓
- §5 テーマ差し替えレジストリ + scramble+glitch デフォルト → Task 4 ✓
- §6 言語コード対応（zh→zh-Hans・純関数・検出）→ Task 2 + Task 3 ✓
- §7 コンポーネント構成（5ユニット）→ Task 2-6 に1:1対応 ✓
- §8 エラー処理（非表示/失敗時 Translation unavailable + 原文復帰/cleanup cancel）→ Task 5 + Task 6 ✓
- §9 テスト方針（4純ロジック + 見た目は実機）→ Task 1-5 にユニット、Task 6 Step5 で実機 ✓
- §10 スコープ外 → 計画に含めていない ✓
- §11 受け入れ基準 → Task 6 Step5 の確認項目に反映 ✓

**2. Placeholder scan:** TBD/TODO/「適切なエラー処理」等なし。全 step にコード/コマンド/期待値あり。✓

**3. Type consistency:** `TextTransitionHandle`/`TextTransitionRunArgs`/`TextTransition`/`getTextTransition`（Task 4 で定義 → Task 5 で消費）、`TweetTranslationView`/`useTweetTranslation`（Task 5 定義 → Task 6 消費）、`localeToTranslatorLang`（Task 2 → Task 5）、`isTranslatorSupported`/`detectLanguage`/`getTranslatorAvailability`/`translateText`（Task 3 → Task 5）。名称一致を確認。✓

**4. 既知リスク:** `zh-Hans` を API が受けない可能性（Task 2 の定数1行で調整可・テストが決定を固定）。LanguageDetector が mount 時に小モデルをDLし得る（端末内・¥0・許容）。Translator API のグローバル形（`self.Translator` vs 旧 `self.ai.translator`）→ Task 3 のラッパ境界で実装時に最新仕様へ追従。
