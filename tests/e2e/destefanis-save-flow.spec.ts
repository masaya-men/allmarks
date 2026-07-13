import { test, expect } from '@playwright/test'
import { seedDb, firstRunSuppressors } from './helpers/seed-db'

test('save via /save popup → board tab fades in new card without manual refresh', async ({ context }) => {
  const boardPage = await context.newPage()
  // No bookmark/card rows to seed here — the old clearDb only ever CLEARED
  // the bookmarks/cards/moods stores (defensive; a fresh browser context's
  // IDB is already empty). seedDb still does real work: it navigates,
  // reaches the app's current (version-agnostic) schema, and writes the
  // first-run suppressors so no onboarding modal can interfere below.
  await seedDb(boardPage, [...firstRunSuppressors()])

  const savePage = await context.newPage()
  const params = new URLSearchParams({
    url: 'https://example.com/hello', title: 'Hello', image: '', desc: '', site: 'Example', favicon: '',
  })
  await savePage.goto(`/save?${params.toString()}`)
  await savePage.waitForSelector('[data-state="saved"]', { timeout: 3000 })

  // Board tab should reflect the new card within 2 seconds (BroadcastChannel + reload)
  await expect(boardPage.getByText('Hello').first()).toBeVisible({ timeout: 2000 })
})
