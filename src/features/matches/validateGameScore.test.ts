import { describe, expect, it } from 'vitest'
import { validateGameScore } from './validateGameScore'

// standard BWF-style 21-point game, cap auto-computed as round(21*30/21)=30
const rules = { pointsPerGame: 21, winBy: 2, cap: 30 }

describe('validateGameScore', () => {
  it('accepts a normal win at the target with a clear margin', () => {
    expect(validateGameScore(21, 15, rules)).toBe(true)
    expect(validateGameScore(15, 21, rules)).toBe(true) // order-independent
  })

  it('rejects a win-by-1 at the target (must continue to deuce)', () => {
    expect(validateGameScore(21, 20, rules)).toBe(false)
  })

  it('accepts a deuce win with exactly the required margin', () => {
    expect(validateGameScore(23, 21, rules)).toBe(true)
    expect(validateGameScore(22, 20, rules)).toBe(true)
  })

  it('rejects a deuce score with more than the required margin (play would have already ended)', () => {
    expect(validateGameScore(24, 21, rules)).toBe(false)
  })

  it('accepts a cap win despite a margin smaller than winBy', () => {
    expect(validateGameScore(30, 29, rules)).toBe(true)
  })

  it('rejects a score exceeding the cap', () => {
    expect(validateGameScore(31, 29, rules)).toBe(false)
    expect(validateGameScore(31, 30, rules)).toBe(false)
  })

  it('rejects a score below the target for both players', () => {
    expect(validateGameScore(19, 17, rules)).toBe(false)
  })

  it('rejects a tied score', () => {
    expect(validateGameScore(20, 20, rules)).toBe(false)
    expect(validateGameScore(30, 30, rules)).toBe(false)
  })

  it('rejects negative scores', () => {
    expect(validateGameScore(-1, 5, rules)).toBe(false)
  })

  it('works with a different points-per-game / cap configuration', () => {
    const smallGame = { pointsPerGame: 11, winBy: 2, cap: 16 } // round(11*30/21)=16
    expect(validateGameScore(11, 8, smallGame)).toBe(true)
    expect(validateGameScore(11, 10, smallGame)).toBe(false)
    expect(validateGameScore(13, 11, smallGame)).toBe(true)
    expect(validateGameScore(16, 15, smallGame)).toBe(true) // cap win
    expect(validateGameScore(17, 15, smallGame)).toBe(false) // over cap
  })
})
