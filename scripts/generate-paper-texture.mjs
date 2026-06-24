// scripts/generate-paper-texture.mjs
// ──────────────────────────────────────────────────────────────────────────
// Generates the paper-atelier FIBER TILE as a tiny, seamless, repeatable SVG.
// Run once and commit the output:
//
//   node scripts/generate-paper-texture.mjs
//
// Output: public/themes/paper-atelier/fiber.svg
//
// The tile is 160×160 and is meant to be `background-repeat` across the whole
// board canvas. It is ZERO per-frame paint cost: a static raster-able SVG drawn
// once by the compositor, NO canvas / NO GPU filter / NO backdrop-filter (the
// board is fill-rate/composite bound at 4K high-DPR — see CLAUDE.md perf rule).
//
// Look: faint cream + charcoal-ink flecks (paper fibre) over transparent, so it
// layers UNDER the parchment color (`--bg-dark: #efe6d2`) set by the
// .paperAtelier rule. Flecks are sub-pixel-ish and low-alpha so the parchment
// reads as "textured paper", never "speckled".
// ──────────────────────────────────────────────────────────────────────────

import { mkdirSync, writeFileSync } from 'node:fs'

const TILE = 160 // tile edge in px; small enough to repeat, large enough to hide seams

// Seeded PRNG — same mulberry32 variant as generate-placeholder-art.mjs (L47-55)
// so output is deterministic / reproducible across runs.
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const d1 = (x) => Math.round(x * 10) / 10 // 1-decimal (compact markup)
const d2 = (x) => Math.round(x * 100) / 100 // 2-decimal (alpha precision)

/**
 * Build the inner-markup + <svg> wrapper for the fibre tile.
 *
 * Pure: identical (seed, opts) → identical string. Two ink tones (cream
 * highlight + charcoal ink) scattered as low-alpha circles read as paper fibre.
 *
 * @param {number} seed   PRNG seed (fixed when emitting; varied in tests).
 * @param {{ speckles?: number }} [opts]  speckles = total fleck count.
 * @returns {string} a complete, self-contained <svg> string.
 */
export function buildPaperFiberSvg(seed, opts = {}) {
  const speckles = opts.speckles ?? 320
  const r = rng(seed)
  let flecks = ''
  for (let i = 0; i < speckles; i++) {
    const x = d1(r() * TILE)
    const y = d1(r() * TILE)
    const rad = d1(0.4 + r() * 0.9) // 0.4..1.3 px — fine fibre
    // ~⅓ of flecks are charcoal ink, the rest cream highlight, both very faint.
    const ink = r() < 0.34
    const color = ink ? '#2b2722' /* CHARCOAL */ : '#fffdf6' /* CREAM */
    const alpha = ink ? d2(0.03 + r() * 0.05) /* 0.03..0.08 */ : d2(0.05 + r() * 0.09) /* 0.05..0.14 */
    flecks += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${color}" opacity="${alpha}"/>`
  }
  // Explicit width/height give the SVG an intrinsic size so it rasterises
  // correctly as a CSS background-image; transparent base so the parchment
  // color from .paperAtelier shows through.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}">` +
    flecks +
    `</svg>`
  )
}

// Fixed seed → reproducible committed output.
const FIBER_SEED = 701

function main() {
  const dir = 'public/themes/paper-atelier'
  mkdirSync(dir, { recursive: true })
  const svg = buildPaperFiberSvg(FIBER_SEED)
  writeFileSync(`${dir}/fiber.svg`, svg)
  console.log(`wrote ${dir}/fiber.svg (${svg.length} bytes)`)
}

// Only write the file when run directly (`node scripts/generate-paper-texture.mjs`),
// not when imported by the test.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('generate-paper-texture.mjs')) {
  main()
}
