/**
 * Generate a "lens-edge" displacement map PNG for the /triage glass pane.
 *
 * Goal (= user-requested behaviour, session 80, iteration 2):
 *   - Whole pane behaves like a real convex (magnifying) lens.
 *   - Centre: subtle but non-zero distortion (= keeps the "looking
 *     through glass" sensation, not a flat hole).
 *   - Edges  : strong refraction (= lens-edge curvature).
 *   - Curve  : continuous radial — no flat-zone boundary that reads
 *     as "the centre is dead, only the edges live".
 *
 * Math:
 *   - For each pixel at normalised coord (u, v) ∈ [-1, 1]:
 *       r = √(u² + v²)               (radial distance, clamped to [0, 1])
 *       f(r) = r²                    (quadratic ramp: gentle centre, accelerating edge)
 *       direction = -1               (convex / magnify; +1 would be concave / shrink)
 *       rOff = direction · (u / r) · f(r)
 *       gOff = direction · (v / r) · f(r)
 *       R = round(128 + rOff · 127)
 *       G = round(128 + gOff · 127)
 *
 * feDisplacementMap reads R/G as displacement in [-scale/2, +scale/2] px.
 *
 * Run once, output committed to public/displacement/lens-edge.png:
 *   node scripts/generate-lens-edge-displacement.mjs
 */

import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, '..', 'public', 'displacement', 'lens-edge.png')

const W = 512
const H = 512
const POWER = 2          // r^POWER curve. 1 = linear (uniform magnify). 2 = gentle centre, strong edge. 3+ = very edge-focused.
const DIRECTION = -1     // -1 = convex (magnify, like a real magnifying glass). +1 = concave (shrink).

const buf = Buffer.alloc(W * H * 4)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const u = (x / (W - 1)) * 2 - 1
    const v = (y / (H - 1)) * 2 - 1

    const r = Math.sqrt(u * u + v * v)
    let rOff = 0
    let gOff = 0
    if (r >= 1e-9) {
      const clampedR = Math.min(r, 1)
      const f = Math.pow(clampedR, POWER)
      rOff = DIRECTION * (u / r) * f
      gOff = DIRECTION * (v / r) * f
    }

    const i = (y * W + x) * 4
    buf[i]     = Math.round(128 + rOff * 127)
    buf[i + 1] = Math.round(128 + gOff * 127)
    buf[i + 2] = 128
    buf[i + 3] = 255
  }
}

await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
  .png()
  .toFile(OUT_PATH)

console.log(`Wrote ${OUT_PATH} (${W}×${H}, power=${POWER}, direction=${DIRECTION === -1 ? 'convex/magnify' : 'concave/shrink'})`)
