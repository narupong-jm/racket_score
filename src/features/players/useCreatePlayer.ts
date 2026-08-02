import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPlayer } from './playersApi'
import type { TablesInsert } from '../../lib/database.types'
import { usePassphraseGate } from '../passphrase/usePassphraseGate'

export function useCreatePlayer() {
  const queryClient = useQueryClient()
  const { getPassphrase } = usePassphraseGate()
  return useMutation({
    mutationFn: async (input: TablesInsert<'players'>) => {
      const passphrase = await getPassphrase()
      return createPlayer(input, passphrase)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
    },
  })
}
