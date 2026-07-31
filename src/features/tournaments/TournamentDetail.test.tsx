import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TournamentDetail } from './TournamentDetail'
import * as tournamentsApi from './tournamentsApi'
import * as playersApi from '../players/playersApi'
import * as useDrawInputsModule from '../matches/useDrawInputs'
import * as matchesApi from '../matches/matchesApi'
import * as generateNextMatchModule from '../matchmaking/generateNextMatch'
import type { Tournament } from './tournamentsApi'
import type { Player } from '../players/playersApi'
import type { Match, MatchHistoryEntry } from '../matches/matchesApi'
import type { CandidatePlayer } from '../matchmaking/types'

vi.mock('./tournamentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tournamentsApi')>()
  return {
    ...actual,
    listTournaments: vi.fn(),
    listParticipants: vi.fn(),
    endTournament: vi.fn(),
  }
})

vi.mock('../players/playersApi', () => ({
  listPlayers: vi.fn(),
  listPlayerStats: vi.fn(),
}))

vi.mock('../matches/useDrawInputs', async () => {
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

vi.mock('../matches/matchesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../matches/matchesApi')>()
  return {
    ...actual,
    listMatches: vi.fn(),
    getParticipantsForMatches: vi.fn(),
    listGamesForMatches: vi.fn(),
    createMatch: vi.fn(),
    recordMatchResult: vi.fn(),
  }
})

vi.mock('../matchmaking/generateNextMatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../matchmaking/generateNextMatch')>()
  return {
    ...actual,
    generateNextMatch: vi.fn(),
  }
})

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const activeTournament: Tournament = {
  id: 't1',
  name: 'Active T',
  type: 'singles',
  games_per_match: 1,
  points_per_game: 21,
  win_by: 2,
  point_cap: 30,
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  ended_at: null,
}

const completedTournament: Tournament = {
  ...activeTournament,
  id: 't2',
  name: 'Completed T',
  status: 'completed',
  ended_at: '2026-01-02T00:00:00Z',
}

const players: Player[] = [
  { id: 'p1', name: 'Alice', gender: 'female', self_selected_level: 'beginner', created_at: '' },
  { id: 'p2', name: 'Bob', gender: 'male', self_selected_level: 'beginner', created_at: '' },
]

const twoCandidates: CandidatePlayer[] = [
  { id: 'p1', gender: 'female', skillValue: 50, matchesPlayedInTournament: 0 },
  { id: 'p2', gender: 'male', skillValue: 50, matchesPlayedInTournament: 0 },
]

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

function setupCommonMocks() {
  vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
  vi.mocked(playersApi.listPlayerStats).mockResolvedValue([])
  vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([])
  vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
    candidates: twoCandidates,
    pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
  })
  vi.mocked(matchesApi.listGamesForMatches).mockResolvedValue([])
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('TournamentDetail: Current match card', () => {
  it('shows the empty state when no match is in progress', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(
      await screen.findByText('No match in progress -- start the next match below'),
    ).toBeInTheDocument()
  })
})

describe('TournamentDetail: Next match card (Randomize / Start match)', () => {
  it('Randomize populates Next only -- Current stays empty and no match is persisted', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 2 },
      ],
    })

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByText('No match in progress -- start the next match below')
    await user.click(await screen.findByRole('button', { name: 'Randomize' }))

    expect(await screen.findByText('Alice vs Bob')).toBeInTheDocument()
    expect(screen.getByText('No match in progress -- start the next match below')).toBeInTheDocument()
    expect(matchesApi.createMatch).not.toHaveBeenCalled()
  })

  it('Start match promotes Next into Current (persisting it) and resets Current to fresh inputs', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament])
    setupCommonMocks()

    let matchesState: Match[] = []
    let participantsState: MatchHistoryEntry[] = []
    vi.mocked(matchesApi.listMatches).mockImplementation(async () => matchesState)
    vi.mocked(matchesApi.getParticipantsForMatches).mockImplementation(async (ids: string[]) =>
      participantsState.filter((p) => ids.includes(p.match_id)),
    )
    vi.mocked(matchesApi.createMatch).mockImplementation(async (_tournamentId, seq, participants) => {
      const match = makeMatch('m-new', seq, 'queued')
      matchesState = [...matchesState, match]
      participantsState = [
        ...participantsState,
        ...participants.map((p) => ({ match_id: match.id, player_id: p.player_id, team: p.team })),
      ]
      return match
    })
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 2 },
      ],
    })

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByText('No match in progress -- start the next match below')
    await user.click(await screen.findByRole('button', { name: 'Randomize' }))
    await screen.findByText('Alice vs Bob')

    await user.click(screen.getByRole('button', { name: 'Start match' }))

    await waitFor(() => {
      expect(matchesApi.createMatch).toHaveBeenCalledWith('t1', 1, [
        { player_id: 'p1', team: 1 },
        { player_id: 'p2', team: 2 },
      ])
    })

    // Current is now populated with the promoted pairing...
    await waitFor(() => {
      expect(
        screen.queryByText('No match in progress -- start the next match below'),
      ).toBeNull()
    })
    expect(screen.getAllByText('Alice vs Bob').length).toBeGreaterThan(0)

    // ...with fresh, empty score inputs.
    const scoreInput = screen.getByRole('spinbutton', { name: 'Alice -- Game 1' })
    expect(scoreInput).toHaveValue(null)

    // ...and Next is cleared back to empty.
    expect(screen.getByText('Not picked yet')).toBeInTheDocument()
  })
})

describe('TournamentDetail: Save result confirm dialog', () => {
  it('opens a confirm dialog on Save result and only calls recordMatchResult on Confirm', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([makeMatch('m1', 1, 'queued')])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
    ])
    vi.mocked(matchesApi.recordMatchResult).mockResolvedValue(makeMatch('m1', 1, 'completed'))

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const team1Input = await screen.findByRole('spinbutton', { name: 'Alice -- Game 1' })
    const team2Input = screen.getByRole('spinbutton', { name: 'Bob -- Game 1' })
    await user.type(team1Input, '21')
    await user.type(team2Input, '15')

    await user.click(screen.getByRole('button', { name: 'Save result' }))

    expect(await screen.findByText('Confirm this result?')).toBeInTheDocument()
    expect(matchesApi.recordMatchResult).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Confirm result' }))

    await waitFor(() => {
      expect(matchesApi.recordMatchResult).toHaveBeenCalledWith('m1', [
        { game_number: 1, team1_score: 21, team2_score: 15 },
      ])
    })
  })
})

describe('TournamentDetail: End tournament confirm dialog', () => {
  it('shows an enabled End tournament button for an active tournament', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(await screen.findByRole('button', { name: 'End tournament' })).toBeEnabled()
  })

  it('hides End tournament for a completed tournament', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([completedTournament])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t2" />)

    await screen.findByText('Completed T')
    expect(screen.queryByRole('button', { name: 'End tournament' })).toBeNull()
  })

  it('opens a confirm dialog on End tournament and only calls endTournament/onEnded on Confirm', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(tournamentsApi.endTournament).mockResolvedValue({
      ...activeTournament,
      status: 'completed',
    })
    const onEnded = vi.fn()

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" onEnded={onEnded} />)

    await user.click(await screen.findByRole('button', { name: 'End tournament' }))

    expect(await screen.findByText('End this tournament?')).toBeInTheDocument()
    expect(tournamentsApi.endTournament).not.toHaveBeenCalled()
    expect(onEnded).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Yes, end tournament' }))

    await waitFor(() => {
      expect(tournamentsApi.endTournament).toHaveBeenCalledWith('t1')
    })
    await waitFor(() => {
      expect(onEnded).toHaveBeenCalledTimes(1)
    })
  })
})
