// One-shot: SVG → PNG icon generation.
// Run after app/icon.svg changes:  node scripts/gen-icons.mjs
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const svg = readFileSync(resolve(root, 'app/icon.svg'))

async function gen(size, padPct, outRel) {
  const inner = Math.round(size * (1 - padPct * 2))
  const innerBuf = await sharp(svg).resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  const meta = await sharp(innerBuf).metadata()
  const top = Math.round((size - meta.height) / 2)
  const left = Math.round((size - meta.width) / 2)
  const out = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{ input: innerBuf, top, left }])
    .png()
    .toBuffer()
  writeFileSync(resolve(root, outRel), out)
  console.log('wrote', outRel, size + 'x' + size, 'padding', (padPct * 100).toFixed(0) + '%')
}

await gen(192, 0.20, 'public/icon-192.png')
await gen(512, 0.20, 'public/icon-512.png')
