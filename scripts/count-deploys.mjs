#!/usr/bin/env node
// scripts/count-deploys.mjs
// Cloudflare Pages の今月の deploy 数を取得して quota 残りを表示する。
//
// 初回セットアップ:
//   1. https://dash.cloudflare.com/profile/api-tokens で「Custom token」 を発行
//   2. Permissions: Account > Cloudflare Pages > Read のみ (= 最小権限)
//   3. Account Resources: Include - All accounts
//   4. 発行された token を `.env.local` に追記:
//        CLOUDFLARE_API_TOKEN=xxxxxx
//
// 使い方:
//   node scripts/count-deploys.mjs
//
// 出力例:
//   2026年5月: 87 / 500 deploys (残り 413)
//   一番古い today の deploy: 2026-05-20 09:13 (= 約 11 時間前)

import { readFileSync } from 'node:fs'

const ACCOUNT_ID = '7bafdf422d44ccd826e2dd33fa56476b'
const PROJECT = 'booklage'
const API_BASE = 'https://api.cloudflare.com/client/v4'
const MONTHLY_QUOTA = 500
const PER_PAGE = 25
const SAFETY_PAGE_LIMIT = 40

function loadEnvLocal() {
  try {
    const txt = readFileSync('.env.local', 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
      }
    }
  } catch {
    // .env.local がなければ無視 (= 環境変数が既に設定されている可能性)
  }
}

loadEnvLocal()

const token = process.env.CLOUDFLARE_API_TOKEN
if (!token) {
  console.error('CLOUDFLARE_API_TOKEN が見つかりません。')
  console.error('')
  console.error('セットアップ:')
  console.error('  1. https://dash.cloudflare.com/profile/api-tokens で API token 発行')
  console.error('  2. Permissions: Account > Cloudflare Pages > Read')
  console.error('  3. .env.local に追記: CLOUDFLARE_API_TOKEN=xxxxxx')
  process.exit(1)
}

const now = new Date()
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

async function fetchPage(page) {
  const url = `${API_BASE}/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/deployments?per_page=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.result || []
}

let monthCount = 0
let oldestThisMonth = null
let foundOlderThanMonth = false

for (let page = 1; page <= SAFETY_PAGE_LIMIT; page++) {
  const items = await fetchPage(page)
  if (items.length === 0) break

  for (const d of items) {
    const created = new Date(d.created_on)
    if (created >= monthStart) {
      monthCount++
      if (!oldestThisMonth || created < oldestThisMonth) {
        oldestThisMonth = created
      }
    } else {
      foundOlderThanMonth = true
    }
  }
  if (foundOlderThanMonth) break
}

const remaining = MONTHLY_QUOTA - monthCount
const monthLabel = monthStart.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })

console.log(`${monthLabel}: ${monthCount} / ${MONTHLY_QUOTA} deploys (残り ${remaining})`)
if (oldestThisMonth) {
  const hoursAgo = Math.round((now - oldestThisMonth) / 3600000)
  const daysAgo = (hoursAgo / 24).toFixed(1)
  console.log(`今月最古の deploy: ${oldestThisMonth.toISOString().slice(0, 16).replace('T', ' ')} (= ${daysAgo} 日前)`)
}

if (remaining < 100) {
  console.log('')
  console.log(`⚠ 月末まで残り ${remaining} deploys。 ペース注意。`)
}
