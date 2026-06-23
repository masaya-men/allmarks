// scripts/generate-placeholder-art.mjs
// ──────────────────────────────────────────────────────────────────────────
// Generates the brand placeholder BACKGROUND art for thumbnail-less text cards
// as static SVG files. Run once and commit the output; re-run to regenerate, or
// add a new palette entry to emit a whole theme's set.
//
//   node scripts/generate-placeholder-art.mjs
//
// Output: public/placeholders/art/<paletteId>/<style>.svg   (6 files per theme)
//
// Each file is BACKGROUND ART ONLY — no title, no scrim, no border, no rounded
// clip. PlaceholderCard supplies the dark scrim gradient, the centred title and
// the rounded corners (overflow:hidden). So this art must only be "the picture
// behind the glass".
//
// Geometry: landscape viewBox 600×480 = 5:4 = exactly PLACEHOLDER_ASPECT (1.25),
// so CSS `background-size: cover` on the card never crops it. Vector → crisp at
// any zoom (the lightbox blows a ~250px card up to ~893px).
//
// Palette: dark backgrounds + heavily restrained green. The green is the brand
// signal (#28F100, the logo check) but kept quiet via `greenIntensity` so the
// cards do NOT float on a board among photo cards and stay legible under the
// card's existing scrim. Styles are the 6 the user approved in the mockups:
// 1 音波バー / 2 オーロラ / 3 波形ライン / 4 グレイン+波 / 5 波紋 / 6 ドット.
// ──────────────────────────────────────────────────────────────────────────

import { mkdirSync, writeFileSync } from 'node:fs'

const W = 600
const H = 480

// Default brand palette. A future theme passes its own palette object to emit a
// matching set (same 6 styles, different colours / intensity).
const DEFAULT_PALETTE = {
  id: 'default',
  green: '#28F100',
  greenDark: '#1a9e00',
  bg: '#0a0a0f',
  // Global multiplier applied to every green accent's opacity. 1.0 = the mockup
  // intensity; lower = quieter. 0.6 keeps the brand green present but muted so a
  // text card reads as "dark texture", not "bright green tile".
  greenIntensity: 0.6,
}

// Seeded PRNG (same mulberry32 variant as the approved mockup) so output is
// deterministic / reproducible across runs.
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const i0 = (x) => Math.round(x) // integer coordinate (compact markup)
const d1 = (x) => Math.round(x * 10) / 10 // 1-decimal

// Each style returns the inner SVG markup for a W×H card. p = palette.
const STYLES = {
  // 1 音波バー — a centred audio-waveform of rounded bars; every 6th bar is the
  // brand green, the rest faint white.
  waveform(p, seed) {
    const r = rng(seed)
    const gA = 0.7 * p.greenIntensity
    let bars = ''
    const n = Math.round(W / 8)
    const gap = W / n
    const midY = H * 0.52
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const env = Math.sin(t * Math.PI)
      const bh = 8 + (0.5 + 0.5 * Math.sin(t * 20 + r() * 3)) * env * H * 0.42
      const x = i * gap + gap * 0.25
      const bw = gap * 0.5
      const acc = i % 6 === 3
      bars += `<rect x="${i0(x)}" y="${i0(midY - bh / 2)}" width="${i0(bw)}" height="${i0(bh)}" rx="${i0(bw / 2)}" fill="${acc ? p.green : '#fff'}" opacity="${acc ? d1(gA) : 0.12}"/>`
    }
    return `<rect width="${W}" height="${H}" fill="${p.bg}"/>${bars}`
  },

  // 2 オーロラ — soft overlapping radial glows, mostly deep green/teal.
  aurora(p) {
    const id = 'au'
    return (
      `<defs>` +
      `<radialGradient id="${id}1" cx="32%" cy="34%" r="58%"><stop offset="0%" stop-color="#0f4a30" stop-opacity="${d1(0.8 * p.greenIntensity + 0.1)}"/><stop offset="100%" stop-color="#0f4a30" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="${id}2" cx="74%" cy="72%" r="52%"><stop offset="0%" stop-color="${p.greenDark}" stop-opacity="${d1(0.4 * p.greenIntensity)}"/><stop offset="100%" stop-color="${p.greenDark}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="${id}3" cx="60%" cy="18%" r="60%"><stop offset="0%" stop-color="#16242b" stop-opacity="0.7"/><stop offset="100%" stop-color="#16242b" stop-opacity="0"/></radialGradient>` +
      `</defs>` +
      `<rect width="${W}" height="${H}" fill="#07090a"/><rect width="${W}" height="${H}" fill="url(#${id}3)"/><rect width="${W}" height="${H}" fill="url(#${id}1)"/><rect width="${W}" height="${H}" fill="url(#${id}2)"/>`
    )
  },

  // 3 波形ライン — stacked oscilloscope sine lines, the middle one green.
  oscillo(p, seed) {
    const r = rng(seed)
    const gA = 0.55 * p.greenIntensity
    let path = ''
    const lines = 6
    for (let li = 0; li < lines; li++) {
      const amp = 18 + li * 6 + r() * 8
      const ph = li * 0.9 + r()
      const yB = H * (0.18 + li * 0.12)
      let d = `M0 ${i0(yB)}`
      for (let x = 0; x <= W; x += 8) {
        d += ` L${x} ${i0(yB + Math.sin(x / 34 + ph) * amp * Math.sin((x / W) * Math.PI))}`
      }
      const g = li === 2
      path += `<path d="${d}" fill="none" stroke="${g ? p.green : '#fff'}" stroke-width="${g ? 1.6 : 1}" opacity="${g ? d1(gA) : 0.1}"/>`
    }
    return `<rect width="${W}" height="${H}" fill="${p.bg}"/>${path}`
  },

  // 4 グレイン+波 — fine white speckle grain + one green crest line.
  grain(p, seed) {
    const r = rng(seed)
    const gA = 0.7 * p.greenIntensity
    let dots = ''
    const N = Math.round((W * H) / 200)
    for (let i = 0; i < N; i++) {
      dots += `<circle cx="${i0(r() * W)}" cy="${i0(r() * H)}" r="${d1(0.5 + r() * 0.8)}" fill="#fff" opacity="${d1(0.02 + r() * 0.08)}"/>`
    }
    let d = `M0 ${i0(H * 0.62)}`
    for (let x = 0; x <= W; x += 6) {
      d += ` L${x} ${i0(H * 0.62 + Math.sin(x / 28 + r()) * H * 0.07 * Math.sin((x / W) * Math.PI))}`
    }
    return `<rect width="${W}" height="${H}" fill="#0c0c0e"/>${dots}<path d="${d}" fill="none" stroke="${p.green}" stroke-width="2" opacity="${d1(gA)}"/>`
  },

  // 5 波紋 — concentric ripples radiating from the lower-left, inner rings green.
  ripple(p) {
    const gA = 0.42 * p.greenIntensity
    let rings = ''
    const ox = W * 0.2
    const oy = H * 0.9
    const step = Math.max(26, W / 8)
    for (let i = 1; i <= 18; i++) {
      const rad = (i * step) / 2.2
      const g = i <= 3
      rings += `<circle cx="${i0(ox)}" cy="${i0(oy)}" r="${i0(rad)}" fill="none" stroke="${g ? p.green : '#fff'}" stroke-width="${g ? 1.4 : 0.9}" opacity="${g ? d1(gA) : 0.09}"/>`
    }
    return `<rect width="${W}" height="${H}" fill="${p.bg}"/>${rings}`
  },

  // 6 ドット — halftone dot grid growing toward the lower-right, sparse green.
  dots(p) {
    const gA = 0.65 * p.greenIntensity
    let d = ''
    const cols = Math.round(W / 22)
    const rows = Math.round(H / 22)
    const dx = W / cols
    const dy = H / rows
    for (let c = 0; c < cols; c++) {
      for (let rr = 0; rr < rows; rr++) {
        const t = (c / cols) * 0.5 + (rr / rows) * 0.5
        const g = (c * 7 + rr * 3) % 41 === 0
        d += `<circle cx="${i0(dx * (c + 0.5))}" cy="${i0(dy * (rr + 0.5))}" r="${d1(0.8 + t * 2.4)}" fill="${g ? p.green : '#fff'}" opacity="${g ? d1(gA) : d1(0.05 + t * 0.16)}"/>`
      }
    }
    return `<rect width="${W}" height="${H}" fill="${p.bg}"/>${d}`
  },
}

const STYLE_ORDER = ['waveform', 'aurora', 'oscillo', 'grain', 'ripple', 'dots']

// Fixed per-style seeds → reproducible output.
const SEEDS = { waveform: 101, aurora: 211, oscillo: 307, grain: 419, ripple: 523, dots: 631 }

function fileSvg(style, p) {
  const inner = STYLES[style](p, SEEDS[style])
  // Explicit width/height give the SVG an intrinsic size so it rasterises
  // correctly when drawn into a <canvas> (the share OG path) and as an <img>.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`
}

function emit(palette) {
  const dir = `public/placeholders/art/${palette.id}`
  mkdirSync(dir, { recursive: true })
  for (const style of STYLE_ORDER) {
    const svg = fileSvg(style, palette)
    writeFileSync(`${dir}/${style}.svg`, svg)
    console.log(`wrote ${dir}/${style}.svg (${svg.length} bytes)`)
  }
}

emit(DEFAULT_PALETTE)
