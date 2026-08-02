import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCancelTournament } from './useCancelTournament'
import * as tournamentsApi from './tournamentsApi'
import type { Tournament } from './tournamentsApi'

vi.mock('./tournamentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tournamentsApi')>()
  return {
    ...actual,
    cancelTournament: vi.fn(),
  }
})

vi.mock('../passphrase/usePassphraseGate', () => ({
  usePassphraseGate: () => ({ getPassphrase: vi.fn().mockResolvedValue('test-passphrase') }),
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const cancelledTournament: Tournament = {
  id: 't1',
  name: 'Sunday Smash',
  type: 'singles',
  games_per_match: 3,
  points_per_game: 21,
  win_by: 2,
  point_cap: 30,
  status: 'cancelled',
  created_at: '2026-01-01T00:00:00Z',
  ended_at: null,
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useCancelTournament', () => {
  it('calls cancelTournament and invalidates both the tournaments list and this tournament\'s matches query on success', async () => {
    vi.mocked(tournamentsApi.cancelTournament).mockResolvedValue(cancelledTournament)

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCancelTournament(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate('t1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(tournamentsApi.cancelTournament).toHaveBeenCalledWith('t1', 'test-passphrase')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tournaments'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['matches', 't1'] })
  })
})
