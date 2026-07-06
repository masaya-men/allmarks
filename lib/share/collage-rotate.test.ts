import { describe, it, expect } from 'vitest'
import { pointerAngleDeg, normalizeAngle, rotateFromPointer } from './collage-rotate'

describe('pointerAngleDeg', () => {
  it('measures the pointer angle around a center in screen coords (y down)', () => {
    expect(pointerAngleDeg(0, 0, 1, 0)).toBeCloseTo(0, 5) // →
    expect(pointerAngleDeg(0, 0, 0, 1)).toBeCloseTo(90, 5) // ↓ (screen y grows downward)
    expect(pointerAngleDeg(0, 0, -1, 0)).toBeCloseTo(180, 5) // ←
    expect(pointerAngleDeg(0, 0, 0, -1)).toBeCloseTo(-90, 5) // ↑
  })
})

describe('normalizeAngle', () => {
  it('wraps into (-180, 180]', () => {
    expect(normalizeAngle(0)).toBe(0)
    expect(normalizeAngle(180)).toBe(180)
    expect(normalizeAngle(190)).toBe(-170)
    expect(normalizeAngle(-190)).toBe(170)
    expect(normalizeAngle(360)).toBe(0)
    expect(normalizeAngle(720 + 45)).toBe(45)
  })
})

describe('rotateFromPointer', () => {
  it('applies the pointer swing to the start rotation', () => {
    // start straight, pointer swept +30° → 30° (also a 15° multiple → snaps to itself)
    expect(rotateFromPointer({ startRotation: 0, startAngle: 0, currentAngle: 30 })).toBe(30)
  })

  it('magnetically snaps to the nearest 15° step when close', () => {
    // 44° is within 4° of 45° → snaps to 45
    expect(rotateFromPointer({ startRotation: 0, startAngle: 0, currentAngle: 44 })).toBe(45)
    // 37° is >4° from both 30 and 45 → stays free
    expect(rotateFromPointer({ startRotation: 0, startAngle: 0, currentAngle: 37 })).toBe(37)
  })

  it('carries the existing rotation and wraps past ±180°', () => {
    // 170 + 30 = 200 → normalized -160 (free: 7° from -165)
    expect(rotateFromPointer({ startRotation: 170, startAngle: 0, currentAngle: 30 })).toBe(-160)
  })

  it('honors a custom snap step / window', () => {
    // no snapping when window is 0
    expect(rotateFromPointer({ startRotation: 0, startAngle: 0, currentAngle: 44, snapWithinDeg: 0 })).toBe(44)
    // snap to 90° grid within 6°
    expect(rotateFromPointer({ startRotation: 0, startAngle: 0, currentAngle: 86, snapStep: 90, snapWithinDeg: 6 })).toBe(90)
  })
})
