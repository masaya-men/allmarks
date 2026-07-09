import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSaveUrl } from './use-save-url'

describe('useSaveUrl', () => {
  it('calls onSaved with the bookmark id on a fresh save and clears feedback', async () => {
    const onSaved = vi.fn()
    const performSave = vi.fn(async () => ({ outcome: 'saved' as const, bookmarkId: 'bk1' }))
    const { result } = renderHook(() => useSaveUrl({ onSaved, performSave }))

    let outcome: string = ''
    await act(async () => { outcome = await result.current.saveUrl('https://example.com') })

    expect(outcome).toBe('saved')
    expect(onSaved).toHaveBeenCalledWith('bk1')
    expect(result.current.feedback.kind).toBeNull()
  })

  it('shows the duplicate pill and does NOT call onSaved on a duplicate', async () => {
    const onSaved = vi.fn()
    const performSave = vi.fn(async () => ({ outcome: 'duplicate' as const, bookmarkId: null }))
    const { result } = renderHook(() => useSaveUrl({ onSaved, performSave }))

    let outcome: string = ''
    await act(async () => { outcome = await result.current.saveUrl('https://dup.com') })

    expect(outcome).toBe('duplicate')
    expect(onSaved).not.toHaveBeenCalled()
    expect(result.current.feedback.kind).toBe('duplicate')
  })

  it('passes flagDemo=true only for the onboarding SAMPLE_URL when the ref is on', async () => {
    const onSaved = vi.fn()
    const performSave = vi.fn(async () => ({ outcome: 'saved' as const, bookmarkId: 'bk2' }))
    const flagOnboardingRef = { current: true }
    const { result } = renderHook(() =>
      useSaveUrl({ onSaved, performSave, flagOnboardingRef }),
    )
    // A real (non-sample) link during onboarding must NOT be flagged as demo.
    await act(async () => { await result.current.saveUrl('https://real-link.com') })
    expect(performSave).toHaveBeenLastCalledWith('https://real-link.com', false)
  })
})
