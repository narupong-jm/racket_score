import { describe, expect, it } from 'vitest'
import { getPlayerNow } from './playerNow'
import type { PlannedMatch } from '../matchmaking/plannedMatches'

const m = (a: string, b: string): PlannedMatch => [
  { playerId: a, team: 1 },
  { playerId: b, team: 2 },
]

describe('getPlayerNow', () => {
  const onCourts = [
    { courtNumber: 2, roster: m('p1', 'p2') },
    { courtNumber: 1, roster: m('p3', 'p4') },
  ]
  const queue = [m('p5', 'p1'), m('p6', 'p7'), m('p5', 'p6')]

  it('reports the court of an in-progress player', () => {
    expect(getPlayerNow('p2', onCourts, queue, 1)).toEqual({
      court: 2,
      queuePositions: [],
    })
  })

  it('reports 1-based queue positions of the OTHER queued matches only', () => {
    // editing entry index 0: p5 is also in entry 3 (index 2)
    expect(getPlayerNow('p5', onCourts, queue, 0)).toEqual({
      court: null,
      queuePositions: [3],
    })
  })

  it('reports both the court and the queue positions', () => {
    expect(getPlayerNow('p1', onCourts, queue, 1)).toEqual({
      court: 2,
      queuePositions: [1],
    })
  })

  it('is free when on no court and in no other queued match', () => {
    expect(getPlayerNow('p7', onCourts, queue, 2)).toEqual({
      court: null,
      queuePositions: [2],
    })
    expect(getPlayerNow('p9', onCourts, queue, 1)).toEqual({
      court: null,
      queuePositions: [],
    })
  })
})
