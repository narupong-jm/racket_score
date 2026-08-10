import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPlayer, type CreatePlayerInput } from './playersApi'
import { usePassphraseGate } from '../passphrase/usePassphraseGate'

export function useCreatePlayer() {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()
  return useMutation({
    mutationFn: async (input: CreatePlayerInput) => {
      const passphrase = await getPassphrase()
      return createPlayer(input, passphrase)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['playerStats'] })
    },
  })
}
