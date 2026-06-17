'use client'
import { useEffect, type RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { parallaxY } from './parallax-math'

export function useParallaxLayer(ref: RefObject<HTMLElement>, distance: number): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => gsap.set(el, { y: parallaxY(self.progress, distance) }),
      })
      return () => st.kill()
    })
    return () => mm.revert()
  }, [ref, distance])
}
