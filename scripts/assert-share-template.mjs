// scripts/assert-share-template.mjs
// Build-time guard for the share OG injection (rank20).
//
// The share receiver (/s/<id>, /s/<id>/triage) does NOT generate its own HTML —
// it borrows Next's exported out/s.html and rewrites the OG meta per share via
// functions/s/patch-share-html.ts (regex replace + inject). If a Next upgrade
// changes the shape of that exported HTML so one of those regex anchors no
// longer matches, patchShareHTML silently no-ops: the page still renders, but
// the SNS preview (og:title / og:image / og:url) is missing or stale, with no
// error anywhere. We were bitten by exactly this class of "silent output-shape
// drift" before (the .webp og:image path). This script fails the build loudly
// the moment an anchor disappears.
//
// Wired into `pnpm build` (see package.json) so it runs on every deploy build.

import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'

// MUST mirror the replacement / injection targets in
// functions/s/patch-share-html.ts. If you change a regex there, change it here.
export const REQUIRED_ANCHORS = [
  { name: '<title> element (title replacement target)', re: /<title>[\s\S]*?<\/title>/ },
  { name: 'og:title meta (content replacement target)', re: /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/ },
  { name: 'og:description meta (content replacement target)', re: /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/ },
  { name: 'og:type meta (injection anchor for og:url / og:image / twitter:image)', re: /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/ },
  { name: '<head> tag (share-vars <script> injection anchor)', re: /<head>/ },
]

/** Pure: returns the display names of the anchors NOT found in `html`. */
export function findMissingAnchors(html) {
  return REQUIRED_ANCHORS.filter((a) => !a.re.test(html)).map((a) => a.name)
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const templatePath = resolve(root, 'out', 's.html')

  let html
  try {
    html = await readFile(templatePath, 'utf8')
  } catch {
    console.error(
      `[assert-share-template] FAILED: ${templatePath} was not produced by the build.\n` +
        `The share receiver borrows this exported HTML; without it every /s/<id> page is broken.`,
    )
    process.exit(1)
  }

  const missing = findMissingAnchors(html)
  if (missing.length > 0) {
    console.error(
      `[assert-share-template] FAILED: out/s.html is missing ${missing.length} anchor(s) that\n` +
        `functions/s/patch-share-html.ts relies on to inject per-share OG meta:`,
    )
    for (const m of missing) console.error(`  - ${m}`)
    console.error(
      `\nNext's exported HTML shape changed. Update functions/s/patch-share-html.ts (and the\n` +
        `REQUIRED_ANCHORS list in this script) so the OG injection still matches.`,
    )
    process.exit(1)
  }

  console.log('[assert-share-template] OK — all OG injection anchors present in out/s.html')
}

// Run only when invoked directly (`node scripts/assert-share-template.mjs`),
// not when imported by the test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
