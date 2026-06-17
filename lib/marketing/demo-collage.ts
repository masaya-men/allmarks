/**
 * lib/marketing/demo-collage.ts
 *
 * Typed manifest of curated CC0 / public-domain demo assets for the LP collage.
 * All images: Art Institute of Chicago (CC0). All videos: NASA (public domain = CC0).
 * Sizes are read directly from the output files via sharp/ffprobe — do not edit by hand.
 */

export type DemoAsset = {
  /** Path relative to /public — e.g. "marketing/collage/art-aic-hokusai-wave.webp" */
  readonly src: string
  readonly w: number
  readonly h: number
  readonly kind: 'art' | 'photo'
  readonly credit: string
  readonly license: 'CC0'
}

export type DemoVideo = {
  /** Path to optimized mp4 relative to /public */
  readonly src: string
  /** Path to WebP poster frame relative to /public */
  readonly poster: string
  readonly w: number
  readonly h: number
  readonly credit: string
  readonly license: 'CC0' | 'royalty-free'
}

export type DemoYouTube = {
  readonly videoId: string
  readonly title: string
  readonly vertical: boolean
  readonly channel: string
  readonly rights: 'public-domain' | 'official-brand'
}

// ─── Images ──────────────────────────────────────────────────────────────────
// All sourced from Art Institute of Chicago (api.artic.edu), is_public_domain=true, CC0.
// Converted to WebP at max 800px edge, quality 72.

export const DEMO_COLLAGE: readonly DemoAsset[] = [
  {
    src: 'marketing/collage/art-aic-hokusai-wave.webp',
    w: 800,
    h: 549,
    kind: 'art',
    credit:
      'Under the Wave off Kanagawa (The Great Wave) — Katsushika Hokusai (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-hiroshige-tokaido.webp',
    w: 800,
    h: 512,
    kind: 'art',
    credit:
      'Mishima: Morning Mist, from Fifty-three Stations of the Tokaido — Utagawa Hiroshige (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-van-gogh-bedroom.webp',
    w: 800,
    h: 626,
    kind: 'art',
    credit: 'The Bedroom — Vincent van Gogh (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-van-gogh-selfportrait.webp',
    w: 628,
    h: 800,
    kind: 'art',
    credit: 'Self-Portrait — Vincent van Gogh (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-monet-waterlilies.webp',
    w: 800,
    h: 768,
    kind: 'art',
    credit: 'Water Lilies — Claude Monet (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-monet-stacks.webp',
    w: 800,
    h: 473,
    kind: 'art',
    credit: 'Stacks of Wheat (End of Summer) — Claude Monet (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-renoir-sisters.webp',
    w: 645,
    h: 800,
    kind: 'art',
    credit: 'Two Sisters (On the Terrace) — Pierre-Auguste Renoir (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-seurat-grande-jatte.webp',
    w: 800,
    h: 536,
    kind: 'art',
    credit:
      'A Sunday on La Grande Jatte — 1884 — Georges Seurat (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-toulouse-moulinrouge.webp',
    w: 800,
    h: 698,
    kind: 'art',
    credit:
      'At the Moulin Rouge — Henri de Toulouse-Lautrec (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-caillebotte-paris.webp',
    w: 800,
    h: 622,
    kind: 'art',
    credit: 'Paris Street; Rainy Day — Gustave Caillebotte (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-redon-flowers.webp',
    w: 547,
    h: 800,
    kind: 'art',
    credit: 'Still Life with Flowers — Odilon Redon (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-fantin-flowers.webp',
    w: 800,
    h: 648,
    kind: 'art',
    credit:
      'Still Life with Flowers — Henri Fantin-Latour (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-tiffany-lilies.webp',
    w: 282,
    h: 800,
    kind: 'art',
    credit:
      'Lilies (Corey Memorial Window) — Louis Comfort Tiffany (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-degas-ballet.webp',
    w: 800,
    h: 400,
    kind: 'art',
    credit: 'Ballet at the Paris Opéra — Edgar Degas (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-cezanne-apples.webp',
    w: 800,
    h: 639,
    kind: 'art',
    credit: 'The Basket of Apples — Paul Cézanne (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/art-aic-degas-millinery.webp',
    w: 800,
    h: 726,
    kind: 'art',
    credit: 'The Millinery Shop — Edgar Degas (Art Institute of Chicago, CC0)',
    license: 'CC0',
  },
] as const

// ─── Videos ──────────────────────────────────────────────────────────────────
// All sourced from NASA Image and Video Library (images-api.nasa.gov).
// NASA media is US government work = public domain (CC0-equivalent).
// Transcoded: libx264, crf 28, ≤720p, no audio, trimmed to 10 s, faststart.
// Posters: first readable frame → WebP q80.

export const DEMO_VIDEOS: readonly DemoVideo[] = [
  {
    src: 'marketing/collage/vid-nasa-aurora-01.mp4',
    poster: 'marketing/collage/vid-nasa-aurora-01.webp',
    w: 1280,
    h: 720,
    credit: 'STEVE Aurora Phenomenon (NASA GSFC, public domain)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/vid-nasa-earth-from-space-02.mp4',
    poster: 'marketing/collage/vid-nasa-earth-from-space-02.webp',
    w: 320,
    h: 180,
    credit: 'Earth Views from the International Space Station (NASA JSC, public domain)',
    license: 'CC0',
  },
  {
    src: 'marketing/collage/vid-nasa-nebula-03.mp4',
    poster: 'marketing/collage/vid-nasa-nebula-03.webp',
    w: 320,
    h: 212,
    credit: 'T-Nebula (NASA KSC, public domain)',
    license: 'CC0',
  },
] as const

// ─── YouTube ─────────────────────────────────────────────────────────────────
// No IDs validated via oEmbed in this task — will be sourced in Task 8.

export const DEMO_YOUTUBE: readonly DemoYouTube[] = [] as const
