import { describe, it, expect } from 'vitest'
import { getCardDecorations, resolveDecorations } from './paper-decorations'

describe('getCardDecorations', () => {
  it('is deterministic — same id yields a deep-equal, fresh set', () => {
    const a = getCardDecorations('bookmark-abc')
    const b = getCardDecorations('bookmark-abc')
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
  })

  it('generally differs across ids', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const unique = new Set(ids.map((id) => JSON.stringify(getCardDecorations(id))))
    expect(unique.size).toBeGreaterThan(1)
  })

  it('fastens every card with EXACTLY ONE of tape / pin (never both, never bare)', () => {
    for (let i = 0; i < 300; i++) {
      const d = getCardDecorations(`mount-${i}`)
      const fasteners = [Boolean(d.tape), d.pin].filter(Boolean).length
      expect(fasteners).toBe(1)
    }
  })

  it('produces both fastener states across the board: taped and pinned', () => {
    let taped = false
    let pinned = false
    for (let i = 0; i < 300; i++) {
      const d = getCardDecorations(`state-${i}`)
      if (d.tape) taped = true
      if (d.pin) pinned = true
    }
    expect(taped).toBe(true)
    expect(pinned).toBe(true)
  })

  it('the tape (when present) is a single top-center strip with valid fields', () => {
    for (let i = 0; i < 300; i++) {
      const d = getCardDecorations(`tape-${i}`)
      if (!d.tape) continue
      expect(['a', 'b', 'c']).toContain(d.tape.tint)
      expect(d.tape.angleDeg).toBeGreaterThanOrEqual(-5)
      expect(d.tape.angleDeg).toBeLessThanOrEqual(5)
      expect(d.tape.offsetPct).toBeGreaterThanOrEqual(46)
      expect(d.tape.offsetPct).toBeLessThanOrEqual(54)
      expect(d.tape.assetSeed).toBeGreaterThanOrEqual(0)
      expect(d.tape.assetSeed).toBeLessThan(1)
    }
  })

  it('tape family is per-card and both families occur', () => {
    const families = new Set(
      Array.from({ length: 300 }, (_, i) => getCardDecorations(`fam-${i}`).tapeFamily),
    )
    expect(families.has('clear')).toBe(true)
    expect(families.has('colored')).toBe(true)
  })

  it('pin variant is always a known colour', () => {
    for (let i = 0; i < 100; i++) {
      expect(['gold', 'green']).toContain(getCardDecorations(`pin-${i}`).pinVariant)
    }
  })
})

describe('resolveDecorations (torn / ring-bound sheets)', () => {
  it('untorn cards pass through unchanged', () => {
    for (let i = 0; i < 60; i++) {
      const id = `passthru-${i}`
      expect(resolveDecorations(id, false)).toEqual(getCardDecorations(id))
    }
  })

  it('never places a push-pin on a torn sheet — swaps in a top-center tape', () => {
    let checkedAPin = false
    for (let i = 0; i < 400; i++) {
      const id = `pin-torn-${i}`
      const base = getCardDecorations(id)
      if (!base.pin) continue
      checkedAPin = true
      const torn = resolveDecorations(id, true)
      expect(torn.pin).toBe(false)
      expect(torn.tape).not.toBeNull()
      expect(torn.tape?.offsetPct).toBeGreaterThanOrEqual(46)
      expect(torn.tape?.offsetPct).toBeLessThanOrEqual(54)
    }
    expect(checkedAPin).toBe(true)
  })

  it('a taped or bare card is unaffected by torn backing', () => {
    for (let i = 0; i < 300; i++) {
      const id = `nonpin-${i}`
      const base = getCardDecorations(id)
      if (base.pin) continue
      expect(resolveDecorations(id, true)).toEqual(base)
    }
  })

  it('is deterministic per (cardId, tornBacking)', () => {
    expect(resolveDecorations('det-1', true)).toEqual(resolveDecorations('det-1', true))
  })
})
