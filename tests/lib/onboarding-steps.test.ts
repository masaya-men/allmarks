// tests/lib/onboarding-steps.test.ts
import { describe, it, expect } from 'vitest'
import { ONBOARDING_SCENES, nextSceneId, sceneById } from '@/lib/onboarding/steps'

describe('onboarding steps', () => {
  it('has 8 scenes in the spec order', () => {
    expect(ONBOARDING_SCENES.map((s) => s.id)).toEqual([
      'enter', 'paste', 'tag', 'motion', 'extDemo', 'install', 'share', 'finale',
    ])
  })
  it('paste advances on a real save event', () => {
    expect(sceneById('paste').advance).toBe('saved')
    expect(sceneById('tag').advance).toBe('tagged')
    expect(sceneById('motion').advance).toBe('motion')
    expect(sceneById('share').advance).toBe('sharePanel')
  })
  it('nextSceneId walks the chain then ends', () => {
    expect(nextSceneId('enter')).toBe('paste')
    expect(nextSceneId('share')).toBe('finale')
    expect(nextSceneId('finale')).toBeNull()
  })
  it('hands-on scenes carry a spotlight target', () => {
    expect(sceneById('paste').target).toBe('paste-zone')
    expect(sceneById('tag').target).toBe('card-tag')
    expect(sceneById('enter').target).toBeUndefined()
  })
})
