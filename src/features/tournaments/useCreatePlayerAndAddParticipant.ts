import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPlayer } from '../players/playersApi'
import { addParticipant } from './tournamentsApi'
import type { TablesInsert } from '../../lib/database.types'

export function useCreatePlayerAndAddParticipant(tournamentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TablesInsert<'players'>) => {
      const player = await createPlayer(input)
      await addParticipant(tournamentId, player.id)
      return player
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['playerStats'] })
      queryClient.invalidateQueries({ queryKey: ['tournamentParticipants', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['drawInputs', tournamentId] })
    },
  })
}
