'use client'
import { useEffect, type RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { horizontalScrollDistance } from './horizontal-pin-math'

/**
 * Pin a section and translate its inner track horizontally as the user scrolls
 * (scroll-jack). PC width only (min-width:1024px) AND only when the user has no
 * reduced-motion preference; otherwise no pin is created and the track stays in
 * its static (CSS) layout. Reverts fully on unmount / breakpoint change.
 */
export function useHorizontalPin(opts: {
  sectionRef: RefObject<HTMLElement>
  trackRef: RefObject<HTMLElement>
}): void {
  const { sectionRef, trackRef } = opts
  useEffect(() => {
    const section = sectionRef.current
    const track = trackRef.current
    if (!section || !track) return

    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
      const distance = horizontalScrollDistance(track.scrollWidth, window.innerWidth)
      if (distance <= 0) return
      const tween = gsap.to(track, {
        x: -distance,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${distance}`,
          pin: true,
          scrub: true,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      })
      return () => {
        tween.scrollTrigger?.kill()
        tween.kill()
        gsap.set(track, { x: 0 })
      }
    })
    return () => mm.revert()
  }, [sectionRef, trackRef])
}
