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
import type { CandidatePlayer } from '../matchmaking/types'
import type { Tournament } from './tournamentsApi'

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

vi.mock('../passphrase/usePassphraseGate', () => ({
  usePassphraseGate: () => ({
    getPassphrase: vi.fn().mockResolvedValue('test-passphrase'),
  }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

const tournament: Tournament = {
  id: 't1',
  name: 'Sunday Smash',
  type: 'singles',
  sport: 'badminton',
  games_per_match: 3,
  points_per_game: 21,
  win_by: 2,
  point_cap: 30,
  status: 'active',
  court_count: 1,
  created_at: '2026-01-01T00:00:00Z',
  ended_at: null,
}

afterEach(() => {
  vi.clearAllMocks()
})

const participantRow = {
  tournament_id: 't1',
  player_id: 'p1',
  joined_at: '2026-01-01T00:00:00Z',
  status: 'active',
  match_count_offset: 0,
}

function makeCandidates(count: number): CandidatePlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    gender: i % 2 === 0 ? ('male' as const) : ('female' as const),
    skillValue: 50,
    matchesPlayedInTournament: 0,
  }))
}

function setup(candidates: CandidatePlayer[], courtCount: number) {
  vi.mocked(tournamentsApi.createTournament).mockResolvedValue({
    ...tournament,
    court_count: courtCount,
  })
  vi.mocked(tournamentsApi.addParticipant).mockResolvedValue(participantRow)
  vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
    candidates,
    pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
  })
  const rendered = renderHook(() => useCreateTournamentWithFirstDraw(), {
    wrapper: createWrapper(),
  })
  rendered.result.current.mutate({
    tournament: {
      name: 'Sunday Smash',
      type: 'singles',
      sport: 'badminton',
      games_per_match: 3,
      points_per_game: 21,
      court_count: courtCount,
    },
    participantIds: candidates.map((c) => c.id),
  })
  return rendered
}

describe('useCreateTournamentWithFirstDraw', () => {
  it('creates the tournament, adds every participant, and passes court_count to createTournament', async () => {
    const { result } = setup(makeCandidates(2), 1)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(tournamentsApi.createTournament).toHaveBeenCalledWith(
      expect.objectContaining({ court_count: 1 }),
      'test-passphrase',
    )
    expect(tournamentsApi.addParticipant).toHaveBeenNthCalledWith(
      1,
      't1',
      'p1',
      'test-passphrase',
    )
    expect(tournamentsApi.addParticipant).toHaveBeenNthCalledWith(
      2,
      't1',
      'p2',
      'test-passphrase',
    )
    // Matches are only drawn into the client-side queue, never persisted here.
    expect(matchesApi.createMatch).not.toHaveBeenCalled()
    expect(result.current.data).toEqual({
      tournament,
      drawnMatches: [
        [
          { playerId: expect.any(String), team: 1 },
          { playerId: expect.any(String), team: 2 },
        ],
      ],
      reusedPlayerIds: [],
    })
  })

  it('draws court_count matches with different players when the roster is big enough', async () => {
    const { result } = setup(makeCandidates(6), 3)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const { drawnMatches, reusedPlayerIds } = result.current.data!
    expect(drawnMatches).toHaveLength(3)
    const ids = drawnMatches.flat().map((p) => p.playerId)
    // Planned counts accumulate between draws, so 6 players fill 3 singles
    // matches exactly once each.
    expect(new Set(ids).size).toBe(6)
    expect(reusedPlayerIds).toEqual([])
  })

  it('reuses players and reports them when the roster is too small for every court', async () => {
    const { result } = setup(makeCandidates(2), 3)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const { drawnMatches, reusedPlayerIds } = result.current.data!
    expect(drawnMatches).toHaveLength(3)
    expect(reusedPlayerIds.sort()).toEqual(['p1', 'p2'])
  })

  it('returns no drawn matches when the roster is smaller than one match', async () => {
    const { result } = setup(makeCandidates(1), 3)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(matchesApi.createMatch).not.toHaveBeenCalled()
    expect(result.current.data).toEqual({
      tournament: { ...tournament, court_count: 3 },
      drawnMatches: [],
      reusedPlayerIds: [],
    })
  })

  it('partial-failure path: a mid-loop addParticipant failure throws a PartialTournamentCreationError carrying the created tournament', async () => {
    vi.mocked(tournamentsApi.createTournament).mockResolvedValue(tournament)
    vi.mocked(tournamentsApi.addParticipant)
      .mockResolvedValueOnce(participantRow)
      .mockRejectedValueOnce(new Error('network error'))

    const { result } = renderHook(() => useCreateTournamentWithFirstDraw(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      tournament: {
        name: 'Sunday Smash',
        type: 'singles',
        sport: 'badminton',
        games_per_match: 3,
        points_per_game: 21,
        court_count: 1,
      },
      participantIds: ['p1', 'p2'],
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeInstanceOf(PartialTournamentCreationError)
    expect(
      (result.current.error as PartialTournamentCreationError).tournament,
    ).toEqual(tournament)
    expect(matchesApi.createMatch).not.toHaveBeenCalled()
  })
})
