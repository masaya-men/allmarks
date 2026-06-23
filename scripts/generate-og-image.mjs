// scripts/generate-og-image.mjs
// Generates the default public/og.png — the 1200×630 social-preview card shown
// when allmarks.app is pasted on X / Facebook / Slack etc. (rank4). Brand:
// black canvas + the canonical AllMarks A-mark (white A + green check, the same
// shape as app/icon.svg) + wordmark + tagline + a subtle sound-wave motif.
// Run: node scripts/generate-og-image.mjs  (regenerate after editing copy/brand)
import sharp from 'sharp'
import { mkdirSync, statSync } from 'node:fs'

const W = 1200
const H = 630
const GREEN = '#28f100'
const FONT = "Segoe UI, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"

// Canonical A-mark paths (app/icon.svg / AllMarksMark.tsx), A recolored white so
// it reads on the black canvas; green check kept. viewBox 0 0 112 111.
const A_PATH = 'M52.6441 9.31894C67.4082 36.0874 86.0574 60.9154 103.159 86.5162C104.401 88.3758 105.635 90.2402 106.859 92.109C107.931 93.7454 109.002 95.3818 110.074 97.0183C113.558 102.339 109.741 109.401 103.381 109.401H59.7004C56.2986 109.401 53.2666 107.251 52.1635 104.033C44.5649 81.8666 37.6138 59.3761 28.9285 37.7528C27.7417 34.7981 24.8839 32.8661 21.6999 32.8382C17.7002 32.803 13.7004 32.7899 9.70074 32.7613C6.00914 32.7349 3.04449 29.728 3.04449 26.0363V7.34958C3.04449 3.65788 6.00914 0.651022 9.70074 0.6246C19.0949 0.557363 28.4892 0.575688 37.8834 0.19296L42.4549 0.00666439C45.4836 -0.116759 48.3219 1.48218 49.7858 4.13646L52.6441 9.31894Z'
const CHECK_PATH = 'M14.4803 72.5461C13.2604 70.808 11.415 69.6569 9.31096 69.376C7.20916 69.0933 5.02096 69.7038 3.26682 71.0433C1.51269 72.3828 0.347562 74.333 0.0668612 76.4351C-0.21611 78.5389 0.40843 80.6223 1.76399 82.2567C3.10464 83.875 4.4453 85.4934 5.78595 87.1117C11.1511 93.588 16.5162 100.064 21.8814 106.541C25.0609 110.797 31.7446 111.469 35.6577 108.042C56.5326 89.6602 77.4075 71.2782 98.2824 52.8962C99.8596 51.5074 101.437 50.1186 103.014 48.7298C103.588 48.2237 103.941 47.495 104.006 46.7178C104.071 45.9397 103.842 45.1769 103.36 44.5832C102.878 43.9896 102.178 43.6099 101.403 43.5138C100.629 43.4185 99.8432 43.6148 99.2304 44.0731C97.5481 45.3326 95.8658 46.592 94.1836 47.8515C71.9176 64.5214 49.6517 81.1913 27.3857 97.8613C28.8201 96.5554 31.3437 96.7337 32.61 98.3478C27.7749 91.4667 22.9399 84.5856 18.1049 77.7045C16.8967 75.985 15.6885 74.2656 14.4803 72.5461Z'

// Logo: scale the 112×111 mark to ~150px tall, centered horizontally near top.
const markScale = 1.42
const markW = 112 * markScale
const markX = (W - markW) / 2
const markY = 92

// Subtle sound-wave motif (the brand ScrollMeter motif): a centered row of thin
// bars with deterministic sine heights, low opacity. No randomness (reproducible).
const barCount = 47
const barGap = 11
const barW = 4
const waveTotalW = barCount * barGap
const waveX0 = (W - waveTotalW) / 2
const waveMidY = 520
const bars = Array.from({ length: barCount }, (_, i) => {
  const t = i / (barCount - 1)
  // two-octave sine so it reads as a waveform, tapered at the ends
  const env = Math.sin(t * Math.PI) // 0→1→0 envelope
  const amp = (0.55 + 0.45 * Math.sin(t * Math.PI * 6)) * env
  const h = 6 + amp * 46
  const x = waveX0 + i * barGap
  const isAccent = i % 6 === 0
  return `<rect x="${x.toFixed(1)}" y="${(waveMidY - h / 2).toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" rx="2" fill="${isAccent ? GREEN : '#ffffff'}" opacity="${isAccent ? 0.85 : 0.32}"/>`
}).join('')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0a0a0f"/>
  <g transform="translate(${markX.toFixed(1)}, ${markY}) scale(${markScale})">
    <path fill="#ffffff" d="${A_PATH}"/>
    <path fill="${GREEN}" d="${CHECK_PATH}"/>
  </g>
  <text x="${W / 2}" y="372" font-family="${FONT}" font-size="96" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="-2">AllMarks</text>
  <text x="${W / 2}" y="436" font-family="${FONT}" font-size="34" font-weight="400" fill="#9aa0a6" text-anchor="middle">Turn your bookmarks into a visual collage</text>
  ${bars}
  <text x="${W / 2}" y="592" font-family="${FONT}" font-size="24" font-weight="500" fill="#5a6066" text-anchor="middle" letter-spacing="1">allmarks.app</text>
</svg>`

mkdirSync('public', { recursive: true })
const out = 'public/og.png'
await sharp(Buffer.from(svg)).png().toFile(out)
console.log(`✓ ${out} (${statSync(out).size} bytes, ${W}×${H})`)
