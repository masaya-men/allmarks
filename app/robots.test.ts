import { describe, it, expect } from 'vitest'
import robots from './robots'
import { SITE_URL } from '@/lib/constants'

type Rule = { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] }

const rules = (): Rule[] => {
  const r = robots().rules
  return Array.isArray(r) ? (r as Rule[]) : [r as Rule]
}
const agents = (r: Rule): string[] =>
  Array.isArray(r.userAgent) ? r.userAgent : r.userAgent ? [r.userAgent] : []
const ruleFor = (ua: string): Rule | undefined => rules().find((r) => agents(r).includes(ua))

describe('robots', () => {
  it('* ルールは従来どおり (/api/ /s/ は塞がない)', () => {
    const star = ruleFor('*')
    expect(star?.allow).toBe('/')
    expect(star?.disallow).toEqual([
      '/save', '/save-iframe', '/triage', '/seed-demos', '/glass-lab', '/pip-tune', '/typo-glitch-lab',
    ])
    expect(JSON.stringify(star?.disallow)).not.toContain('/api')
    expect(JSON.stringify(star?.disallow)).not.toContain('/s/')
  })

  it.each([
    'GPTBot', 'ClaudeBot', 'anthropic-ai', 'CCBot', 'Google-Extended',
    'Applebot-Extended', 'Bytespider', 'Meta-ExternalAgent', 'cohere-training-data-crawler',
  ])('学習用クローラー %s は全面拒否', (ua) => {
    expect(ruleFor(ua)?.disallow).toBe('/')
    expect(ruleFor(ua)?.allow).toBeUndefined()
  })

  it.each([
    'OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User',
  ])('検索・回答ボット %s は許可 (非公開パスは * と同じ)', (ua) => {
    const r = ruleFor(ua)
    expect(r?.allow).toBe('/')
    expect(r?.disallow).toEqual(ruleFor('*')?.disallow)
  })

  it('sitemap と host を維持', () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`)
    expect(robots().host).toBe(SITE_URL)
  })
})
