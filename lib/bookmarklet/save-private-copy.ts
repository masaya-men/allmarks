import type { SupportedLocale } from '@/lib/i18n/config'

export interface SavePrivateCopy {
  readonly setupNotice: string
  readonly errorNotice: string
}

/**
 * Copy for the Private chip's two transient notices in the /save popup.
 * /save is NOT wrapped in I18nProvider (see save-fullscreen-copy.ts's header
 * comment for why) — same self-contained-map pattern, keyed by the board's
 * stored locale. The 13 non-en/ja locales are a Claude first pass and need
 * native review before wide launch.
 */
export const SAVE_PRIVATE_COPY: Record<SupportedLocale, SavePrivateCopy> = {
  en: {
    setupNotice: 'Set up Private in the AllMarks board first.',
    errorNotice: 'Could not encrypt — try again.',
  },
  ja: {
    setupNotice: '先にAllMarksの盤面でPrivateを設定してください。',
    errorNotice: '暗号化できませんでした。もう一度お試しください。',
  },
  zh: {
    setupNotice: '请先在 AllMarks 面板中设置 Private。',
    errorNotice: '加密失败，请重试。',
  },
  ko: {
    setupNotice: '먼저 AllMarks 보드에서 Private를 설정하세요.',
    errorNotice: '암호화하지 못했습니다 — 다시 시도해 주세요.',
  },
  es: {
    setupNotice: 'Primero configura Private en el tablero de AllMarks.',
    errorNotice: 'No se pudo cifrar. Inténtalo de nuevo.',
  },
  fr: {
    setupNotice: "Configurez d'abord Private dans le tableau AllMarks.",
    errorNotice: 'Échec du chiffrement — réessayez.',
  },
  de: {
    setupNotice: 'Richte Private zuerst im AllMarks-Board ein.',
    errorNotice: 'Verschlüsselung fehlgeschlagen — versuche es erneut.',
  },
  pt: {
    setupNotice: 'Configure o Private primeiro no painel do AllMarks.',
    errorNotice: 'Não foi possível criptografar — tente novamente.',
  },
  it: {
    setupNotice: 'Configura prima Private nella bacheca di AllMarks.',
    errorNotice: 'Impossibile cifrare — riprova.',
  },
  nl: {
    setupNotice: 'Stel Private eerst in op het AllMarks-bord.',
    errorNotice: 'Versleutelen mislukt — probeer het opnieuw.',
  },
  tr: {
    setupNotice: "Önce AllMarks panosunda Private'ı ayarlayın.",
    errorNotice: 'Şifrelenemedi — tekrar deneyin.',
  },
  ru: {
    setupNotice: 'Сначала настройте Private на доске AllMarks.',
    errorNotice: 'Не удалось зашифровать — попробуйте снова.',
  },
  ar: {
    setupNotice: 'قم أولاً بإعداد Private في لوحة AllMarks.',
    errorNotice: 'تعذّر التشفير — حاول مرة أخرى.',
  },
  th: {
    setupNotice: 'โปรดตั้งค่า Private ในบอร์ด AllMarks ก่อน',
    errorNotice: 'เข้ารหัสไม่สำเร็จ ลองอีกครั้ง',
  },
  vi: {
    setupNotice: 'Hãy thiết lập Private trên bảng AllMarks trước.',
    errorNotice: 'Không thể mã hoá — hãy thử lại.',
  },
}
