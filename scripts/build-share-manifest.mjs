// scripts/build-share-manifest.mjs
// Next.js の export 出力 (= out/s/index.html) から script / stylesheet の絶対パスを抜き出し、
// functions/s/_bundle-manifest.json に書き出す post-build script。
// Pages Function 起動時に manifest を読み込んで renderShareHTML に渡す。

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * HTML 文字列から bundle 情報を抜き出す純粋関数。
 * - <script src="..."> をすべて収集 (= inline script は無視)
 * - <link rel="stylesheet" href="..."> をすべて収集 (= preload / icon 等は無視)
 * - 重複は除去
 *
 * @param {string} html
 * @returns {{ scripts: string[]; stylesheets: string[] }}
 */
export function extractBundleManifest(html) {
  const scripts = []
  const stylesheets = []

  const linkRegex = /<link\s+([^>]+?)\s*\/?>/g
  for (const match of html.matchAll(linkRegex)) {
    const attrs = match[1]
    if (!/rel\s*=\s*"stylesheet"/.test(attrs)) continue
    const hrefMatch = attrs.match(/href\s*=\s*"([^"]+)"/)
    if (hrefMatch) stylesheets.push(hrefMatch[1])
  }

  const scriptRegex = /<script\s+([^>]*?)>/g
  for (const match of html.matchAll(scriptRegex)) {
    const attrs = match[1]
    const srcMatch = attrs.match(/src\s*=\s*"([^"]+)"/)
    if (srcMatch) scripts.push(srcMatch[1])
  }

  return {
    scripts: Array.from(new Set(scripts)),
    stylesheets: Array.from(new Set(stylesheets)),
  }
}

/**
 * out/s/index.html を読み、 functions/s/_bundle-manifest.json に書き出すメイン処理。
 */
async function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const htmlPath = resolve(repoRoot, 'out/s/index.html')
  const outPath = resolve(repoRoot, 'functions/s/_bundle-manifest.json')

  let html
  try {
    html = await readFile(htmlPath, 'utf-8')
  } catch (err) {
    console.error(`[build-share-manifest] failed to read ${htmlPath}`)
    console.error(`  did you run \`pnpm build\` first? Is app/(app)/s/page.tsx in place?`)
    console.error(err)
    process.exit(1)
  }

  const manifest = extractBundleManifest(html)

  if (manifest.scripts.length === 0) {
    console.error(`[build-share-manifest] no <script src> tags found in ${htmlPath}`)
    process.exit(1)
  }

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')

  console.log(`[build-share-manifest] wrote ${outPath}`)
  console.log(`  scripts: ${manifest.scripts.length}`)
  console.log(`  stylesheets: ${manifest.stylesheets.length}`)
}

// vitest 等から import された時 (= main 関数を直接呼ばれない) は実行しない。
const isDirectInvocation = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (isDirectInvocation) {
  await main()
}
