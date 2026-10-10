import { useMutation, useQueryClient } from '@tanstack/react-query'
import { removePlayerFromSport } from './playersApi'
import { usePassphraseGate } from '../passphrase/usePassphraseGate'
import type { Sport } from '../sport/sportTypes'

export function useRemovePlayerFromSport() {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()
  return useMutation({
    mutationFn: async ({ id, sport }: { id: string; sport: Sport }) => {
      const passphrase = await getPassphrase()
      return removePlayerFromSport(id, sport, passphrase)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['playerStats'] })
      queryClient.invalidateQueries({ queryKey: ['overallScoreboard'] })
    },
  })
}
