import { useCallback, useMemo, useSyncExternalStore } from 'react'
import {
  getQueue,
  setQueue,
  subscribeQueue,
  type QueuedMatch,
} from '../../lib/matchQueueStore'

export interface MatchQueueDrafts {
  queue: QueuedMatch[]
  add: (match: QueuedMatch) => void
  remove: (index: number) => void
  update: (index: number, match: QueuedMatch) => void
  /** Removes every entry containing the player; returns how many were removed. */
  removeContaining: (playerId: string) => number
  clear: () => void
}

/**
 * The tournament's not-yet-started match queue, backed by the localStorage
 * store so every component using it (and the start mutation's own shift)
 * stays in sync. Handlers read the current store value at call time. Callers
 * enforce the courtCount + 1 cap.
 */
export function useMatchQueueDrafts(tournamentId: string): MatchQueueDrafts {
  const queue = useSyncExternalStore(
    useCallback(
      (listener: () => void) => subscribeQueue(tournamentId, listener),
      [tournamentId],
    ),
    () => getQueue(tournamentId),
  )

  const add = useCallback(
    (match: QueuedMatch) => {
      setQueue(tournamentId, [...getQueue(tournamentId), match])
    },
    [tournamentId],
  )

  const remove = useCallback(
    (index: number) => {
      const current = getQueue(tournamentId)
      if (index < 0 || index >= current.length) return
      setQueue(
        tournamentId,
        current.filter((_, i) => i !== index),
      )
    },
    [tournamentId],
  )

  const update = useCallback(
    (index: number, match: QueuedMatch) => {
      const current = getQueue(tournamentId)
      if (index < 0 || index >= current.length) return
      setQueue(
        tournamentId,
        current.map((m, i) => (i === index ? match : m)),
      )
    },
    [tournamentId],
  )

  const removeContaining = useCallback(
    (playerId: string) => {
      const current = getQueue(tournamentId)
      const kept = current.filter(
        (m) => !m.participants.some((p) => p.playerId === playerId),
      )
      const removed = current.length - kept.length
      if (removed > 0) setQueue(tournamentId, kept)
      return removed
    },
    [tournamentId],
  )

  const clear = useCallback(() => {
    setQueue(tournamentId, [])
  }, [tournamentId])

  return useMemo(
    () => ({ queue, add, remove, update, removeContaining, clear }),
    [queue, add, remove, update, removeContaining, clear],
  )
}
