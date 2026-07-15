// tests/lib/onboarding-steps.test.ts
import { describe, it, expect } from 'vitest'
import { ONBOARDING_SCENES, nextSceneId, sceneById, MOBILE_SCENE_IDS, nextSceneIdIn } from '@/lib/onboarding/steps'

describe('onboarding steps', () => {
  it('has 9 scenes in the spec order (manage removed)', () => {
    expect(ONBOARDING_SCENES.map((s) => s.id)).toEqual([
      'enter', 'paste', 'tag', 'motion', 'extDemo', 'install', 'popout', 'share', 'finale',
    ])
  })
  it('paste advances on a real save event', () => {
    expect(sceneById('paste').advance).toBe('saved')
    expect(sceneById('tag').advance).toBe('button')
    expect(sceneById('motion').advance).toBe('button')
    // share is now an auto-playing showcase (cinema), advanced by NEXT/auto.
    expect(sceneById('share').advance).toBe('button')
    expect(sceneById('share').kind).toBe('cinema')
  })
  it('nextSceneId walks the chain then ends', () => {
    expect(nextSceneId('enter')).toBe('paste')
    expect(nextSceneId('install')).toBe('popout')
    expect(nextSceneId('popout')).toBe('share')
    expect(nextSceneId('share')).toBe('finale')
    expect(nextSceneId('finale')).toBeNull()
  })
  it('hands-on scenes carry a spotlight target', () => {
    expect(sceneById('paste').target).toBe('paste-zone')
    expect(sceneById('tag').target).toBe('card')
    expect(sceneById('enter').target).toBeUndefined()
  })
  it('mobile sequence is enter->paste->finale', () => {
    expect([...MOBILE_SCENE_IDS]).toEqual(['enter', 'paste', 'finale'])
    expect(nextSceneIdIn(MOBILE_SCENE_IDS, 'paste')).toBe('finale')
    expect(nextSceneIdIn(MOBILE_SCENE_IDS, 'finale')).toBeNull()
  })
  it('popout is a desktop-only cinema scene between install and share', () => {
    expect(sceneById('popout').kind).toBe('cinema')
    expect(sceneById('popout').advance).toBe('button')
    expect(sceneById('popout').target).toBeUndefined()
    expect(MOBILE_SCENE_IDS).not.toContain('popout')
  })
})
