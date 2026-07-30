import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updatePlayer } from './playersApi'
import type { TablesUpdate } from '../../lib/database.types'

export function useUpdatePlayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TablesUpdate<'players'> }) =>
      updatePlayer(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['playerStats'] })
    },
  })
}
