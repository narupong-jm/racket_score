import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLeaveParticipant } from './useLeaveParticipant'
import * as tournamentsApi from './tournamentsApi'
import type { TournamentParticipant } from './tournamentsApi'

vi.mock('./tournamentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tournamentsApi')>()
  return {
    ...actual,
    leaveParticipant: vi.fn(),
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

const leftParticipant: TournamentParticipant = {
  tournament_id: 't1',
  player_id: 'p1',
  joined_at: '2026-01-01T00:00:00Z',
  status: 'left',
  match_count_offset: 0,
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useLeaveParticipant', () => {
  it('calls leaveParticipant and invalidates the participants and drawInputs queries on success', async () => {
    vi.mocked(tournamentsApi.leaveParticipant).mockResolvedValue(leftParticipant)

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useLeaveParticipant('t1'), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate('p1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(tournamentsApi.leaveParticipant).toHaveBeenCalledWith('t1', 'p1', 'test-passphrase')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tournamentParticipants', 't1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['drawInputs', 't1'] })
  })
})
