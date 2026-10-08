import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearQueue,
  getQueue,
  setQueue,
  shiftQueue,
  subscribeQueue,
  type QueuedMatch,
} from './matchQueueStore'

const key = (t: string) => `racket-score.matchQueue.${t}`
const legacyKey = (t: string) => `racket-score.nextDraw.${t}`

const m1: QueuedMatch = {
  participants: [
    { playerId: 'p1', team: 1 },
    { playerId: 'p2', team: 2 },
  ],
  manuallyAdjusted: false,
}
const m2: QueuedMatch = {
  participants: [
    { playerId: 'p3', team: 1 },
    { playerId: 'p4', team: 2 },
  ],
  manuallyAdjusted: true,
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const t of ['t1', 't2', 'tx']) clearQueue(t)
  localStorage.clear()
})

describe('matchQueueStore', () => {
  it('returns a stable empty array when nothing is stored', () => {
    expect(getQueue('t1')).toEqual([])
    expect(getQueue('t1')).toBe(getQueue('t1'))
    expect(getQueue('t1')).toBe(getQueue('t2'))
  })

  it('round-trips with a stable reference that changes after setQueue', () => {
    setQueue('t1', [m1])
    const a = getQueue('t1')
    expect(a).toEqual([m1])
    expect(getQueue('t1')).toBe(a)
    setQueue('t1', [m1, m2])
    expect(getQueue('t1')).not.toBe(a)
    expect(getQueue('t1')).toEqual([m1, m2])
  })

  it('keeps a stable reference when storage is externally rewritten to the same string', () => {
    setQueue('t1', [m1])
    const a = getQueue('t1')
    localStorage.setItem(key('t1'), JSON.stringify([m1]))
    expect(getQueue('t1')).toBe(a)
  })

  it('removes the key when set to an empty queue', () => {
    setQueue('t1', [m1])
    expect(localStorage.getItem(key('t1'))).not.toBeNull()
    setQueue('t1', [])
    expect(localStorage.getItem(key('t1'))).toBeNull()
    expect(getQueue('t1')).toEqual([])
  })

  it('shiftQueue removes and returns the head', () => {
    setQueue('t1', [m1, m2])
    expect(shiftQueue('t1')).toEqual(m1)
    expect(getQueue('t1')).toEqual([m2])
    expect(shiftQueue('t1')).toEqual(m2)
    expect(getQueue('t1')).toEqual([])
    expect(shiftQueue('t1')).toBeUndefined()
  })

  it('clearQueue empties the queue', () => {
    setQueue('t1', [m1])
    clearQueue('t1')
    expect(getQueue('t1')).toEqual([])
    expect(localStorage.getItem(key('t1'))).toBeNull()
  })

  it('treats corrupt JSON and wrong shapes as empty', () => {
    const bad = [
      '{not json',
      '{"a":1}',
      '[{"participants":"x","manuallyAdjusted":false}]',
      '[{"participants":[{"playerId":"p1","team":3}],"manuallyAdjusted":false}]',
      '[{"participants":[{"playerId":1,"team":1}],"manuallyAdjusted":false}]',
      '[{"participants":[],"manuallyAdjusted":"no"}]',
    ]
    for (const raw of bad) {
      localStorage.setItem(key('t1'), raw)
      expect(getQueue('t1')).toEqual([])
    }
  })

  it('migrates a legacy single draw into a one-entry queue', () => {
    localStorage.setItem(legacyKey('t1'), JSON.stringify(m1.participants))
    const q = getQueue('t1')
    expect(q).toEqual([
      { participants: m1.participants, manuallyAdjusted: false },
    ])
    expect(localStorage.getItem(legacyKey('t1'))).toBeNull()
    expect(localStorage.getItem(key('t1'))).not.toBeNull()
    expect(getQueue('t1')).toBe(q)
  })

  it('ignores and removes a corrupt legacy value', () => {
    localStorage.setItem(legacyKey('t1'), '{oops')
    expect(getQueue('t1')).toEqual([])
    expect(localStorage.getItem(legacyKey('t1'))).toBeNull()
    expect(localStorage.getItem(key('t1'))).toBeNull()
  })

  it('does not migrate legacy when the new key already exists', () => {
    setQueue('t1', [m2])
    localStorage.setItem(legacyKey('t1'), JSON.stringify(m1.participants))
    expect(getQueue('t1')).toEqual([m2])
  })

  it('isolates tournaments', () => {
    setQueue('t1', [m1])
    expect(getQueue('t2')).toEqual([])
    setQueue('t2', [m2])
    expect(getQueue('t1')).toEqual([m1])
  })

  it('notifies subscribers on set/shift/clear and stops after unsubscribe', () => {
    const l = vi.fn()
    const other = vi.fn()
    const off = subscribeQueue('t1', l)
    subscribeQueue('t2', other)()
    setQueue('t1', [m1, m2])
    expect(l).toHaveBeenCalledTimes(1)
    shiftQueue('t1')
    expect(l).toHaveBeenCalledTimes(2)
    clearQueue('t1')
    expect(l).toHaveBeenCalledTimes(3)
    setQueue('t2', [m1])
    expect(l).toHaveBeenCalledTimes(3)
    off()
    setQueue('t1', [m1])
    expect(l).toHaveBeenCalledTimes(3)
    expect(other).not.toHaveBeenCalled()
  })

  it('calls the listener on window storage events for its key only', () => {
    const l = vi.fn()
    const off = subscribeQueue('t1', l)
    window.dispatchEvent(new StorageEvent('storage', { key: key('t2') }))
    expect(l).not.toHaveBeenCalled()
    window.dispatchEvent(new StorageEvent('storage', { key: key('t1') }))
    expect(l).toHaveBeenCalledTimes(1)
    off()
    window.dispatchEvent(new StorageEvent('storage', { key: key('t1') }))
    expect(l).toHaveBeenCalledTimes(1)
  })

  it('does not throw and keeps an in-memory value when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(getQueue('tx')).toEqual([])
    expect(() => setQueue('tx', [m1, m2])).not.toThrow()
    expect(getQueue('tx')).toEqual([m1, m2])
    expect(shiftQueue('tx')).toEqual(m1)
    expect(getQueue('tx')).toEqual([m2])
    expect(() => clearQueue('tx')).not.toThrow()
    expect(getQueue('tx')).toEqual([])
  })

  it('keeps the in-memory value when only writes fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    setQueue('tx', [m1])
    expect(getQueue('tx')).toEqual([m1])
  })
})
