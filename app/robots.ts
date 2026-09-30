import type { MetadataRoute } from 'next'
import { SITE_URL as PRODUCTION_URL } from '@/lib/constants'

export const dynamic = 'force-static'

/** 通常の検索エンジン等に適用する非公開パス一覧 */
export const PRIVATE_PATHS: string[] = [
  '/save',
  '/save-iframe',
  '/triage',
  '/seed-demos',
  '/glass-lab',
  '/pip-tune',
  '/typo-glitch-lab',
]

/** AI 学習専用クローラー: サイト全体を拒否 */
export const AI_TRAINING_BOTS: string[] = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'Meta-ExternalAgent',
  'cohere-training-data-crawler',
  'Amazonbot',
  'FacebookBot',
]

/** AI 検索・回答ボット: 明示的に許可 (非公開パスのみ除外) */
export const AI_SEARCH_BOTS: string[] = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: AI_TRAINING_BOTS,
        disallow: '/',
      },
      {
        userAgent: AI_SEARCH_BOTS,
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${PRODUCTION_URL}/sitemap.xml`,
    host: PRODUCTION_URL,
  }
}
