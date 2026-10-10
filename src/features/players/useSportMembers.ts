import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listPlayers, type Player } from './playersApi'
import { isMemberOfSport } from './playerMembership'
import type { Sport } from '../sport/sportTypes'

// Both hooks query the SAME key/queryFn as `usePlayers()` (unfiltered, for
// the name lookups in History/Manage/the delete-impact modal), so they share
// one cache entry and one network request -- only the `select` differs. The
// select functions are wrapped in `useCallback` so their identity is stable
// across re-renders with the same `sport`: TanStack Query v5 only
// structurally-shares a `select` result when the selector itself is
// referentially stable.

export function useSportMembers(sport: Sport) {
  const select = useCallback(
    (players: Player[]) => players.filter((p) => isMemberOfSport(p, sport)),
    [sport],
  )
  return useQuery({
    queryKey: ['players'],
    queryFn: listPlayers,
    select,
  })
}

export function useNonSportMembers(sport: Sport) {
  const select = useCallback(
    (players: Player[]) => players.filter((p) => !isMemberOfSport(p, sport)),
    [sport],
  )
  return useQuery({
    queryKey: ['players'],
    queryFn: listPlayers,
    select,
  })
}
