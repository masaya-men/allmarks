// lib/scroll/use-scroll-trigger.ts
'use client'

import { useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Register GSAP ScrollTrigger plugin on mount.
 * Call this once in the top-level LP component.
 *
 * No trigger-killing cleanup here: this hook only REGISTERS the plugin
 * (idempotent + global), it never creates ScrollTriggers. Each LP section
 * builds its own triggers inside a gsap.matchMedia()/context and reverts them
 * on its own unmount, so a global `ScrollTrigger.getAll().kill()` here would
 * wrongly tear down triggers owned by still-mounted siblings (or any other
 * ScrollTrigger surface that ever coexists). registerPlugin needs no teardown
 * (rank44).
 */
export function useScrollTrigger(): void {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
  }, [])
}
