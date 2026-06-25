// scripts/generate-paper-ink-splat.mjs
// ──────────────────────────────────────────────────────────────────────────
// Generates the paper-atelier DARK INK-SPLAT stain assets — the scattered
// "spilled ink / coffee splatter" marks for the MIDDLE parallax layer. Run
// once and commit the output:
//
//   node scripts/generate-paper-ink-splat.mjs
//
// Output: public/themes/paper-atelier/ink-splat-1.png, -2.png, -3.png
//
// Why: the existing decor-ring-* / decor-flourish-* stains are GOLD on cream —
// almost invisible, so the parallax can't be FELT (you can't perceive motion of
// a layer you can't see). The user wants dark ink splatters (real stains). These
// are warm AGED ink (#3a2a1c, NOT harsh black) so they read as soft taupe-grey
// on the cream parchment at the layer's render opacity — visible but tasteful.
//
// Construction is PURE SEEDED GEOMETRY (overlapping circles → organic blob +
// flung droplets + fine spatter dust). No SVG filters (feTurbulence /
// feDisplacementMap), so it rasterises reliably through sharp/librsvg in any
// environment. ZERO per-frame cost downstream: a static PNG drawn once by the
// compositor (board is fill-rate/composite bound at 4K — see CLAUDE.md).
// ──────────────────────────────────────────────────────────────────────────

import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const SIZE = 300 // px square; transparent base
const C = SIZE / 2

// Seeded PRNG — same mulberry32 variant as generate-paper-texture.mjs so output
// is deterministic / reproducible across runs.
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const d1 = (x) => Math.round(x * 10) / 10
const d2 = (x) => Math.round(x * 100) / 100

// Warm aged-ink tones (never pure black) for organic depth.
const INK_TONES = ['#3a2a1c', '#2e2118', '#46321f', '#241a12']

/**
 * A rounded, irregular ink LOBE: a cluster of overlapping circles around
 * (cx,cy) within `spread`, returned as one solid-fill string. Wrapped by the
 * caller in a <g opacity> so it flattens to a single organic silhouette (no
 * internal blotching). Circles → soft rounded edge = a real ink pool / stain,
 * not a spiky burst.
 */
function inkLobe(r, color, cx, cy, spread, count, rMin, rMax) {
  let s = ''
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2
    // bias toward centre (sqrt) so the mass is densest in the middle
    const dd = Math.sqrt(r()) * spread
    const x = d1(cx + Math.cos(a) * dd)
    const y = d1(cy + Math.sin(a) * dd)
    const rad = d1(rMin + r() * (rMax - rMin))
    s += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${color}"/>`
  }
  return s
}

/**
 * Build the <svg> for one ink splat. Pure: identical seed → identical string.
 *
 * Shape = a few LOBES (clusters of overlapping ink circles) around the centre
 * so the silhouette bulges irregularly like a real splat, + flung DROPLETS at
 * a distance, + fine SPATTER dust. All in warm ink over transparent.
 *
 * @param {number} seed PRNG seed (fixed when emitting; varied in tests).
 * @returns {string} a complete, self-contained <svg> string with viewBox 0 0 300 300.
 */
export function buildInkSplatSvg(seed) {
  const r = rng(seed)
  const tone = () => INK_TONES[Math.floor(r() * INK_TONES.length)]
  // Off-centre the whole mark a touch so it never reads as a tidy bullseye.
  const ox = C + (r() - 0.5) * 40
  const oy = C + (r() - 0.5) * 40

  // Density gradient via two stacked lobes: a faint, wide HALO + a darker,
  // tighter CORE on top — so the stain is deepest where the ink pooled and
  // feathers out at the edge (a real blot). Each lobe is solid circles inside a
  // <g opacity> so it flattens to one organic silhouette (no internal blotching).
  const halo = inkLobe(r, '#3a2a1c', ox, oy, 60 + r() * 12, 22, 16, 40)
  const core = inkLobe(r, '#2b1f15', ox, oy, 38 + r() * 10, 16, 14, 30)

  // ── A couple of SATELLITE splotches — smaller rounded blobs flung off-axis so
  //    the outline isn't a tidy circle.
  let sats = ''
  const satCount = 2 + Math.floor(r() * 2) // 2..3
  for (let i = 0; i < satCount; i++) {
    const a = r() * Math.PI * 2
    const dd = 50 + r() * 40
    sats += inkLobe(r, '#2b1f15', ox + Math.cos(a) * dd, oy + Math.sin(a) * dd, 14 + r() * 12, 5, 8, 18)
  }

  // ── Flung droplets: small detached blobs thrown outward (splatter signature).
  let drops = ''
  const dropCount = 10 + Math.floor(r() * 8) // 10..17
  for (let i = 0; i < dropCount; i++) {
    const a = r() * Math.PI * 2
    const dd = 66 + r() * 76 // outside the main mass
    const x = d1(ox + Math.cos(a) * dd)
    const y = d1(oy + Math.sin(a) * dd)
    const rad = d1(2 + r() * 7.5)
    drops += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${tone()}"/>`
  }

  // ── Fine spatter dust: tiny specks even further out for a real "spray" tail.
  let dust = ''
  const dustCount = 30 + Math.floor(r() * 30) // 30..59
  for (let i = 0; i < dustCount; i++) {
    const a = r() * Math.PI * 2
    const dd = 44 + r() * 100
    const x = d1(ox + Math.cos(a) * dd)
    const y = d1(oy + Math.sin(a) * dd)
    const rad = d1(0.5 + r() * 2)
    dust += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${tone()}"/>`
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<g opacity="0.4">${halo}</g>` +
    `<g opacity="0.8">${core}${sats}</g>` +
    `<g opacity="0.78">${drops}</g>` +
    `<g opacity="0.55">${dust}</g>` +
    `</svg>`
  )
}

// Fixed seeds → reproducible committed output. Three distinct splats.
const SEEDS = [4127, 90511, 33247]

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const dir = resolve(__dirname, '..', 'public', 'themes', 'paper-atelier')
  mkdirSync(dir, { recursive: true })
  for (let i = 0; i < SEEDS.length; i++) {
    const svg = buildInkSplatSvg(SEEDS[i])
    const out = resolve(dir, `ink-splat-${i + 1}.png`)
    await sharp(Buffer.from(svg)).png().toFile(out)
    console.log(`wrote ${out} (svg ${svg.length} bytes)`)
  }
}

// Only write files when run directly, not when imported by the test.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('generate-paper-ink-splat.mjs')) {
  await main()
}
