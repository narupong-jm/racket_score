import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useCreateTournamentWithFirstDraw,
  PartialTournamentCreationError,
} from './useCreateTournamentWithFirstDraw'
import * as tournamentsApi from './tournamentsApi'
import * as useDrawInputsModule from '../matches/useDrawInputs'
import * as matchesApi from '../matches/matchesApi'
import * as generateNextMatchModule from '../matchmaking/generateNextMatch'
import type { Tournament } from './tournamentsApi'
import type { Match } from '../matches/matchesApi'

vi.mock('./tournamentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tournamentsApi')>()
  return {
    ...actual,
    createTournament: vi.fn(),
    addParticipant: vi.fn(),
  }
})

vi.mock('../matches/useDrawInputs', () => ({
  assembleDrawInputs: vi.fn(),
}))

vi.mock('../matches/matchesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../matches/matchesApi')>()
  return {
    ...actual,
    createMatch: vi.fn(),
  }
})

vi.mock('../matchmaking/generateNextMatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../matchmaking/generateNextMatch')>()
  return {
    ...actual,
    generateNextMatch: vi.fn(),
  }
})

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const tournament: Tournament = {
  id: 't1',
  name: 'Sunday Smash',
  type: 'singles',
  games_per_match: 3,
  points_per_game: 21,
  win_by: 2,
  point_cap: 30,
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  ended_at: null,
}

const firstMatch: Match = {
  id: 'm1',
  tournament_id: 't1',
  sequence_number: 1,
  status: 'queued',
  created_at: '2026-01-01T00:00:00Z',
  completed_at: null,
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useCreateTournamentWithFirstDraw', () => {
  it('happy path: creates the tournament, adds every participant, and draws the first match', async () => {
    vi.mocked(tournamentsApi.createTournament).mockResolvedValue(tournament)
    vi.mocked(tournamentsApi.addParticipant).mockResolvedValue({
      tournament_id: 't1',
      player_id: 'p1',
      joined_at: '2026-01-01T00:00:00Z',
    })
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: [],
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 2 },
      ],
    })
    vi.mocked(matchesApi.createMatch).mockResolvedValue(firstMatch)

    const { result } = renderHook(() => useCreateTournamentWithFirstDraw(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      tournament: {
        name: 'Sunday Smash',
        type: 'singles',
        games_per_match: 3,
        points_per_game: 21,
      },
      participantIds: ['p1', 'p2'],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(tournamentsApi.addParticipant).toHaveBeenNthCalledWith(1, 't1', 'p1')
    expect(tournamentsApi.addParticipant).toHaveBeenNthCalledWith(2, 't1', 'p2')
    expect(matchesApi.createMatch).toHaveBeenCalledWith('t1', 1, [
      { player_id: 'p1', team: 1 },
      { player_id: 'p2', team: 2 },
    ])
    expect(result.current.data).toEqual({
      tournament,
      firstMatch,
      drawParticipants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 2 },
      ],
    })
  })

  it('partial-failure path: a mid-loop addParticipant failure throws a PartialTournamentCreationError carrying the created tournament', async () => {
    vi.mocked(tournamentsApi.createTournament).mockResolvedValue(tournament)
    vi.mocked(tournamentsApi.addParticipant)
      .mockResolvedValueOnce({
        tournament_id: 't1',
        player_id: 'p1',
        joined_at: '2026-01-01T00:00:00Z',
      })
      .mockRejectedValueOnce(new Error('network error'))

    const { result } = renderHook(() => useCreateTournamentWithFirstDraw(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      tournament: {
        name: 'Sunday Smash',
        type: 'singles',
        games_per_match: 3,
        points_per_game: 21,
      },
      participantIds: ['p1', 'p2'],
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeInstanceOf(PartialTournamentCreationError)
    expect((result.current.error as PartialTournamentCreationError).tournament).toEqual(
      tournament,
    )
    expect(matchesApi.createMatch).not.toHaveBeenCalled()
  })
})
