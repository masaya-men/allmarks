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
