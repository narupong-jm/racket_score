import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPlayer } from './playersApi'
import type { TablesInsert } from '../../lib/database.types'

export function useCreatePlayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TablesInsert<'players'>) => createPlayer(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
    },
  })
}
