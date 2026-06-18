'use client'
import { useEffect, type RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function useReveal(ref: RefObject<HTMLElement>, opts: { y?: number; stagger?: number } = {}): void {
  const { y = 28, stagger = 0.12 } = opts
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const targets = el.querySelectorAll('[data-reveal]')
    if (targets.length === 0) return
    const mm = gsap.matchMedia()
    // reduced-motion または narrow(<1024px)は静的に可視(演出は PC のみ)。
    mm.add('(prefers-reduced-motion: reduce), (max-width: 1023px)', () => {
      gsap.set(targets, { opacity: 1, y: 0 })
    })
    mm.add('(prefers-reduced-motion: no-preference) and (min-width: 1024px)', () => {
      const tween = gsap.fromTo(targets, { opacity: 0, y },
        { opacity: 1, y: 0, duration: 0.8, stagger, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 75%' } })
      return () => { tween.scrollTrigger?.kill(); tween.kill() }
    })
    return () => mm.revert()
  }, [ref, y, stagger])
}
