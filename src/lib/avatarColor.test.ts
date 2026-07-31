import { describe, expect, it } from 'vitest'
import { avatarColor } from './avatarColor'

describe('avatarColor', () => {
  it('returns the same color for the same name', () => {
    expect(avatarColor('Somchai Jaidee')).toBe(avatarColor('Somchai Jaidee'))
  })

  it('returns a valid hsl() color string', () => {
    expect(avatarColor('Somchai Jaidee')).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/)
  })

  it('spreads across a reasonable range of hues for different names', () => {
    const names = [
      'Somchai Jaidee',
      'Malee Suksan',
      'Anan Boonmee',
      'Preeya Rattana',
      'Kittipong Wong',
      'Chalita Sombat',
      'Wichai Prasert',
      'Nattaya Chan',
    ]
    const hues = new Set(
      names.map((name) => Number(avatarColor(name).match(/^hsl\((\d+),/)?.[1])),
    )

    expect(hues.size).toBeGreaterThan(names.length / 2)
  })
})
