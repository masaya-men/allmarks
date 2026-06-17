import { type SupportedLocale, type Messages } from './config'
import ar from '@/messages/ar.json'
import de from '@/messages/de.json'
import en from '@/messages/en.json'
import es from '@/messages/es.json'
import fr from '@/messages/fr.json'
import it from '@/messages/it.json'
import ja from '@/messages/ja.json'
import ko from '@/messages/ko.json'
import nl from '@/messages/nl.json'
import pt from '@/messages/pt.json'
import ru from '@/messages/ru.json'
import th from '@/messages/th.json'
import tr from '@/messages/tr.json'
import vi from '@/messages/vi.json'
import zh from '@/messages/zh.json'

/**
 * All 15 locales' messages, statically imported. SERVER-ONLY — import this
 * from server components (app/[locale]/page.tsx) so only the selected locale's
 * object is passed as a prop into the client provider. Never import from a
 * client component (it would bundle all 15 languages into that chunk).
 */
export const STATIC_MESSAGES: Record<SupportedLocale, Messages> = {
  ja: ja as Messages,
  en: en as Messages,
  zh: zh as Messages,
  ko: ko as Messages,
  es: es as Messages,
  fr: fr as Messages,
  de: de as Messages,
  pt: pt as Messages,
  it: it as Messages,
  nl: nl as Messages,
  tr: tr as Messages,
  ru: ru as Messages,
  ar: ar as Messages,
  th: th as Messages,
  vi: vi as Messages,
}
