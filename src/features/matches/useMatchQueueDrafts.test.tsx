import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMatchQueueDrafts } from './useMatchQueueDrafts'
import { getQueue, setQueue, type QueuedMatch } from '../../lib/matchQueueStore'

function qm(...ids: string[]): QueuedMatch {
  return {
    participants: ids.map((playerId, i) => ({
      playerId,
      team: (i % 2 === 0 ? 1 : 2) as 1 | 2,
    })),
    manuallyAdjusted: false,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('useMatchQueueDrafts', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useMatchQueueDrafts('t1'))
    expect(result.current.queue).toEqual([])
  })

  it('adds, updates and removes entries', () => {
    const { result } = renderHook(() => useMatchQueueDrafts('t1'))
    act(() => result.current.add(qm('a', 'b')))
    act(() => result.current.add(qm('c', 'd')))
    expect(result.current.queue).toEqual([qm('a', 'b'), qm('c', 'd')])

    act(() => result.current.update(1, qm('e', 'f')))
    expect(result.current.queue).toEqual([qm('a', 'b'), qm('e', 'f')])

    act(() => result.current.remove(0))
    expect(result.current.queue).toEqual([qm('e', 'f')])
    expect(getQueue('t1')).toEqual([qm('e', 'f')])
  })

  it('ignores out-of-range remove/update', () => {
    const { result } = renderHook(() => useMatchQueueDrafts('t1'))
    act(() => result.current.add(qm('a', 'b')))
    act(() => result.current.remove(5))
    act(() => result.current.remove(-1))
    act(() => result.current.update(3, qm('x', 'y')))
    expect(result.current.queue).toEqual([qm('a', 'b')])
  })

  it('removeContaining returns removed count and removes every matching entry', () => {
    const { result } = renderHook(() => useMatchQueueDrafts('t1'))
    act(() => {
      result.current.add(qm('a', 'b'))
      result.current.add(qm('c', 'd'))
      result.current.add(qm('a', 'e'))
    })
    let n = -1
    act(() => {
      n = result.current.removeContaining('zzz')
    })
    expect(n).toBe(0)
    expect(result.current.queue).toHaveLength(3)

    act(() => {
      n = result.current.removeContaining('c')
    })
    expect(n).toBe(1)
    expect(result.current.queue).toEqual([qm('a', 'b'), qm('a', 'e')])

    act(() => {
      n = result.current.removeContaining('a')
    })
    expect(n).toBe(2)
    expect(result.current.queue).toEqual([])
  })

  it('clear empties the queue', () => {
    const { result } = renderHook(() => useMatchQueueDrafts('t1'))
    act(() => result.current.add(qm('a', 'b')))
    act(() => result.current.clear())
    expect(result.current.queue).toEqual([])
    expect(getQueue('t1')).toEqual([])
  })

  it('keeps handlers referentially stable and reads the current store value', () => {
    const { result, rerender } = renderHook(() => useMatchQueueDrafts('t1'))
    const first = result.current
    act(() => result.current.add(qm('a', 'b')))
    rerender()
    expect(result.current.add).toBe(first.add)
    expect(result.current.remove).toBe(first.remove)
    expect(result.current.update).toBe(first.update)
    expect(result.current.removeContaining).toBe(first.removeContaining)
    expect(result.current.clear).toBe(first.clear)
    // A stale handler still appends to the current store value.
    act(() => first.add(qm('c', 'd')))
    expect(result.current.queue).toEqual([qm('a', 'b'), qm('c', 'd')])
  })

  it('keeps two hook instances for the same tournament in sync', () => {
    const one = renderHook(() => useMatchQueueDrafts('t1'))
    const two = renderHook(() => useMatchQueueDrafts('t1'))
    act(() => one.result.current.add(qm('a', 'b')))
    expect(two.result.current.queue).toEqual([qm('a', 'b')])
  })

  it('isolates tournaments', () => {
    const one = renderHook(() => useMatchQueueDrafts('t1'))
    const two = renderHook(() => useMatchQueueDrafts('t2'))
    act(() => one.result.current.add(qm('a', 'b')))
    expect(two.result.current.queue).toEqual([])
  })

  it('re-renders subscribers on direct setQueue writes', () => {
    const { result } = renderHook(() => useMatchQueueDrafts('t1'))
    act(() => setQueue('t1', [qm('a', 'b')]))
    expect(result.current.queue).toEqual([qm('a', 'b')])
  })
})
