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
      appUrl="https://allmarks.app"
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

  it('motion scene reveals NEXT only after MOTION is turned on, then advances on NEXT', async () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    function Wrapper({ db, onComplete }: { db: IDBPDatabase<any>; onComplete: () => void }) {
      const [motion, setMotion] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setMotion((v) => !v)}>TOGGLE_MOTION</button>
          <OnboardingController
            db={db} motionEnabled={motion} sharePanelOpen={false}
            appUrl="https://allmarks.app"
            onComplete={onComplete}
          />
        </>
      )
    }

    const db = await initDB()
    const onComplete = vi.fn()
    renderWithLocale(<Wrapper db={db} onComplete={onComplete} />, 'en', en as Messages)

    fireEvent.click(screen.getByRole('button', { name: 'START' }))
    await act(async () => { postBookmarkSaved({ bookmarkId: 'a' }) }) // -> tag
    await act(async () => { postBookmarkUpdated({ bookmarkId: 'a' }) }) // tag applied -> NEXT in tag
    fireEvent.click(screen.getByRole('button', { name: 'NEXT' })) // tag -> motion
    expect(screen.getByTestId('scene-motion')).not.toBeNull()

    // Motion isn't on yet → no NEXT (the user must turn it on first)
    expect(screen.queryByRole('button', { name: 'NEXT' })).toBeNull()

    // Turn MOTION on → confirmation + NEXT appear, but it does NOT auto-advance
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'TOGGLE_MOTION' })) })
    expect(screen.getByTestId('scene-motion')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'NEXT' })) // motion -> extDemo
    expect(screen.getByTestId('scene-extDemo')).not.toBeNull()
  })

  it('motion scene asks the board to force MOTION off on entry', async () => {
    const db = await initDB()
    const onRequestMotionOff = vi.fn()
    renderWithLocale(
      <OnboardingController
        db={db} motionEnabled={true} sharePanelOpen={false}
        appUrl="https://allmarks.app" onComplete={() => {}}
        onRequestMotionOff={onRequestMotionOff}
      />, 'en', en as Messages,
    )
    fireEvent.click(screen.getByRole('button', { name: 'START' }))
    await act(async () => { postBookmarkSaved({ bookmarkId: 'b' }) }) // -> tag
    await act(async () => { postBookmarkUpdated({ bookmarkId: 'b' }) }) // tag applied -> NEXT
    expect(onRequestMotionOff).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'NEXT' })) // tag -> motion
    expect(onRequestMotionOff).toHaveBeenCalledOnce()
  })

  it('tag scene reveals NEXT after a tag is applied (board tag-add path)', async () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    function Wrapper({ db, onComplete }: { db: IDBPDatabase<any>; onComplete: () => void }) {
      const [tick, setTick] = useState(0)
      return (
        <>
          <button type="button" onClick={() => setTick((v) => v + 1)}>ADD_TAG</button>
          <OnboardingController
            db={db} motionEnabled={false} sharePanelOpen={false}
            appUrl="https://allmarks.app" tagAddedSignal={tick}
            onComplete={onComplete}
          />
        </>
      )
    }
    const db = await initDB()
    const onComplete = vi.fn()
    renderWithLocale(<Wrapper db={db} onComplete={onComplete} />, 'en', en as Messages)

    fireEvent.click(screen.getByRole('button', { name: 'START' }))
    await act(async () => { postBookmarkSaved({ bookmarkId: 'a' }) })
    expect(screen.getByTestId('scene-tag')).not.toBeNull()
    // No NEXT until a tag is applied
    expect(screen.queryByRole('button', { name: 'NEXT' })).toBeNull()
    // The board adds a tag (bumps the signal) → confirmation + NEXT appear
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'ADD_TAG' })) })
    fireEvent.click(screen.getByRole('button', { name: 'NEXT' })) // tag -> motion
    expect(screen.getByTestId('scene-motion')).not.toBeNull()
  })

  it('share scene steps aside while panel open and advances on close', async () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    function Wrapper({ db, onComplete }: { db: IDBPDatabase<any>; onComplete: () => void }) {
      const [motion, setMotion] = useState(false)
      const [share, setShare] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setMotion((v) => !v)}>TOGGLE_MOTION</button>
          <button type="button" onClick={() => setShare((v) => !v)}>TOGGLE_SHARE</button>
          <OnboardingController
            db={db} motionEnabled={motion} sharePanelOpen={share}
            appUrl="https://allmarks.app"
            onComplete={onComplete}
          />
        </>
      )
    }

    const db = await initDB()
    const onComplete = vi.fn()
    renderWithLocale(<Wrapper db={db} onComplete={onComplete} />, 'en', en as Messages)

    // Walk to the share scene: paste -> tag -> motion -> extDemo -> install -> share
    fireEvent.click(screen.getByRole('button', { name: 'START' }))
    await act(async () => { postBookmarkSaved({ bookmarkId: 'c' }) }) // -> tag
    await act(async () => { postBookmarkUpdated({ bookmarkId: 'c' }) }) // tag applied -> NEXT
    fireEvent.click(screen.getByRole('button', { name: 'NEXT' })) // tag -> motion
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'TOGGLE_MOTION' })) }) // motion on -> NEXT
    fireEvent.click(screen.getByRole('button', { name: 'NEXT' })) // motion -> extDemo
    fireEvent.click(screen.getByRole('button', { name: 'NEXT' })) // extDemo -> install
    fireEvent.click(screen.getByRole('button', { name: 'NEXT' })) // install -> share
    expect(screen.getByTestId('scene-share')).not.toBeNull()
    expect(screen.queryByTestId('onboarding-spotlight')).not.toBeNull() // spotlight shown while closed

    // Open the share panel -> still on share, but spotlight steps aside
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'TOGGLE_SHARE' })) })
    expect(screen.getByTestId('scene-share')).not.toBeNull()
    expect(screen.queryByTestId('onboarding-spotlight')).toBeNull()

    // Close the share panel -> advances to finale (panel already gone)
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'TOGGLE_SHARE' })) })
    expect(screen.getByTestId('scene-finale')).not.toBeNull()
  })
})
