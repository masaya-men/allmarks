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
- `components/marketing/sections/Features.tsx` (+ `.module.css`)  ← editorial 01–05 sequence; 03 LIVE GRID plays real video
- `components/marketing/sections/ShareIt.tsx` (+ `.module.css`)
- `components/marketing/sections/FinalCta.tsx` (+ `.module.css`)  ← white→black transition
- `public/marketing/collage/` — optimized WebP demo assets
- `docs/marketing-asset-licenses.md` — provenance + license record
- `messages/landing-parity.test.ts` — en/ja landing key parity test
- `lib/marketing/demo-collage.test.ts`, `lib/scroll/parallax-math.test.ts`

**Modify:**
- `app/layout.tsx` — add serif display font via next/font/google (`--font-serif-display`)
- `messages/en.json`, `messages/ja.json` — add `landing` namespace
- `components/marketing/LandingPage.tsx` — orchestrate the 5 new sections + import tokens
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
    "label": "Visual Bookmark Manager",
    "headline": "Turn links into a visual board.",
    "description": "Save videos, social posts, articles, and images in one click, then arrange them freely. Turn a plain list of text into an inspiration board you grasp at a glance. No sign-up, completely free.",
    "ctaPrimary": "Open the board",
    "ctaGhost": "See how it works",
    "scrollHint": "scroll"
  },
  "problem": {
    "headline": "You pile them up and never look again.",
    "body": "A bland column of blue links. Timelines you only scroll past. Don't let what you save get buried in a wall of text."
  },
  "features": {
    "capture": {
      "title": "One click, from anywhere.",
      "body": "Posts on X, YouTube videos, articles, shops, images — send them straight to your board via the extension, the bookmarklet, or a pasted URL."
    },
    "layout": {
      "title": "Arrange it freely.",
      "body": "Drag and drop to set size and position exactly how you like."
    },
    "live": {
      "title": "Play several videos at once.",
      "body": "Videos across your board move together — not a list of stills, but a board that's actually alive."
    },
    "organize": {
      "title": "Tag to sort. Theme to restyle.",
      "body": "Filter by tag, and switch the whole look with themes. More themes are on the way."
    },
    "privacy": {
      "title": "No account. Fully local.",
      "body": "Everything is saved only inside your browser. Nothing is sent to a server. Your privacy stays yours."
    }
  },
  "share": {
    "headline": "Share it as one board.",
    "body": "Export your finished board as an image, or share a link — your exact layout arrives just as you made it."
  },
  "cta": {
    "headline": "Start building your board.",
    "button": "Start now — no sign-up"
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
    "label": "Visual Bookmark Manager",
    "headline": "リンクを、ビジュアルボードに。",
    "description": "動画、SNS、記事、画像をワンクリックで保存し、自由にコラージュ。ただの文字リストを、一目でわかるインスピレーションボードに変える。登録不要・完全無料。",
    "ctaPrimary": "ボードを開く",
    "ctaGhost": "使い方を見る",
    "scrollHint": "scroll"
  },
  "problem": {
    "headline": "溜めるだけで、見返さない。",
    "body": "味気ない青いリンクの羅列。スクロールして終わるタイムライン。あなたのインプットを、文字の山に埋もれさせない。"
  },
  "features": {
    "capture": {
      "title": "どこからでも、ワンクリック。",
      "body": "Xの投稿、YouTube動画、技術記事、ショップ、画像。拡張機能、ブックマークレット、URL貼り付けで瞬時にボードへ。"
    },
    "layout": {
      "title": "自由なコラージュ配置。",
      "body": "ドラッグ＆ドロップでサイズと位置を自由自在に調整。"
    },
    "live": {
      "title": "複数の動画を、同時再生。",
      "body": "ボード上の動画が一斉に動き出す。静止画のリストではない、動的なビジュアルボード。"
    },
    "organize": {
      "title": "タグで整理、テーマで着替え。",
      "body": "タグで絞り込み、見た目はテーマで切り替え。テーマはこれからも増えていく。"
    },
    "privacy": {
      "title": "登録不要。ローカル完結。",
      "body": "データはすべてあなたのブラウザ内（ローカル）にのみ保存。サーバーへのデータ送信なし。プライバシーを完全保護。"
    }
  },
  "share": {
    "headline": "1枚のボードとして、共有。",
    "body": "完成したボードは画像としてエクスポート可能。リンクで共有すれば、あなたが作った配置のまま相手に届く。"
  },
  "cta": {
    "headline": "さあ、ボードを作ろう。",
    "button": "今すぐ始める（登録不要）"
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
- [ ] **Step 2: Source 3 public-domain looping video clips from NASA Image and Video Library** (`images-api.nasa.gov` — all NASA media is public domain, direct-download, no key, no attribution required). Choose **visually striking, atmospheric** clips (e.g. aurora, Earth from orbit, nebula timelapse, fluid/plasma) that look beautiful muted and looping. Download the mp4 asset, transcode with **ffmpeg** to ≤720p / low bitrate / no audio, trim to ≤10s, and extract a WebP poster of a representative frame (ffmpeg → png → sharp → webp).
- [ ] **Step 2b: (optional this task) rights-clean real YouTube IDs.** `DEMO_YOUTUBE` may stay EMPTY in this task — the real-motion requirement is already met by the NASA video files above. If a rights-clean public-domain YouTube ID (e.g. NASA channel) can be **validated via the oEmbed endpoint** (`https://www.youtube.com/oembed?url=https://youtu.be/<id>&format=json` returns 200 + title), include it; otherwise leave `DEMO_YOUTUBE = []` and it will be sourced/validated in Task 8. Do NOT invent IDs — only include IDs confirmed via oEmbed.
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
  it('any YouTube entries are well-formed + rights-clean (may be empty this task)', () => {
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

## Section task template (applies to Tasks 5–10)

Each section task follows the same shape. **Invoke `frontend-design` first.** Build the component + CSS Module under the LP tokens (`.lpRoot` vars), consume the section's `landing.*` keys via `useI18n()`, mark animated children with `data-reveal`, call `useReveal` (and `useParallaxLayer` on background-typography layers), then verify.

Per-task steps:
- [ ] Invoke `frontend-design` and decide the section's layout/typography/motion within the spec's rules.
- [ ] Create `components/marketing/sections/<Name>.tsx` (`'use client'`) + `.module.css`. Use `const { t } = useI18n()`. Headline/title uses `var(--lp-serif)`; body uses `var(--lp-sans)`. Wrap animated nodes with `data-reveal`. Section root gets an `id` for in-page anchors.
- [ ] Temporarily render it in `LandingPage.tsx` (added incrementally) and run `pnpm build` → Expected: success.
- [ ] Playwright visual check at the user's viewport (`{ width: 1489, height: 679 }`, `deviceScaleFactor: 2.58`) AND majority viewport (`1920×1080`, `dsf: 2`): screenshot + assert the title text and that `[data-reveal]` nodes reach `opacity: 1` after scrolling into view (getComputedStyle). State which viewport each screenshot is.
- [ ] `rtk git add` the files (+ LandingPage edit) and commit `feat(lp): <name> section`.

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

**FEATURES presentation rule (Tasks 7–8):** the 5 features are a numbered editorial SEQUENCE (01–05), **NOT a boxed SaaS grid**. Each feature is its own full-width editorial beat: generous whitespace, a small mono kicker = `NN` + English label (`CAPTURE`/`LAYOUT`/`LIVE GRID`/`ORGANIZE`/`PRIVACY`), a serif title, a sans body, revealed on scroll. **Numbers + English labels are hardcoded in the component** (UI English vocabulary — not translated). Only `title`/`body` come from i18n.

### Task 5: Hero section (`Hero.tsx`)
- keys: `landing.hero.{label, headline, description, ctaPrimary, ctaGhost, scrollHint}`.
- Layered depth: background serif keyword layer (`useParallaxLayer(bgRef, 120)`) slowly drifting; foreground layer of 4–6 curated `DEMO_COLLAGE` cards floating and partially occluding the big type. `label` (mono kicker), `headline` (large serif), `description` (sans), primary CTA `Link href="/board"` = `ctaPrimary`, ghost button scrolling to `#features` = `ctaGhost`, `scrollHint` at bottom. White ground.
- Verify the depth effect: background type partially behind foreground cards (z-index layering), parallax offset present at non-reduced motion.

### Task 6: Problem section (`Problem.tsx`)
- keys: `landing.problem.{headline, body}`. Quiet editorial statement. Large serif `headline`, soft-ink `body`. Generous whitespace, minimal elements. One subtle accent mark (`--lp-accent`) allowed.

### Task 7: Features section — 4 static features + section shell (`Features.tsx`)
- Section root `id="features"`. Render the numbered editorial sequence with the 5 features in order (01 CAPTURE, 02 LAYOUT, 03 LIVE GRID, 04 ORGANIZE, 05 PRIVACY). In THIS task, build all five beats but render the **03 LIVE GRID** beat with a **static poster placeholder** (`DEMO_VIDEOS[0].poster` as an `<img>`); Task 8 swaps it to real playback.
  - keys: `landing.features.{capture,layout,live,organize,privacy}.{title, body}`. Hardcode numbers + English labels.
  - **01 CAPTURE:** show source variety (X / YouTube / article / image) via `DEMO_COLLAGE` + one real YouTube **thumbnail** (`getYoutubeThumb`, static `<img>`, no iframe here) + generic glyphs/labels.
  - **02 LAYOUT:** the "real product board" beat — mirror the real board card styling populated with `DEMO_COLLAGE` (multi-color/multi-style masonry).
  - **03 LIVE GRID (poster slot):** `DEMO_VIDEOS[0].poster` static `<img>` with the `03` / `LIVE GRID` label + `live.title`/`live.body`. Mark the slot (e.g. `data-livegrid-slot`) so Task 8 can find it.
  - **04 ORGANIZE:** visualize tag filter + theme swatches (theme-agnostic; copy signals more themes coming — do not brand around the sound-wave default).
  - **05 PRIVACY:** short reassurance, plain typographic rows (no account / local / free).

### Task 8: LIVE GRID real moving video (`Features.tsx` 03 slot)
- Replace the 03 slot's static poster with REAL playback (the hybrid the user approved):
  - **2–3 royalty-free loop `<video>`** from `DEMO_VIDEOS`: `muted loop playsInline preload="none"`, `poster` set, autoplay **only while in viewport** (IntersectionObserver: `play()` on enter, `pause()` on leave).
  - **Plus one real YouTube** from `DEMO_YOUTUBE` via the product's own `YouTubeEmbed` with `autoStart muted` (autoplays muted, **loops**, hides chrome via `controls=0&modestbranding=1` — already done in the component's `muted` branch). `onUnplayable` → poster fallback.
  - Cap concurrently-playing media at ~4. **Reduced motion:** posters only, no autoplay, do NOT mount the YouTube iframe (render its poster).
  - Document the approach in a file header comment.
- **Interfaces consumed:** `YouTubeEmbed` from `@/components/board/embeds/YouTubeEmbed` — props `{ videoId, title, vertical, thumbnail, aspectRatio, autoStart, muted, onUnplayable }`. `getYoutubeThumb` from `@/lib/embed/youtube-thumb`.

### Task 9: Share section (`ShareIt.tsx`)
- keys: `landing.share.{headline, body}`. Show "export as image" + "share link" idea (a framed collage thumbnail with a share affordance). Suggestive, not a functional widget.

### Task 10: Final CTA section (`FinalCta.tsx`) — white→black transition
- keys: `landing.cta.{headline, button}`. Background animates from `--lp-bg` to near-black driven by a ScrollTrigger on this section (overlay opacity, not layout). `headline` in light ink, primary button `button` → `Link href="/board"`. Ground becomes black so entry into the (black) app is seamless. Reduced motion: start already on the dark end-state.

---

## Task 11: Header/Footer reskin + LandingPage orchestration + delete old sections

**Files:**
- Modify: `components/marketing/LandingPage.tsx`, `SiteHeader.tsx` (+css), `SiteFooter.tsx` (+css)
- Delete: the 6 old section files (+ their css) listed in File Structure.

**Interfaces:**
- Consumes: the new section components (`Hero, Problem, Features, ShareIt, FinalCta`); `landing.footer.*` keys.

- [ ] **Step 1: Reskin SiteHeader** to white editorial (transparent over hero, gains hairline + bg on scroll). Keep existing nav links/routes. Use `var(--lp-serif)` for the wordmark if appropriate, `--lp-accent` for the active/hover mark.
- [ ] **Step 2: Reskin SiteFooter** to the dark end-ground (continues the FinalCta black), nav labels from `t('landing.footer.*')`, links unchanged.
- [ ] **Step 3: Rewrite `LandingPage.tsx`** to import `./landing-tokens.css`, apply the `lpRoot` token class on the wrapper, keep `useSmoothScroll()` + `useScrollTrigger()`, and render in order: `SiteHeader, Hero, Problem, Features, ShareIt, FinalCta, SiteFooter`.
```tsx
return (
  <div className={`${styles.wrapper} lpRoot`}>
    <SiteHeader />
    <Hero /><Problem /><Features /><ShareIt /><FinalCta />
    <SiteFooter />
  </div>
)
```
(Ensure `landing-tokens.css` `.lpRoot` class is applied; import it at top of LandingPage.)
- [ ] **Step 4: Delete the 6 old section files** (HeroSection, SaveDemoSection, CollageDemoSection, StyleSwitchSection, ShareDemoSection, CtaSection + their `.module.css`). Confirm no remaining imports:
Run: `pnpm tsc --noEmit`
Expected: 0 errors (no dangling imports).
- [ ] **Step 5: Full build.**
Run: `pnpm build`
Expected: success, `out/` generated.
- [ ] **Step 6: Commit.**
```bash
rtk git add components/marketing
rtk git commit -m "feat(lp): white editorial header/footer + orchestrate sections, remove old LP"
```

---

## Task 12: Full verification + deploy

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

**Spec coverage (revised to 6-block structure):**
- §1 visual system → Tasks 1 (tokens/font), 4 (parallax/reveal), 5–10 (white sections, accent, depth, dark transition). ✓
- §2 six-block structure (HERO / PROBLEM / FEATURES[01–05] / SHARE / FINAL CTA + footer) → Task 5 Hero, Task 6 Problem, Tasks 7–8 Features (4 static + LIVE GRID real video), Task 9 Share, Task 10 Final CTA, Task 11 footer. FEATURES is an editorial sequence, not a SaaS grid. ✓
- §3a assets → Task 3. §3b tech/perf → Tasks 1,4,11 + Task 8 perf note + Task 12 verify. §3c copy/languages → Task 2 (en baseline + ja, `landing.*`, controller-owned user checkpoint — DONE, user adopted own minimal copy + ORGANIZE feature). ✓
- §4 verification → Task 12 (tsc/vitest/build/playwright both viewports/deploy/user confirm). ✓
- §5 open items: serif/mincho choice → Task 1 + frontend-design in sections; JP mincho deferred (Fraunces latin first; JP headline uses Geist/system unless a subset mincho is added during a section task — acceptable, copy still renders). Real moving video → Task 8 (royalty-free loops + rights-clean YouTube via product `YouTubeEmbed`). Header/footer integration → Task 11. ✓

**Placeholder scan:** No "TBD/TODO/handle edge cases". Section tasks reference the fully-defined `useReveal`/`useParallaxLayer`/`DEMO_COLLAGE`/`landing.*` from Tasks 2–4 (DRY, not undefined). ✓

**Type consistency:** `parallaxY`, `useParallaxLayer`, `useReveal`, `DemoAsset`/`DEMO_COLLAGE` names used consistently across tasks. i18n keys in Task 2 match the `t('landing.*')` calls in Tasks 5–14. ✓

**Note (intentional, not a gap):** Japanese mincho for headlines is not force-added in this plan (perf risk per spec §3b/§5); if a section wants it, add a subset JP serif during that section task under frontend-design. The plan ships with Fraunces (latin) + Geist, which renders both languages correctly.
