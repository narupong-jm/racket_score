import { beforeEach, describe, expect, it } from 'vitest'
import { clearCachedPassphrase, getCachedPassphrase, setCachedPassphrase } from './passphraseStore'

describe('passphraseStore', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('returns null when nothing is cached', () => {
    expect(getCachedPassphrase()).toBeNull()
  })

  it('returns a value set via setCachedPassphrase', () => {
    setCachedPassphrase('correct horse battery staple')
    expect(getCachedPassphrase()).toBe('correct horse battery staple')
  })

  it('clears the cached value', () => {
    setCachedPassphrase('correct horse battery staple')
    clearCachedPassphrase()
    expect(getCachedPassphrase()).toBeNull()
  })
})
