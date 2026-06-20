// scripts/capture-lp-shot.mjs
// One-off: capture the AllMarks LP hero as the "real screen" background for the
// onboarding extension demo. Serve out/ first (npx -y serve out -l 4321), then:
//   node scripts/capture-lp-shot.mjs
import { chromium } from 'playwright'
import sharp from 'sharp'

const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000) // let the hero settle (LP forces light theme on mount)
const png = await page.screenshot({
  type: 'png',
  clip: { x: 0, y: 0, width: 1600, height: 1000 }, // 16:10 to match the demo browser frame
})
await b.close()
await sharp(png).webp({ quality: 82 }).toFile('public/onboarding/lp-hero-shot.webp')
console.log('captured public/onboarding/lp-hero-shot.webp')
