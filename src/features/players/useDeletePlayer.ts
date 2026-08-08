import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deletePlayer } from './playersApi'
import { usePassphraseGate } from '../passphrase/usePassphraseGate'

export function useDeletePlayer() {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()
  return useMutation({
    mutationFn: async (id: string) => {
      const passphrase = await getPassphrase()
      return deletePlayer(id, passphrase)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['playerStats'] })
    },
  })
}
