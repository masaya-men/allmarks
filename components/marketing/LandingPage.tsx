'use client'

import { useSmoothScroll } from '@/lib/scroll/use-smooth-scroll'
import { useScrollTrigger } from '@/lib/scroll/use-scroll-trigger'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { Hero } from './sections/Hero'
import { Problem } from './sections/Problem'
import { Features } from './sections/Features'
import { ShareIt } from './sections/ShareIt'
import { FinalCta } from './sections/FinalCta'
import { HeroSection } from './sections/HeroSection'
import './landing-tokens.css'
import { SaveDemoSection } from './sections/SaveDemoSection'
import { CollageDemoSection } from './sections/CollageDemoSection'
import { StyleSwitchSection } from './sections/StyleSwitchSection'
import { ShareDemoSection } from './sections/ShareDemoSection'
import { CtaSection } from './sections/CtaSection'
import styles from './LandingPage.module.css'

/**
 * Landing page root client component.
 * Initializes Lenis smooth scrolling and GSAP ScrollTrigger.
 * Renders 6 marketing sections.
 */
export function LandingPage(): React.ReactElement {
  useSmoothScroll()
  useScrollTrigger()

  return (
    <div className={`${styles.wrapper} lpRoot`}>
      <SiteHeader />
      <div className={styles.content}>
        <Hero />
        <Problem />
        <Features />
        <ShareIt />
        <FinalCta />
        <HeroSection />
        <SaveDemoSection />
        <CollageDemoSection />
        <StyleSwitchSection />
        <ShareDemoSection />
        <CtaSection />
        <SiteFooter />
      </div>
    </div>
  )
}
