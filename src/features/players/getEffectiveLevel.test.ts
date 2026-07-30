import { describe, expect, it } from 'vitest'
import { getEffectiveLevel } from './getEffectiveLevel'

describe('getEffectiveLevel', () => {
  describe('match-count boundary', () => {
    it('uses the self-selected level below 3 matches, regardless of win rate', () => {
      const player = { self_selected_level: 'advanced' as const }
      expect(getEffectiveLevel(player, { total_matches: 0, win_rate: null })).toBe('advanced')
      expect(getEffectiveLevel(player, { total_matches: 1, win_rate: 100 })).toBe('advanced')
      expect(getEffectiveLevel(player, { total_matches: 2, win_rate: 0 })).toBe('advanced')
    })

    it('switches to the computed win-rate band at exactly 3 matches', () => {
      const player = { self_selected_level: 'beginner' as const }
      expect(getEffectiveLevel(player, { total_matches: 3, win_rate: 100 })).toBe('pro')
    })
  })

  describe('win-rate band boundaries (at >= 3 matches)', () => {
    const player = { self_selected_level: 'beginner' as const }

    it('0% -> beginner', () => {
      expect(getEffectiveLevel(player, { total_matches: 3, win_rate: 0 })).toBe('beginner')
    })

    it('just below 25% -> beginner', () => {
      expect(getEffectiveLevel(player, { total_matches: 3, win_rate: 24.99 })).toBe('beginner')
    })

    it('25% -> intermediate', () => {
      expect(getEffectiveLevel(player, { total_matches: 3, win_rate: 25 })).toBe('intermediate')
    })

    it('just below 50% -> intermediate', () => {
      expect(getEffectiveLevel(player, { total_matches: 3, win_rate: 49.99 })).toBe(
        'intermediate',
      )
    })

    it('50% -> advanced', () => {
      expect(getEffectiveLevel(player, { total_matches: 3, win_rate: 50 })).toBe('advanced')
    })

    it('just below 75% -> advanced', () => {
      expect(getEffectiveLevel(player, { total_matches: 3, win_rate: 74.99 })).toBe('advanced')
    })

    it('75% -> pro', () => {
      expect(getEffectiveLevel(player, { total_matches: 3, win_rate: 75 })).toBe('pro')
    })

    it('100% -> pro', () => {
      expect(getEffectiveLevel(player, { total_matches: 3, win_rate: 100 })).toBe('pro')
    })
  })
})
