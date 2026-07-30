import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DrawSection } from './DrawSection'
import * as matchesApi from './matchesApi'
import * as useDrawInputsModule from './useDrawInputs'
import * as generateNextMatchModule from '../matchmaking/generateNextMatch'
import * as playersApi from '../players/playersApi'
import type { Match } from './matchesApi'
import type { Player } from '../players/playersApi'
import type { CandidatePlayer } from '../matchmaking/types'

vi.mock('./matchesApi', () => ({
  listMatches: vi.fn(),
  createMatch: vi.fn(),
  getParticipantsForMatches: vi.fn(),
  recordMatchResult: vi.fn(),
}))

vi.mock('./useDrawInputs', async () => {
  const { useQuery } = await import('@tanstack/react-query')
  const assembleDrawInputs = vi.fn()
  return {
    assembleDrawInputs,
    useDrawInputs: (tournamentId: string) =>
      useQuery({
        queryKey: ['drawInputs', tournamentId],
        queryFn: () => assembleDrawInputs(tournamentId),
      }),
  }
})

vi.mock('../matchmaking/generateNextMatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../matchmaking/generateNextMatch')>()
  return {
    ...actual,
    generateNextMatch: vi.fn(),
  }
})

vi.mock('../players/playersApi', () => ({
  listPlayers: vi.fn(),
}))

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

function makeMatch(id: string, sequenceNumber: number, status: 'queued' | 'completed'): Match {
  return {
    id,
    tournament_id: 't1',
    sequence_number: sequenceNumber,
    status,
    created_at: '2026-01-01T00:00:00Z',
    completed_at: status === 'completed' ? '2026-01-01T00:00:00Z' : null,
  }
}

const players: Player[] = [
  { id: 'p1', name: 'Alice', gender: 'female', self_selected_level: 'beginner', created_at: '' },
  { id: 'p2', name: 'Bob', gender: 'male', self_selected_level: 'beginner', created_at: '' },
  { id: 'p3', name: 'Carol', gender: 'female', self_selected_level: 'beginner', created_at: '' },
  { id: 'p4', name: 'Dave', gender: 'male', self_selected_level: 'beginner', created_at: '' },
]

const fourCandidates: CandidatePlayer[] = [
  { id: 'p1', gender: 'female', skillValue: 50, matchesPlayedInTournament: 0 },
  { id: 'p2', gender: 'male', skillValue: 50, matchesPlayedInTournament: 0 },
  { id: 'p3', gender: 'female', skillValue: 50, matchesPlayedInTournament: 0 },
  { id: 'p4', gender: 'male', skillValue: 50, matchesPlayedInTournament: 0 },
]

beforeEach(() => {
  vi.mocked(matchesApi.listMatches).mockResolvedValue([])
  vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
  vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
  // enough candidates for both singles (2) and doubles (4) by default; the
  // not-enough-players tests below override this with a smaller pool.
  vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
    candidates: fourCandidates,
    pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('DrawSection: draw action', () => {
  it('draws a match: calls createMatch with the next sequence number and mocked algorithm result', async () => {
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'completed'),
      makeMatch('m2', 2, 'queued'),
    ])
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 2 },
      ],
    })
    vi.mocked(matchesApi.createMatch).mockResolvedValue(makeMatch('m3', 3, 'queued'))

    const user = userEvent.setup()
    renderWithClient(<DrawSection tournamentId="t1" matchType="singles" isActive={true} gamesPerMatch={3} pointsPerGame={21} winBy={2} cap={30} />)

    await user.click(screen.getByRole('button', { name: /draw next match/i }))

    await waitFor(() => {
      expect(matchesApi.createMatch).toHaveBeenCalledWith('t1', 3, [
        { player_id: 'p1', team: 1 },
        { player_id: 'p2', team: 2 },
      ])
    })
  })

  it('shows a message and does not call createMatch when the algorithm reports not enough players', async () => {
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: false,
      error: 'not_enough_players',
    })

    const user = userEvent.setup()
    renderWithClient(<DrawSection tournamentId="t1" matchType="doubles" isActive={true} gamesPerMatch={3} pointsPerGame={21} winBy={2} cap={30} />)

    await user.click(screen.getByRole('button', { name: /draw next match/i }))

    expect(await screen.findByText(/not enough players/i)).toBeInTheDocument()
    expect(matchesApi.createMatch).not.toHaveBeenCalled()
  })

  it('disables the button when the tournament is not active', () => {
    renderWithClient(<DrawSection tournamentId="t1" matchType="singles" isActive={false} gamesPerMatch={3} pointsPerGame={21} winBy={2} cap={30} />)

    expect(screen.getByRole('button', { name: /draw next match/i })).toBeDisabled()
  })
})

describe('DrawSection: current vs. queued match display (single-court rule)', () => {
  it('0 queued: shows no current/queued match and leaves the draw button enabled', async () => {
    renderWithClient(<DrawSection tournamentId="t1" matchType="singles" isActive={true} gamesPerMatch={3} pointsPerGame={21} winBy={2} cap={30} />)

    expect(await screen.findByText('No current match.')).toBeInTheDocument()
    expect(screen.getByText('None queued.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /draw next match/i })).toBeEnabled()
  })

  it('1 queued: shows it as the current match and leaves the draw button enabled', async () => {
    vi.mocked(matchesApi.listMatches).mockResolvedValue([makeMatch('q1', 1, 'queued')])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'q1', player_id: 'p1', team: 1 },
      { match_id: 'q1', player_id: 'p2', team: 2 },
    ])

    renderWithClient(<DrawSection tournamentId="t1" matchType="singles" isActive={true} gamesPerMatch={3} pointsPerGame={21} winBy={2} cap={30} />)

    expect(await screen.findByText('Alice vs Bob')).toBeInTheDocument()
    expect(screen.getByText('None queued.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /draw next match/i })).toBeEnabled()
  })

  it('2 queued: shows current + queued and disables the draw button (court full)', async () => {
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('q1', 1, 'queued'),
      makeMatch('q2', 2, 'queued'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'q1', player_id: 'p1', team: 1 },
      { match_id: 'q1', player_id: 'p2', team: 2 },
      { match_id: 'q2', player_id: 'p3', team: 1 },
      { match_id: 'q2', player_id: 'p4', team: 2 },
    ])

    renderWithClient(<DrawSection tournamentId="t1" matchType="singles" isActive={true} gamesPerMatch={3} pointsPerGame={21} winBy={2} cap={30} />)

    expect(await screen.findByText('Alice vs Bob')).toBeInTheDocument()
    expect(screen.getByText('Carol vs Dave')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /draw next match/i })).toBeDisabled()
    expect(screen.getByText(/court is full/i)).toBeInTheDocument()
  })
})

describe('DrawSection: not-enough-players UI state', () => {
  it('shows a clear message and disables the button for an under-sized singles pool (no crash)', async () => {
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: [fourCandidates[0]], // only 1, singles needs 2
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })

    renderWithClient(<DrawSection tournamentId="t1" matchType="singles" isActive={true} gamesPerMatch={3} pointsPerGame={21} winBy={2} cap={30} />)

    expect(
      await screen.findByText('Not enough players to draw a match. Need at least 2, have 1.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /draw next match/i })).toBeDisabled()
  })

  it('shows a clear message and disables the button for an under-sized doubles pool (no crash)', async () => {
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: fourCandidates.slice(0, 3), // only 3, doubles needs 4
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })

    renderWithClient(<DrawSection tournamentId="t1" matchType="doubles" isActive={true} gamesPerMatch={3} pointsPerGame={21} winBy={2} cap={30} />)

    expect(
      await screen.findByText('Not enough players to draw a match. Need at least 4, have 3.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /draw next match/i })).toBeDisabled()
  })

  it('does not show the message once the pool exactly meets the needed count', async () => {
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: fourCandidates.slice(0, 2), // exactly 2, singles needs 2
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })

    renderWithClient(<DrawSection tournamentId="t1" matchType="singles" isActive={true} gamesPerMatch={3} pointsPerGame={21} winBy={2} cap={30} />)

    await screen.findByText('No current match.')
    expect(screen.queryByText(/not enough players/i)).toBeNull()
    expect(screen.getByRole('button', { name: /draw next match/i })).toBeEnabled()
  })
})
