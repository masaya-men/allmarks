// components/onboarding/OnboardingController.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, fireEvent, cleanup, act } from '@testing-library/react'
import { useState } from 'react'
import 'fake-indexeddb/auto'
import { initDB } from '@/lib/storage/indexeddb'
import { postBookmarkSaved, postBookmarkUpdated } from '@/lib/board/channel'
import { renderWithLocale } from '@/lib/i18n/test-utils'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import type { IDBPDatabase } from 'idb'
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

  it('motion scene advances only on a false->true toggle', async () => {
    // Wrapper component holds motionEnabled in state so we can flip it
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    function Wrapper({ db, onComplete }: { db: IDBPDatabase<any>; onComplete: () => void }) {
      const [motion, setMotion] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setMotion((v) => !v)}>TOGGLE_MOTION</button>
          <OnboardingController
            db={db} motionEnabled={motion} sharePanelOpen={false}
            onComplete={onComplete}
          />
        </>
      )
    }

    const db = await initDB()
    const onComplete = vi.fn()
    renderWithLocale(<Wrapper db={db} onComplete={onComplete} />, 'en', en as Messages)

    // Advance enter -> paste
    fireEvent.click(screen.getByRole('button', { name: 'START' }))
    expect(screen.getByTestId('scene-paste')).not.toBeNull()

    // Advance paste -> tag via saved event
    await act(async () => { postBookmarkSaved({ bookmarkId: 'a' }) })
    expect(screen.getByTestId('scene-tag')).not.toBeNull()

    // Advance tag -> motion via updated event
    await act(async () => { postBookmarkUpdated({ bookmarkId: 'a' }) })
    expect(screen.getByTestId('scene-motion')).not.toBeNull()

    // motion is already false, re-clicking TOGGLE to set true->false then back does nothing yet
    // First: verify that motion=true from the start (already true on entry) does NOT auto-advance.
    // We're currently on scene-motion with motion=false. Flip to true -> should advance.
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'TOGGLE_MOTION' })) })
    expect(screen.getByTestId('scene-extDemo')).not.toBeNull()
  })

  it('motion already-true on entry does NOT auto-advance', async () => {
    // Wrapper starts with motionEnabled=true; should stay on motion scene without a toggle
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    function Wrapper({ db, onComplete }: { db: IDBPDatabase<any>; onComplete: () => void }) {
      const [motion, setMotion] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setMotion((v) => !v)}>TOGGLE_MOTION</button>
          <OnboardingController
            db={db} motionEnabled={motion} sharePanelOpen={false}
            onComplete={onComplete}
          />
        </>
      )
    }

    const db = await initDB()
    const onComplete = vi.fn()
    renderWithLocale(<Wrapper db={db} onComplete={onComplete} />, 'en', en as Messages)

    // Walk to motion scene
    fireEvent.click(screen.getByRole('button', { name: 'START' }))
    await act(async () => { postBookmarkSaved({ bookmarkId: 'b' }) })
    await act(async () => { postBookmarkUpdated({ bookmarkId: 'b' }) })

    // On entry to motion scene, motionEnabled is already true — must NOT auto-advance
    expect(screen.getByTestId('scene-motion')).not.toBeNull()

    // Now flip false then back to true — the false->true edge should advance
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'TOGGLE_MOTION' })) }) // true->false
    expect(screen.getByTestId('scene-motion')).not.toBeNull() // still on motion
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'TOGGLE_MOTION' })) }) // false->true
    expect(screen.getByTestId('scene-extDemo')).not.toBeNull()
  })
})
