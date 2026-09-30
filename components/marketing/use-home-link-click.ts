'use client'

import { usePathname } from 'next/navigation'
import { getActiveLenis } from '@/lib/scroll/use-smooth-scroll'

const trimSlash = (p: string): string => (p.length > 1 ? p.replace(/\/+$/, '') : p)

/**
 * Click handler for "AllMarks home" links (header logo, footer brand).
 * On the page the link points to, it scrolls smoothly to the top instead of re-navigating.
 * Anywhere else it leaves normal navigation alone.
 */
export function useHomeLinkClick(homeHref: string): (e: React.MouseEvent<HTMLAnchorElement>) => void {
  const pathname = usePathname()
  return (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    if (trimSlash(pathname ?? '') !== trimSlash(homeHref)) return
    e.preventDefault()
    const lenis = getActiveLenis()
    if (lenis) {
      lenis.scrollTo(0)
      return
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' })
  }
}
