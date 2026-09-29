import { describe, expect, it } from 'vitest'
import { PROBLEM_LOOP, PROBLEM_LOOP_CYCLE_MS, problemLoopAt } from './problem-loop'

// 区間の境目(ms): 一覧 0–1000 / 上昇 1000–4200 / ボード 4200–6800 / 薄く 6800–7100 / 戻して濃く 7100–7400
const T_RISE = 1000
const T_BOARD = 4200
const T_FADE_OUT = 6800
const T_FADE_IN = 7100

describe('problemLoopAt', () => {
  it('一周は 7400ms(1.0 + 3.2 + 2.6 + 0.3 + 0.3 秒)', () => {
    expect(PROBLEM_LOOP_CYCLE_MS).toBe(7400)
    expect(PROBLEM_LOOP.holdList + PROBLEM_LOOP.rise).toBe(T_BOARD)
    expect(T_BOARD + PROBLEM_LOOP.holdBoard).toBe(T_FADE_OUT)
    expect(T_FADE_OUT + PROBLEM_LOOP.fadeOut).toBe(T_FADE_IN)
    expect(T_FADE_IN + PROBLEM_LOOP.fadeIn).toBe(PROBLEM_LOOP_CYCLE_MS)
  })

  it('最初は一覧の状態(p = 0・不透明度 1)', () => {
    expect(problemLoopAt(0)).toEqual({ p: 0, opacity: 1 })
  })

  it('一覧で 1.0 秒止まってから進み始める', () => {
    expect(problemLoopAt(T_RISE - 1)).toEqual({ p: 0, opacity: 1 })
    expect(problemLoopAt(T_RISE)).toEqual({ p: 0, opacity: 1 })
    expect(problemLoopAt(T_RISE + 32).p).toBeCloseTo(0.01, 6)
  })

  it('p は 3.2 秒で 0 → 1 へ時間に対して線形に進む', () => {
    expect(problemLoopAt(T_RISE + 1600).p).toBeCloseTo(0.5, 6)
    expect(problemLoopAt(T_RISE + 800).p).toBeCloseTo(0.25, 6)
    expect(problemLoopAt(T_BOARD - 1).p).toBeCloseTo(1 - 1 / 3200, 6)
    expect(problemLoopAt(T_RISE + 1600).opacity).toBe(1)
  })

  it('ボードで 2.6 秒止まる(p = 1・不透明度 1)', () => {
    expect(problemLoopAt(T_BOARD)).toEqual({ p: 1, opacity: 1 })
    expect(problemLoopAt(5500)).toEqual({ p: 1, opacity: 1 })
    expect(problemLoopAt(T_FADE_OUT - 1)).toEqual({ p: 1, opacity: 1 })
  })

  it('300ms かけて薄くなる間、p は 1 のまま', () => {
    expect(problemLoopAt(T_FADE_OUT)).toEqual({ p: 1, opacity: 1 })
    const half = problemLoopAt(T_FADE_OUT + 150)
    expect(half.p).toBe(1)
    expect(half.opacity).toBeCloseTo(0.5, 6)
    const last = problemLoopAt(T_FADE_IN - 1)
    expect(last.p).toBe(1)
    expect(last.opacity).toBeCloseTo(1 / 300, 6)
  })

  it('完全に消えた瞬間に p が 0 へ戻り、300ms かけて濃くなる', () => {
    expect(problemLoopAt(T_FADE_IN)).toEqual({ p: 0, opacity: 0 })
    const half = problemLoopAt(T_FADE_IN + 150)
    expect(half.p).toBe(0)
    expect(half.opacity).toBeCloseTo(0.5, 6)
    const last = problemLoopAt(PROBLEM_LOOP_CYCLE_MS - 1)
    expect(last.p).toBe(0)
    expect(last.opacity).toBeCloseTo(299 / 300, 6)
  })

  it('1 周したら最初へ戻って繰り返す', () => {
    expect(problemLoopAt(PROBLEM_LOOP_CYCLE_MS)).toEqual({ p: 0, opacity: 1 })
    for (const t of [0, 500, T_RISE + 1600, 5500, T_FADE_OUT + 100, T_FADE_IN + 100]) {
      const a = problemLoopAt(t)
      for (const n of [1, 2, 10]) {
        const b = problemLoopAt(t + n * PROBLEM_LOOP_CYCLE_MS)
        expect(b.p).toBeCloseTo(a.p, 6)
        expect(b.opacity).toBeCloseTo(a.opacity, 6)
      }
    }
  })

  it('p は常に 0..1、不透明度も常に 0..1(細かく走査)', () => {
    for (let t = 0; t <= PROBLEM_LOOP_CYCLE_MS * 3; t += 7) {
      const f = problemLoopAt(t)
      expect(f.p).toBeGreaterThanOrEqual(0)
      expect(f.p).toBeLessThanOrEqual(1)
      expect(f.opacity).toBeGreaterThanOrEqual(0)
      expect(f.opacity).toBeLessThanOrEqual(1)
    }
  })

  it('0 未満・NaN・Infinity は最初の状態として扱う', () => {
    for (const bad of [-1, -5000, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(problemLoopAt(bad)).toEqual({ p: 0, opacity: 1 })
    }
  })
})
