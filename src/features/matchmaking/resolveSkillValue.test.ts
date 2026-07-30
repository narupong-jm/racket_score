import { describe, expect, it } from 'vitest'
import { resolveSkillValue } from './resolveSkillValue'

describe('resolveSkillValue', () => {
  describe('3-match boundary', () => {
    it('uses the self-selected midpoint just below the threshold (2 matches)', () => {
      expect(
        resolveSkillValue({ selfSelectedLevel: 'advanced', totalMatches: 2, winRate: 100 }),
      ).toBe(62.5)
    })

    it('uses the real win rate at exactly 3 matches', () => {
      expect(
        resolveSkillValue({ selfSelectedLevel: 'beginner', totalMatches: 3, winRate: 66.67 }),
      ).toBe(66.67)
    })

    it('uses the real win rate above the threshold', () => {
      expect(
        resolveSkillValue({ selfSelectedLevel: 'beginner', totalMatches: 10, winRate: 40 }),
      ).toBe(40)
    })
  })

  describe('self-selected category midpoints (< 3 matches)', () => {
    it('beginner -> 12.5', () => {
      expect(
        resolveSkillValue({ selfSelectedLevel: 'beginner', totalMatches: 0, winRate: null }),
      ).toBe(12.5)
    })

    it('intermediate -> 37.5', () => {
      expect(
        resolveSkillValue({ selfSelectedLevel: 'intermediate', totalMatches: 0, winRate: null }),
      ).toBe(37.5)
    })

    it('advanced -> 62.5', () => {
      expect(
        resolveSkillValue({ selfSelectedLevel: 'advanced', totalMatches: 0, winRate: null }),
      ).toBe(62.5)
    })

    it('pro -> 87.5', () => {
      expect(
        resolveSkillValue({ selfSelectedLevel: 'pro', totalMatches: 0, winRate: null }),
      ).toBe(87.5)
    })
  })

  describe('edge case', () => {
    it('treats a null win rate at >= 3 matches as 0 rather than crashing', () => {
      expect(
        resolveSkillValue({ selfSelectedLevel: 'pro', totalMatches: 5, winRate: null }),
      ).toBe(0)
    })
  })
})
