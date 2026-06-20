// components/onboarding/OnboardingController.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { initDB } from '@/lib/storage/indexeddb'
import { postBookmarkSaved, postBookmarkUpdated } from '@/lib/board/channel'
import { renderWithLocale } from '@/lib/i18n/test-utils'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { OnboardingController } from './OnboardingController'

afterEach(cleanup)
beforeEach(async () => {
  for (const info of await indexedDB.databases()) {
    if (info.name) indexedDB.deleteDatabase(info.name)
  }
})

async function setup(props: Partial<React.ComponentProps<typeof OnboardingController>> = {}) {
  const db = await initDB()
  const onComplete = vi.fn()
  const ui = (
    <OnboardingController
      db={db} motionEnabled={false} sharePanelOpen={false}
      onComplete={onComplete} {...props}
    />
  )
  renderWithLocale(ui, 'en', en as Messages)
  return { db, onComplete }
}

describe('OnboardingController', () => {
  it('starts at the enter scene', async () => {
    await setup()
    expect(screen.getByTestId('scene-enter')).not.toBeNull()
  })

  it('START advances enter -> paste', async () => {
    await setup()
    fireEvent.click(screen.getByRole('button', { name: 'START' }))
    expect(screen.getByTestId('scene-paste')).not.toBeNull()
  })

  it('a real bookmark-saved event advances the paste scene', async () => {
    await setup()
    fireEvent.click(screen.getByRole('button', { name: 'START' }))
    await act(async () => { postBookmarkSaved({ bookmarkId: 'x' }) })
    expect(screen.getByTestId('scene-tag')).not.toBeNull()
  })

  it('SKIP completes immediately', async () => {
    const { onComplete } = await setup()
    fireEvent.click(screen.getByRole('button', { name: 'SKIP' }))
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
  })
})
