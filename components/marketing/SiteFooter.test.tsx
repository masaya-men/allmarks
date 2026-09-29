import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { SiteFooter } from './SiteFooter'

afterEach(() => {
  cleanup()
})

describe('SiteFooter', () => {
  it('フッターの後ろに全画面の黒い Footer Finale を出さない(© の行でページが終わる)', () => {
    const { container } = render(<SiteFooter />)
    expect(container.querySelector('[data-footer-finale]')).toBeNull()
    // 大きな "Open Board" ボタンも無い: /board へのリンクはナビの 1 本だけ。
    expect(container.querySelectorAll('a[href="/board"]')).toHaveLength(1)
    expect(container.querySelector('footer')?.lastElementChild?.textContent).toContain('2026 AllMarks')
  })

  it('左下のブランド名は AllMarks', () => {
    const { container } = render(<SiteFooter />)
    // CSS Modules のクラス名はハッシュ化されるので、ブランドのリンクは aria-label で引く。
    expect(container.querySelector('a[aria-label="AllMarks home"]')?.textContent).toBe('AllMarks')
  })

  it('ブランド名はヘッダーと同じ Geist の太字で、斜体にしない', () => {
    const css = readFileSync('components/marketing/SiteFooter.module.css', 'utf8')
    const rule = /\.brand\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule).toContain('var(--font-geist)')
    expect(rule).toMatch(/font-weight:\s*700/)
    expect(rule).toMatch(/font-style:\s*normal/)
    expect(rule).not.toMatch(/italic/)
  })
})
