import type { SupportedLocale } from '@/lib/i18n/config'

export type SharePlatform = 'windows' | 'mac' | 'mobile' | 'other'

/** Classify the viewer's platform for the screenshot hint. Mobile is checked
 *  first because iOS UAs contain "like Mac OS X". `uaDataPlatform` is the
 *  high-entropy `navigator.userAgentData.platform` when present (more reliable
 *  than the UA string); the UA string is the fallback. */
export function detectSharePlatform(userAgent: string, uaDataPlatform?: string): SharePlatform {
  if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) return 'mobile'
  const platform = (uaDataPlatform ?? '').toLowerCase()
  const ua = userAgent.toLowerCase()
  if (platform.includes('win') || ua.includes('windows')) return 'windows'
  if (platform.includes('mac') || ua.includes('mac os') || ua.includes('macintosh')) return 'mac'
  return 'other'
}

/** One short, globally-clear English line telling the viewer how to screenshot
 *  the collage. Kept for tests / English fallback; the live board uses the
 *  localized getScreenshotHint below. */
export function pickScreenshotHint(platform: SharePlatform): string {
  switch (platform) {
    case 'windows': return 'Press Win+Shift+S, then drag the collage area.'
    case 'mac': return 'Press ⌘+Shift+4, then drag the collage area.'
    case 'mobile': return 'Take a screenshot, then post it with the link.'
    default: return 'Screenshot the collage area, then post it with the link.'
  }
}

/** The universal key hint per desktop OS — a keyboard shortcut, not localized. */
function platformKeyHint(platform: SharePlatform): string {
  if (platform === 'windows') return '(Win+Shift+S)'
  if (platform === 'mac') return '(⌘+Shift+4)'
  return ''
}

/** Localized lead: "snip the collage, then paste it here." Only the instruction
 *  is localized (per user request s174); action buttons stay globally-clear
 *  English to match the rest of the board chrome. en/ja are reviewed; the other
 *  13 are first-pass pending native review (same policy as the app's other i18n). */
const SNIP_LEAD: Record<SupportedLocale, string> = {
  ja: 'コラージュを撮って、ここに貼り付け',
  en: 'Snip the collage, then paste it here',
  zh: '截取拼贴，然后粘贴到这里',
  ko: '콜라주를 캡처한 뒤 여기에 붙여넣기',
  es: 'Captura el collage y pégalo aquí',
  fr: 'Capturez le collage, puis collez-le ici',
  de: 'Collage ausschneiden, dann hier einfügen',
  pt: 'Recorte a colagem e cole aqui',
  it: 'Cattura il collage e incollalo qui',
  nl: 'Knip de collage en plak hem hier',
  tr: 'Kolajın ekran görüntüsünü al, sonra buraya yapıştır',
  ru: 'Сделайте снимок коллажа и вставьте сюда',
  ar: 'التقط صورة للمجمّعة ثم الصقها هنا',
  th: 'จับภาพคอลลาจ แล้ววางที่นี่',
  vi: 'Chụp ảnh bộ sưu tập, rồi dán vào đây',
}

/** Localized one-line screenshot instruction for the arrange bar. */
export function getScreenshotHint(locale: SupportedLocale, platform: SharePlatform): string {
  const key = platformKeyHint(platform)
  const lead = SNIP_LEAD[locale] ?? SNIP_LEAD.en
  return key ? `${lead} ${key}` : lead
}
