import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updatePlayer, type UpdatePlayerInput } from './playersApi'
import { usePassphraseGate } from '../passphrase/usePassphraseGate'

export function useUpdatePlayer() {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: UpdatePlayerInput
    }) => {
      const passphrase = await getPassphrase()
      return updatePlayer(id, updates, passphrase)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['playerStats'] })
    },
  })
}
