// lib/scroll/use-smooth-scroll.ts
'use client'

import { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

let activeLenis: Lenis | null = null

/** 現在動いている Lenis(なければ null)。ページ内のスクロール操作が Lenis 経由で動かすために使う。 */
export function getActiveLenis(): Lenis | null {
  return activeLenis
}

/**
 * Initialize Lenis smooth scrolling and wire it to GSAP ScrollTrigger so that
 * pin/scrub animations stay in sync with the smooth scroll position. Both run
 * off gsap.ticker (one loop), and every Lenis scroll updates ScrollTrigger.
 * Tears down on unmount. Returns a ref to the Lenis instance.
 */
export function useSmoothScroll(): React.RefObject<Lenis | null> {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    gsap.registerPlugin(ScrollTrigger)

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
    })
    lenisRef.current = lenis
    activeLenis = lenis

    lenis.on('scroll', ScrollTrigger.update)

    const tick = (time: number): void => {
      // gsap.ticker time is seconds; Lenis.raf expects milliseconds
      lenis.raf(time * 1000)
    }
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      lenisRef.current = null
      if (activeLenis === lenis) activeLenis = null
    }
  }, [])

  return lenisRef
}
