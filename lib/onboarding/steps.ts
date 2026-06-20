// lib/onboarding/steps.ts
export type SceneKind = 'cinema' | 'handsOn'
export type AdvanceTrigger = 'button' | 'saved' | 'tagged' | 'motion' | 'sharePanel'
export type SceneId =
  | 'enter' | 'paste' | 'tag' | 'motion' | 'extDemo' | 'install' | 'share' | 'finale'
export type OnboardingTarget = 'paste-zone' | 'card-tag' | 'card' | 'motion' | 'share'

export type OnboardingScene = {
  readonly id: SceneId
  readonly kind: SceneKind
  readonly advance: AdvanceTrigger
  readonly target?: OnboardingTarget
}

export const ONBOARDING_SCENES: readonly OnboardingScene[] = [
  { id: 'enter',   kind: 'cinema',  advance: 'button' },
  { id: 'paste',   kind: 'handsOn', advance: 'saved',      target: 'paste-zone' },
  { id: 'tag',     kind: 'handsOn', advance: 'button',     target: 'card' },
  { id: 'motion',  kind: 'handsOn', advance: 'button',     target: 'motion' },
  { id: 'extDemo', kind: 'cinema',  advance: 'button' },
  { id: 'install', kind: 'handsOn', advance: 'button' },
  { id: 'share',   kind: 'handsOn', advance: 'sharePanel', target: 'share' },
  { id: 'finale',  kind: 'cinema',  advance: 'button' },
] as const

export function sceneById(id: SceneId): OnboardingScene {
  const s = ONBOARDING_SCENES.find((x) => x.id === id)
  if (!s) throw new Error(`unknown scene: ${id}`)
  return s
}

export function nextSceneId(current: SceneId): SceneId | null {
  const i = ONBOARDING_SCENES.findIndex((x) => x.id === current)
  const next = ONBOARDING_SCENES[i + 1]
  return next ? next.id : null
}

export const MOBILE_SCENE_IDS: readonly SceneId[] = ['enter', 'paste', 'finale'] as const

export function nextSceneIdIn(seq: readonly SceneId[], current: SceneId): SceneId | null {
  const i = seq.indexOf(current)
  const n = seq[i + 1]
  return n ?? null
}
