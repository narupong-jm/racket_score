import { afterEach, describe, expect, it } from 'vitest'
import {
  getCachedNextDraw,
  setCachedNextDraw,
  clearCachedNextDraw,
} from './nextDrawStore'
import type { GeneratedMatchParticipant } from '../features/matchmaking/generateNextMatch'

afterEach(() => {
  localStorage.clear()
})

const draw: GeneratedMatchParticipant[] = [
  { playerId: 'p1', team: 1 },
  { playerId: 'p2', team: 2 },
]

describe('nextDrawStore', () => {
  it('returns null when nothing is cached for a tournament', () => {
    expect(getCachedNextDraw('t1')).toBeNull()
  })

  it('round-trips a draw through set/get', () => {
    setCachedNextDraw('t1', draw)
    expect(getCachedNextDraw('t1')).toEqual(draw)
  })

  it('keys the cache per tournament -- setting one tournament does not affect another', () => {
    setCachedNextDraw('t1', draw)
    expect(getCachedNextDraw('t2')).toBeNull()
  })

  it('clear removes only that tournament\'s entry', () => {
    setCachedNextDraw('t1', draw)
    setCachedNextDraw('t2', draw)
    clearCachedNextDraw('t1')
    expect(getCachedNextDraw('t1')).toBeNull()
    expect(getCachedNextDraw('t2')).toEqual(draw)
  })
})
