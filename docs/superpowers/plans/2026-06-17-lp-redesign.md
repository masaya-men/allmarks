# LP Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Visual craft:** Every section task is built under the `frontend-design` skill — invoke it before writing a section's JSX/CSS so aesthetic choices (typography scale, spacing, motion feel) follow the skill's rules. The plan fixes structure, copy, interfaces, and behavior; the skill governs polish.

**Goal:** Rebuild the AllMarks landing page as a white, editorial, scroll-animated experience (9 sections) in English + Japanese, ending in a white→black transition into the app.

**Architecture:** Keep `LandingPage.tsx` as the orchestrator and reuse the existing Lenis smooth-scroll + GSAP ScrollTrigger infrastructure. Replace the 6 old section components with 9 new ones, each a focused `'use client'` component + CSS Module that consumes shared design tokens, `landing.*` i18n copy, curated CC0 demo assets, and a shared depth-parallax/reveal helper.

**Tech Stack:** Next.js 14 App Router (static export), TypeScript strict, Vanilla CSS Modules, GSAP + ScrollTrigger, Lenis, next/font/google, IndexedDB-backed `useI18n`.

## Global Constraints

- **No Tailwind.** Vanilla CSS + CSS Modules + CSS custom properties only.
- **No Framer Motion.** GSAP + CSS keyframes only.
- **TypeScript strict**, no `any` (use `unknown` + guards). Explicit return types.
- **All text in px** (no rem). html font-size stays 16px fixed.
- **Accent color = `#28F100` only** (the A-logo green). LP ground stays achromatic white/charcoal; color comes from demo collage assets.
- **Base ground = `#FAFAF8`-ish off-white**, ink = near-black charcoal.
- **Languages this phase: English (baseline) + Japanese only.** LP copy lives under a new `landing.*` namespace in `messages/en.json` (baseline) and `messages/ja.json` (override). Other 13 languages fall back to English (layer-2, a later phase).
- **Demo imagery: CC0 / public-domain only** (Met/Art Institute/Rijksmuseum Open Access, Unsplash/Pexels). Never use the user's real board screenshots.
- **Reduced motion:** every GSAP animation must degrade via `gsap.matchMedia()` / `prefers-reduced-motion` to a calm static end-state (visibility never depends on animation completing — show = pure function of mount).
- **Perf:** LCP < 2.5s, First Load JS < 200KB, images lazy-loaded.
- **Deploy:** `pnpm build` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`. Production = `https://allmarks.app`. Do NOT touch `DB_NAME`, bookmarklet internal IDs, `booklage:*` message types.
- **Privacy:** no competitor names, no strategy words, no personal info in any tracked file/copy.
- **i18n keys must stay structurally identical** between `en.landing` and `ja.landing`.

---

## File Structure

**Create:**
- `components/marketing/landing-tokens.css` — LP design tokens (imported once by LandingPage)
- `lib/marketing/demo-collage.ts` — typed manifest of curated CC0 demo assets
- `lib/scroll/parallax-math.ts` — pure parallax math helper
- `lib/scroll/use-parallax-layer.ts` — ScrollTrigger-based depth-parallax hook (reduced-motion aware)
- `lib/scroll/use-reveal.ts` — shared scroll-reveal hook (fade + rise, reduced-motion aware)
- `components/marketing/sections/Hero.tsx` (+ `.module.css`)
- `components/marketing/sections/Problem.tsx` (+ `.module.css`)
- `components/marketing/sections/SaveAnywhere.tsx` (+ `.module.css`)
- `components/marketing/sections/Arrange.tsx` (+ `.module.css`)
- `components/marketing/sections/Alive.tsx` (+ `.module.css`)  ← multi-playback showcase
- `components/marketing/sections/Customize.tsx` (+ `.module.css`)
- `components/marketing/sections/ShareIt.tsx` (+ `.module.css`)
- `components/marketing/sections/Trust.tsx` (+ `.module.css`)
- `components/marketing/sections/DarkCta.tsx` (+ `.module.css`)
- `public/marketing/collage/` — optimized WebP demo assets
- `docs/marketing-asset-licenses.md` — provenance + license record
- `messages/landing-parity.test.ts` — en/ja landing key parity test
- `lib/marketing/demo-collage.test.ts`, `lib/scroll/parallax-math.test.ts`

**Modify:**
- `app/layout.tsx` — add serif display font via next/font/google (`--font-serif-display`)
- `messages/en.json`, `messages/ja.json` — add `landing` namespace
- `components/marketing/LandingPage.tsx` — orchestrate the 9 new sections + import tokens
- `components/marketing/SiteHeader.tsx` / `.module.css`, `SiteFooter.tsx` / `.module.css` — reskin to white editorial (keep existing nav links)

**Delete (after LandingPage no longer imports them):**
- `components/marketing/sections/HeroSection.tsx` (+ `.module.css`)
- `components/marketing/sections/SaveDemoSection.tsx` (+ `.module.css`)
- `components/marketing/sections/CollageDemoSection.tsx` (+ `.module.css`)
- `components/marketing/sections/StyleSwitchSection.tsx` (+ `.module.css`)
- `components/marketing/sections/ShareDemoSection.tsx` (+ `.module.css`)
- `components/marketing/sections/CtaSection.tsx` (+ `.module.css`)

---

## Task 1: Design tokens + serif display font

**Files:**
- Modify: `app/layout.tsx`
- Create: `components/marketing/landing-tokens.css`

**Interfaces:**
- Produces: CSS var `--font-serif-display` (global, on body); LP token vars on `.lpRoot` scope: `--lp-bg`, `--lp-ink`, `--lp-ink-soft`, `--lp-accent` (`#28F100`), `--lp-serif`, `--lp-sans`, `--lp-maxw` (1489px).

- [ ] **Step 1: Add a serif display font in layout.** In `app/layout.tsx`, extend the existing `next/font/google` imports with a refined serif (start with `Fraunces`, optical-size display) and expose it:
```ts
import { Inter, Outfit, Caveat, Geist, Geist_Mono, Fraunces } from 'next/font/google'
const fraunces = Fraunces({ subsets: ['latin'], weight: ['400','500','600'], style: ['normal','italic'], variable: '--font-serif-display', display: 'swap' })
```
Append `${fraunces.variable}` to the body `className`.

- [ ] **Step 2: Create LP token sheet.** `components/marketing/landing-tokens.css`:
```css
.lpRoot {
  --lp-bg: #faf9f6;
  --lp-ink: #14130f;
  --lp-ink-soft: #57544c;
  --lp-accent: #28f100;
  --lp-serif: var(--font-serif-display), Georgia, 'Times New Roman', serif;
  --lp-sans: var(--font-geist), system-ui, sans-serif;
  --lp-maxw: 1489px;
  background: var(--lp-bg);
  color: var(--lp-ink);
}
```

- [ ] **Step 3: Build to verify font + tokens compile.**
Run: `pnpm build`
Expected: build succeeds, 22+ static routes, no font-resolution error.

- [ ] **Step 4: Commit.**
```bash
rtk git add app/layout.tsx components/marketing/landing-tokens.css
rtk git commit -m "feat(lp): serif display font + LP design tokens"
```

---

## Task 2: `landing.*` i18n copy (en baseline + ja) + parity test

**Files:**
- Modify: `messages/en.json`, `messages/ja.json`
- Create: `messages/landing-parity.test.ts`

**Interfaces:**
- Produces: `t('landing.hero.headline')` etc. Full key set below; both files must share identical key shape.

- [ ] **Step 1: Add `landing` to `messages/en.json`** (top-level key, alongside `app`/`board`/…):
```json
"landing": {
  "hero": {
    "label": "A visual home for your bookmarks",
    "headline": "Bookmarks worth looking at.",
    "subtitle": "Save anything from anywhere, then arrange it into a living visual board that's entirely yours.",
    "ctaPrimary": "Start your board",
    "ctaGhost": "See how it works",
    "scrollHint": "scroll"
  },
  "problem": {
    "headline": "A list is where bookmarks go to be forgotten.",
    "body": "Rows of blue links — no color, no life, nothing you actually want to revisit. Your taste deserves better than a list."
  },
  "save": {
    "headline": "Save from anywhere.",
    "body": "Tweets, videos, articles, shops, images — one click from your browser, the bookmarklet, or a pasted link. It all lands on your board."
  },
  "arrange": {
    "headline": "Then make it a collage.",
    "body": "Colors and styles from all over the web, side by side. Drag, resize, and let it become a board you're proud to open."
  },
  "alive": {
    "headline": "And then it comes alive.",
    "body": "Play several videos at once, right on the board. Not a static grid — a living wall of everything you love."
  },
  "customize": {
    "headline": "Make it unmistakably yours.",
    "body": "Switch themes, tune the sizes, tag and filter. More themes are on the way."
  },
  "share": {
    "headline": "Share it as a picture.",
    "body": "Export your board as an image, or send a link. Your collage travels — links and all."
  },
  "trust": {
    "headline": "No account. No catch.",
    "body": "Everything stays in your browser. No sign-up, no servers holding your data, free to use."
  },
  "cta": {
    "headline": "Your board is waiting.",
    "button": "Open the board"
  },
  "footer": {
    "features": "Features", "guide": "Guide", "faq": "FAQ", "about": "About",
    "privacy": "Privacy", "terms": "Terms", "contact": "Contact"
  }
}
```

- [ ] **Step 2: Add the matching `landing` object to `messages/ja.json`** (identical keys, Japanese values):
```json
"landing": {
  "hero": {
    "label": "保存したものの、美しい置き場所",
    "headline": "眺めたくなる、ブックマーク。",
    "subtitle": "どんなサイトの何でも保存して、自分だけの“生きた”ビジュアルボードに並べる。",
    "ctaPrimary": "ボードを作る",
    "ctaGhost": "使い方を見る",
    "scrollHint": "scroll"
  },
  "problem": {
    "headline": "ためたブックマークは、たいてい二度と見返さない。",
    "body": "青いリンクが並ぶだけ。色も、生命も、もう一度見たくなる理由もない。あなたのセンスは、ただのリストにはもったいない。"
  },
  "save": {
    "headline": "どこからでも保存。",
    "body": "ツイート、動画、記事、ショップ、画像 — 拡張機能・ブックマークレット・URL貼り付けのどれでも、ワンクリックでボードに集まる。"
  },
  "arrange": {
    "headline": "あとは、コラージュに。",
    "body": "ウェブ中の色やスタイルが、隣り合って並ぶ。ドラッグして、サイズを変えて、開くのが楽しみになるボードに。"
  },
  "alive": {
    "headline": "そして、動き出す。",
    "body": "複数の動画を、ボードの上で同時に再生。静止したグリッドじゃない、好きなものが一斉に動く壁。"
  },
  "customize": {
    "headline": "まぎれもなく、あなたのものに。",
    "body": "テーマを切り替え、サイズを整え、タグで絞り込む。テーマはこれからも増えていく。"
  },
  "share": {
    "headline": "一枚の絵として、シェア。",
    "body": "ボードを画像で書き出すか、リンクで送る。リンクごと、コラージュがそのまま届く。"
  },
  "trust": {
    "headline": "登録なし。裏もなし。",
    "body": "すべてはあなたのブラウザの中だけ。登録不要、データをサーバーに預けない、無料。"
  },
  "cta": {
    "headline": "ボードが、待っている。",
    "button": "ボードを開く"
  },
  "footer": {
    "features": "機能", "guide": "使い方", "faq": "FAQ", "about": "About",
    "privacy": "プライバシー", "terms": "規約", "contact": "お問い合わせ"
  }
}
```

- [ ] **Step 3: Write the parity test.** `messages/landing-parity.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import en from './en.json'
import ja from './ja.json'

function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object'
      ? keyPaths(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  )
}

describe('landing namespace parity', () => {
  it('en has a landing namespace', () => {
    expect((en as Record<string, unknown>).landing).toBeDefined()
  })
  it('en.landing and ja.landing share identical key shape', () => {
    const e = keyPaths((en as { landing: Record<string, unknown> }).landing).sort()
    const j = keyPaths((ja as { landing: Record<string, unknown> }).landing).sort()
    expect(j).toEqual(e)
  })
})
```

- [ ] **Step 4: Run the test.**
Run: `pnpm vitest run messages/landing-parity.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: USER COPY CHECKPOINT.** Show the user the EN + JA copy table above and ask for edits before proceeding. Apply any requested wording changes to both files, re-run Step 4.

- [ ] **Step 6: Commit.**
```bash
rtk git add messages/en.json messages/ja.json messages/landing-parity.test.ts
rtk git commit -m "i18n(lp): landing namespace copy (en baseline + ja) + parity test"
```

---

## Task 3: Curated CC0 demo assets + typed manifest

**Files:**
- Create: `public/marketing/collage/*.webp`, `lib/marketing/demo-collage.ts`, `lib/marketing/demo-collage.test.ts`, `docs/marketing-asset-licenses.md`

**Interfaces:**
- Produces:
  - `DEMO_COLLAGE: readonly DemoAsset[]` where `DemoAsset = { src: string; w: number; h: number; kind: 'art' | 'photo'; credit: string; license: 'CC0' }`.
  - `DEMO_VIDEOS: readonly DemoVideo[]` where `DemoVideo = { src: string; poster: string; w: number; h: number; credit: string; license: 'CC0' | 'royalty-free' }` (`src` = optimized mp4 under `marketing/collage/`, `poster` = WebP first frame).
  - `DEMO_YOUTUBE: readonly DemoYouTube[]` where `DemoYouTube = { videoId: string; title: string; vertical: boolean; channel: string; rights: 'public-domain' | 'official-brand' }` — real, rights-clean YouTube IDs (e.g. NASA = public domain) embedded via the product's own `YouTubeEmbed`. No file download.

- [ ] **Step 1: Source 12–16 CC0 images.** Download stylish, varied-color/varied-style images strictly from CC0 sources:
  - Public-domain art: Metropolitan Museum Open Access (`metmuseum.github.io` / `collectionapi.metmuseum.org`, `isPublicDomain: true`), Art Institute of Chicago API (`api.artic.edu`, `is_public_domain: true`), Rijksmuseum.
  - CC0 photos: Unsplash / Pexels.
  Pick only aesthetically strong images; aim for a mix of painterly, photographic, textural, and bold-color frames.
- [ ] **Step 2: Source 3–5 royalty-free looping video clips.** From Pexels Videos / Coverr / Mixkit (all free for commercial use, no attribution required). Choose **stylish, aesthetic, abstract-or-atmospheric** clips (e.g. ink-in-water, neon light, slow fabric, liquid, particles) — moving content that looks beautiful muted and looping. Each ≤10s.
- [ ] **Step 2b: Pick 2–3 rights-clean real YouTube IDs.** Choose from **public-domain / official institutional channels** only — e.g. NASA (footage is public domain), a museum/library official channel. Verify each video plays in an embed (not embed-disabled) and is genuinely rights-clean. These convey "real content from real sites" honestly without implying a private creator's endorsement. Record the channel + rights basis.
- [ ] **Step 3: Optimize all assets.** Images → WebP (max edge ~1000px, quality ~80) in `public/marketing/collage/`. Videos → H.264 mp4 (max 720p, low bitrate, no audio track) + a WebP poster of the first frame, also in `public/marketing/collage/`. Descriptive names (`art-met-portrait-01.webp`, `vid-ink-bloom-01.mp4` / `vid-ink-bloom-01.webp`). Keep total images < ~600KB; each video < ~1.2MB.
- [ ] **Step 4: Record provenance.** `docs/marketing-asset-licenses.md` — one row per file (image AND video): filename, source URL, title/author, license (CC0 / Public Domain / royalty-free).
- [ ] **Step 5: Write the manifest + its test.** `lib/marketing/demo-collage.ts` exports `DEMO_COLLAGE`, `DEMO_VIDEOS`, and `DEMO_YOUTUBE` with real values. `lib/marketing/demo-collage.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { DEMO_COLLAGE, DEMO_VIDEOS, DEMO_YOUTUBE } from './demo-collage'

const pub = (rel: string): string => join(process.cwd(), 'public', rel)

describe('demo collage manifest', () => {
  it('has at least 12 image assets, all CC0', () => {
    expect(DEMO_COLLAGE.length).toBeGreaterThanOrEqual(12)
    expect(DEMO_COLLAGE.every((a) => a.license === 'CC0')).toBe(true)
  })
  it('every image file exists with a positive aspect ratio', () => {
    for (const a of DEMO_COLLAGE) {
      expect(existsSync(pub(a.src))).toBe(true)
      expect(a.w / a.h).toBeGreaterThan(0)
    }
  })
  it('has at least 3 looping videos, each with an existing file + poster', () => {
    expect(DEMO_VIDEOS.length).toBeGreaterThanOrEqual(3)
    for (const v of DEMO_VIDEOS) {
      expect(existsSync(pub(v.src))).toBe(true)
      expect(existsSync(pub(v.poster))).toBe(true)
      expect(v.w / v.h).toBeGreaterThan(0)
    }
  })
  it('has at least 2 rights-clean real YouTube ids', () => {
    expect(DEMO_YOUTUBE.length).toBeGreaterThanOrEqual(2)
    for (const y of DEMO_YOUTUBE) {
      expect(y.videoId).toMatch(/^[\w-]{11}$/)
      expect(['public-domain', 'official-brand']).toContain(y.rights)
    }
  })
})
```
- [ ] **Step 6: Run the test.**
Run: `pnpm vitest run lib/marketing/demo-collage.test.ts`
Expected: PASS.
- [ ] **Step 7: Commit.**
```bash
rtk git add public/marketing/collage lib/marketing/demo-collage.ts lib/marketing/demo-collage.test.ts docs/marketing-asset-licenses.md
rtk git commit -m "feat(lp): curated CC0 demo images + royalty-free looping videos + manifest"
```

---

## Task 4: Depth-parallax + reveal foundation

**Files:**
- Create: `lib/scroll/parallax-math.ts`, `lib/scroll/parallax-math.test.ts`, `lib/scroll/use-parallax-layer.ts`, `lib/scroll/use-reveal.ts`

**Interfaces:**
- Consumes: existing `useScrollTrigger` (registers plugin at LP root).
- Produces:
  - `parallaxY(progress: number, distance: number): number` — pure.
  - `useParallaxLayer(ref: RefObject<HTMLElement>, distance: number): void` — translates element by ±distance across its scroll span; no-op (transform cleared) under reduced motion.
  - `useReveal(ref: RefObject<HTMLElement>, opts?: { y?: number; stagger?: number }): void` — fades + rises children marked `[data-reveal]` when scrolled into view; under reduced motion sets them visible immediately.

- [ ] **Step 1: Write the pure-math test.** `lib/scroll/parallax-math.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parallaxY } from './parallax-math'

describe('parallaxY', () => {
  it('maps progress 0→1 to -distance→+distance, centered at 0', () => {
    expect(parallaxY(0, 100)).toBe(-100)
    expect(parallaxY(0.5, 100)).toBe(0)
    expect(parallaxY(1, 100)).toBe(100)
  })
})
```
- [ ] **Step 2: Run it (fails).**
Run: `pnpm vitest run lib/scroll/parallax-math.test.ts`
Expected: FAIL (module/function missing).
- [ ] **Step 3: Implement the helper.** `lib/scroll/parallax-math.ts`:
```ts
/** Map scroll progress (0..1) to a transform offset of ±distance, centered at the midpoint. */
export function parallaxY(progress: number, distance: number): number {
  return (progress - 0.5) * 2 * distance
}
```
- [ ] **Step 4: Run it (passes).**
Run: `pnpm vitest run lib/scroll/parallax-math.test.ts`
Expected: PASS.
- [ ] **Step 5: Implement the two hooks** (DOM-side, no unit test; verified visually later). `lib/scroll/use-parallax-layer.ts`:
```ts
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
```
`lib/scroll/use-reveal.ts`:
```ts
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
    mm.add('(prefers-reduced-motion: reduce)', () => { gsap.set(targets, { opacity: 1, y: 0 }) })
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tween = gsap.fromTo(targets, { opacity: 0, y },
        { opacity: 1, y: 0, duration: 0.8, stagger, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 75%' } })
      return () => { tween.scrollTrigger?.kill(); tween.kill() }
    })
    return () => mm.revert()
  }, [ref, y, stagger])
}
```
- [ ] **Step 6: tsc + commit.**
Run: `pnpm tsc --noEmit` → Expected: 0 errors.
```bash
rtk git add lib/scroll/parallax-math.ts lib/scroll/parallax-math.test.ts lib/scroll/use-parallax-layer.ts lib/scroll/use-reveal.ts
rtk git commit -m "feat(lp): depth-parallax + scroll-reveal foundation (reduced-motion aware)"
```

---

## Section task template (applies to Tasks 5–13)

Each section task follows the same shape. **Invoke `frontend-design` first.** Build the component + CSS Module under the LP tokens, consume the section's `landing.*` keys via `useI18n()`, mark animated children with `data-reveal`, call `useReveal` (and `useParallaxLayer` on background-typography/parallax layers), then verify.

Per-task steps:
- [ ] Invoke `frontend-design` and decide the section's layout/typography/motion within the spec's rules.
- [ ] Create `components/marketing/sections/<Name>.tsx` (`'use client'`) + `.module.css`. Use `const { t } = useI18n()`. Headline uses `var(--lp-serif)`; body uses `var(--lp-sans)`. Wrap animated nodes with `data-reveal`. Section root gets `id` (kebab of name) for in-page anchors.
- [ ] Temporarily render it in `LandingPage.tsx` (added incrementally) and run `pnpm build` → Expected: success.
- [ ] Playwright visual check at the user's viewport (`{ width: 1489, height: 679 }`, `deviceScaleFactor: 2.58`) AND majority viewport (`1920×1080`, `dsf: 2`): screenshot + assert the headline text and that `[data-reveal]` nodes reach `opacity: 1` after scrolling into view (getComputedStyle). State which viewport each screenshot is.
- [ ] `rtk git add` the two files (+ LandingPage edit) and commit `feat(lp): <name> section`.

Reference reveal wiring (every section uses this pattern):
```tsx
const ref = useRef<HTMLElement>(null)
useReveal(ref)
return (
  <section id="problem" ref={ref} className={styles.section}>
    <h2 data-reveal className={styles.headline}>{t('landing.problem.headline')}</h2>
    <p data-reveal className={styles.body}>{t('landing.problem.body')}</p>
  </section>
)
```

### Task 5: Hero section (`Hero.tsx`)
- Layered: background serif keyword layer (`useParallaxLayer(bgRef, 120)`) slowly drifting; foreground layer of 4–6 curated `DEMO_COLLAGE` cards floating and partially occluding the big type. Headline `t('landing.hero.headline')` in large serif, `label`, `subtitle`, primary CTA `Link href="/board"` = `ctaPrimary`, ghost button scrolling to `#save` = `ctaGhost`, `scrollHint` at bottom. White ground.
- Verify the depth effect: background type partially behind foreground cards (z-index layering), parallax offset present at non-reduced motion.

### Task 6: Problem section (`Problem.tsx`)
- Quiet editorial statement. Large serif `headline`, soft-ink `body`. Generous whitespace, minimal elements. One subtle accent mark (`--lp-accent`) allowed.

### Task 7: Save-anywhere section (`SaveAnywhere.tsx`)
- `headline` + `body`. Show variety of sources as distinct card shapes (tweet/video/article/image) using `DEMO_COLLAGE` + **one real YouTube card** from `DEMO_YOUTUBE` rendered as a static thumbnail (use `getYoutubeThumb` / a poster `<img>`, NOT an autoplaying iframe here — this section is about "it all comes in", not playback). Simple labeled chips. No license-unsafe third-party logos; use generic glyphs/text for the others.

### Task 8: Arrange section (`Arrange.tsx`)
- The "real product board" moment. Reuse the real board card look (mirror the board card styling) populated with `DEMO_COLLAGE` content **plus one real YouTube card** (thumbnail with a small play affordance, matching `VideoThumbCard` styling) — a multi-color, multi-style masonry that hints the board holds real video too. `headline` + `body`. This is the completed-collage hero of the page.

### Task 9: Alive section (`Alive.tsx`) — multi-playback showcase (REAL motion)
- The wow moment; transitional darker tint (not full black). `headline` + `body`. **Actually plays multiple things at once** — this is the hybrid the user approved:
  - **Main wall = 3–4 royalty-free loop `<video>`** from `DEMO_VIDEOS`: `muted loop playsInline preload="none"`, `poster` set, autoplay **only while in viewport** (IntersectionObserver: `play()` on enter, `pause()` on leave) to protect perf and battery.
  - **Plus one real YouTube** from `DEMO_YOUTUBE` rendered via the product's own `YouTubeEmbed` with `autoStart muted` (so it autoplays muted, **loops**, and hides player chrome via `controls=0&modestbranding=1` — the component already does this in its `muted` branch). Pass `onUnplayable` to fall back to the poster if the embed is restricted. This proves real video plays on the board, using the actual product component.
  - Cap concurrently-playing media at ~4. **Reduced motion (`prefers-reduced-motion: reduce`): show posters only**, no autoplay (`<video>` without autoplay; do not mount the YouTube iframe — render its poster instead).
  - Document the approach in the section file header comment.
- **Interfaces consumed:** `YouTubeEmbed` from `@/components/board/embeds/YouTubeEmbed` — props `{ videoId, title, vertical, thumbnail, aspectRatio, autoStart, muted, onUnplayable }` (see component). `getYoutubeThumb` from `@/lib/embed/youtube-thumb` for posters.

### Task 10: Customize section (`Customize.tsx`)
- `headline` + `body`. Visualize theme switching (swatches), size tuning, tags/filter. Copy already signals "more themes on the way" — keep visuals theme-agnostic (do not brand around the sound-wave default).

### Task 11: Share section (`ShareIt.tsx`)
- `headline` + `body`. Show "export as image" + "share link" idea (a framed collage thumbnail with a share affordance). Keep it suggestive, not a functional widget.

### Task 12: Trust section (`Trust.tsx`)
- `headline` + `body`. Short, calm, reassuring. Three plain facts (no account / local data / free) as quiet typographic rows. ¥0 framing if any price is shown (Japanese yen only — but here it's "free").

### Task 13: Dark CTA section (`DarkCta.tsx`)
- The white→black transition + final CTA. Background animates from `--lp-bg` to near-black driven by a ScrollTrigger on this section (transform/opacity of an overlay layer, not layout). `headline` (`landing.cta.headline`) in light ink, primary button `landing.cta.button` → `Link href="/board"`. Ground becomes black so entry into the (black) app is seamless. Reduced motion: start already on the dark end-state.

---

## Task 14: Header/Footer reskin + LandingPage orchestration + delete old sections

**Files:**
- Modify: `components/marketing/LandingPage.tsx`, `SiteHeader.tsx` (+css), `SiteFooter.tsx` (+css)
- Delete: the 6 old section files (+ their css) listed in File Structure.

**Interfaces:**
- Consumes: all 9 new section components; `landing.footer.*` keys.

- [ ] **Step 1: Reskin SiteHeader** to white editorial (transparent over hero, gains hairline + bg on scroll). Keep existing nav links/routes. Use `var(--lp-serif)` for the wordmark if appropriate, `--lp-accent` for the active/hover mark.
- [ ] **Step 2: Reskin SiteFooter** to the dark end-ground (continues the DarkCta black), nav labels from `t('landing.footer.*')`, links unchanged.
- [ ] **Step 3: Rewrite `LandingPage.tsx`** to import `./landing-tokens.css`, put `className={styles.lpRoot}` (mapped to `.lpRoot` — or add `lpRoot` to LandingPage.module.css composing the token class), keep `useSmoothScroll()` + `useScrollTrigger()`, and render in order: `SiteHeader, Hero, Problem, SaveAnywhere, Arrange, Alive, Customize, ShareIt, Trust, DarkCta, SiteFooter`.
```tsx
return (
  <div className={`${styles.wrapper} lpRoot`}>
    <SiteHeader />
    <Hero /><Problem /><SaveAnywhere /><Arrange /><Alive />
    <Customize /><ShareIt /><Trust /><DarkCta />
    <SiteFooter />
  </div>
)
```
(Ensure `landing-tokens.css` `.lpRoot` class is applied; import it at top of LandingPage.)
- [ ] **Step 4: Delete the 6 old section files** (HeroSection, SaveDemoSection, CollageDemoSection, StyleSwitchSection, ShareDemoSection, CtaSection + their `.module.css`). Grep to confirm no remaining imports:
Run: `pnpm tsc --noEmit`
Expected: 0 errors (no dangling imports).
- [ ] **Step 5: Full build.**
Run: `pnpm build`
Expected: success, `out/` generated.
- [ ] **Step 6: Commit.**
```bash
rtk git add components/marketing
rtk git commit -m "feat(lp): white editorial header/footer + orchestrate 9 sections, remove old LP"
```

---

## Task 15: Full verification + deploy

- [ ] **Step 1: Gate.**
Run: `pnpm tsc --noEmit && pnpm vitest run && pnpm build`
Expected: tsc 0, all tests pass, build OK.
- [ ] **Step 2: Playwright full-page pass** at both viewports (1489/2.58 and 1920/2): scroll top→bottom, screenshot each section, confirm white→black transition lands on black before the app link, confirm reduced-motion variant (emulate `prefers-reduced-motion: reduce`) shows all content static. Save screenshots; report which viewport each is.
- [ ] **Step 3: Deploy.**
```bash
pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```
- [ ] **Step 4: User confirmation.** Ask the user to hard-reload `https://allmarks.app` and review the LP on their screen.
- [ ] **Step 5: Update docs.** TODO.md "現在の状態", CURRENT_GOAL.md (next = i18n layer-2 / onboarding), dashboard; commit.

---

## Self-Review

**Spec coverage:**
- §1 visual system → Tasks 1 (tokens/font), 4 (parallax/reveal), 5–13 (white sections, accent, depth, dark transition). ✓
- §2 nine-section narrative → Tasks 5–13, one per section. ✓
- §3a assets → Task 3. §3b tech/perf → Tasks 1,4,14 + Task 9 perf note + Task 15 verify. §3c copy/languages → Task 2 (en baseline + ja, `landing.*`, user checkpoint). ✓
- §4 verification → Task 15 (tsc/vitest/build/playwright both viewports/deploy/user confirm). ✓
- §5 open items: serif/mincho choice → Task 1 + frontend-design in sections; JP mincho deferred (Fraunces latin first; JP headline uses Geist/system unless a subset mincho is added during a section task — acceptable, copy still renders). Multi-playback representation → Task 9 explicit choice. Header/footer integration → Task 14. ✓

**Placeholder scan:** No "TBD/TODO/handle edge cases". Section tasks reference the fully-defined `useReveal`/`useParallaxLayer`/`DEMO_COLLAGE`/`landing.*` from Tasks 2–4 (DRY, not undefined). ✓

**Type consistency:** `parallaxY`, `useParallaxLayer`, `useReveal`, `DemoAsset`/`DEMO_COLLAGE` names used consistently across tasks. i18n keys in Task 2 match the `t('landing.*')` calls in Tasks 5–14. ✓

**Note (intentional, not a gap):** Japanese mincho for headlines is not force-added in this plan (perf risk per spec §3b/§5); if a section wants it, add a subset JP serif during that section task under frontend-design. The plan ships with Fraunces (latin) + Geist, which renders both languages correctly.
