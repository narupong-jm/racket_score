import { useQuery } from '@tanstack/react-query'
import { listPlayers } from './playersApi'

export function usePlayers() {
  return useQuery({
    queryKey: ['players'],
    queryFn: listPlayers,
  })
}
