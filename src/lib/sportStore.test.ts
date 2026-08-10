import { beforeEach, describe, expect, it } from 'vitest'
import { getCachedSport, setCachedSport } from './sportStore'

describe('sportStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing is cached', () => {
    expect(getCachedSport()).toBeNull()
  })

  it('returns a value set via setCachedSport', () => {
    setCachedSport('tennis')
    expect(getCachedSport()).toBe('tennis')
  })
})
