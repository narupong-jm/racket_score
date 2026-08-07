import { render, screen, waitFor, within } from '@testing-library/react'
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
import type { Tournament, TournamentParticipant } from './tournamentsApi'
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
    cancelTournament: vi.fn(),
    leaveParticipant: vi.fn(),
    addParticipant: vi.fn(),
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
  const actual =
    await importOriginal<typeof import('../matchmaking/generateNextMatch')>()
  return {
    ...actual,
    generateNextMatch: vi.fn(),
  }
})

vi.mock('../passphrase/usePassphraseGate', () => ({
  usePassphraseGate: () => ({
    getPassphrase: vi.fn().mockResolvedValue('test-passphrase'),
  }),
}))

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
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
  {
    id: 'p1',
    name: 'Alice',
    gender: 'female',
    self_selected_level: 'beginner',
    created_at: '',
  },
  {
    id: 'p2',
    name: 'Bob',
    gender: 'male',
    self_selected_level: 'beginner',
    created_at: '',
  },
]

const twoCandidates: CandidatePlayer[] = [
  { id: 'p1', gender: 'female', skillValue: 50, matchesPlayedInTournament: 0 },
  { id: 'p2', gender: 'male', skillValue: 50, matchesPlayedInTournament: 0 },
]

function makeMatch(
  id: string,
  sequenceNumber: number,
  status: 'queued' | 'completed',
): Match {
  return {
    id,
    tournament_id: 't1',
    sequence_number: sequenceNumber,
    status,
    created_at: '2026-01-01T00:00:00Z',
    completed_at: status === 'completed' ? '2026-01-01T00:00:00Z' : null,
    manually_adjusted: false,
  }
}

function makeParticipant(
  playerId: string,
  status: 'active' | 'left' = 'active',
): TournamentParticipant {
  return {
    tournament_id: 't1',
    player_id: playerId,
    joined_at: '2026-01-01T00:00:00Z',
    status,
    match_count_offset: 0,
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
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(
      await screen.findByText(
        'No match in progress -- start the next match below',
      ),
    ).toBeInTheDocument()
  })
})

describe('TournamentDetail: Next match card (Randomize / Start match)', () => {
  it('Randomize populates Next only -- Current stays empty and no match is persisted', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
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

    await screen.findByText(
      'No match in progress -- start the next match below',
    )
    await user.click(await screen.findByRole('button', { name: 'Randomize' }))

    expect(await screen.findByText('Alice vs Bob')).toBeInTheDocument()
    expect(
      screen.getByText('No match in progress -- start the next match below'),
    ).toBeInTheDocument()
    expect(matchesApi.createMatch).not.toHaveBeenCalled()
  })

  it('Start match promotes Next into Current (persisting it) and resets Current to fresh inputs', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()

    let matchesState: Match[] = []
    let participantsState: MatchHistoryEntry[] = []
    vi.mocked(matchesApi.listMatches).mockImplementation(
      async () => matchesState,
    )
    vi.mocked(matchesApi.getParticipantsForMatches).mockImplementation(
      async (ids: string[]) =>
        participantsState.filter((p) => ids.includes(p.match_id)),
    )
    vi.mocked(matchesApi.createMatch).mockImplementation(
      async (_tournamentId, seq, participants) => {
        const match = makeMatch('m-new', seq, 'queued')
        matchesState = [...matchesState, match]
        participantsState = [
          ...participantsState,
          ...participants.map((p) => ({
            match_id: match.id,
            player_id: p.player_id,
            team: p.team,
          })),
        ]
        return match
      },
    )
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 2 },
      ],
    })

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByText(
      'No match in progress -- start the next match below',
    )
    await user.click(await screen.findByRole('button', { name: 'Randomize' }))
    await screen.findByText('Alice vs Bob')

    await user.click(screen.getByRole('button', { name: 'Start match' }))

    await waitFor(() => {
      expect(matchesApi.createMatch).toHaveBeenCalledWith(
        't1',
        1,
        [
          { player_id: 'p1', team: 1 },
          { player_id: 'p2', team: 2 },
        ],
        'test-passphrase',
        false,
      )
    })

    // Current is now populated with the promoted pairing...
    await waitFor(() => {
      expect(
        screen.queryByText(
          'No match in progress -- start the next match below',
        ),
      ).toBeNull()
    })
    expect(screen.getAllByText('Alice vs Bob').length).toBeGreaterThan(0)

    // ...with fresh, empty score inputs.
    const scoreInput = screen.getByRole('spinbutton', {
      name: 'Alice -- Game 1',
    })
    expect(scoreInput).toHaveValue(null)

    // ...and Next is cleared back to empty.
    expect(screen.getByText('Not picked yet')).toBeInTheDocument()
  })

  it('excludes the Current match participants from the Next-match candidate pool', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      ...players,
      {
        id: 'p3',
        name: 'Carol',
        gender: 'male',
        self_selected_level: 'beginner',
        created_at: '',
      },
      {
        id: 'p4',
        name: 'Dave',
        gender: 'female',
        self_selected_level: 'beginner',
        created_at: '',
      },
    ])
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: [
        {
          id: 'p1',
          gender: 'female',
          skillValue: 50,
          matchesPlayedInTournament: 1,
        },
        {
          id: 'p2',
          gender: 'male',
          skillValue: 50,
          matchesPlayedInTournament: 1,
        },
        {
          id: 'p3',
          gender: 'male',
          skillValue: 50,
          matchesPlayedInTournament: 0,
        },
        {
          id: 'p4',
          gender: 'female',
          skillValue: 50,
          matchesPlayedInTournament: 0,
        },
      ],
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'queued'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
    ])
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p3', team: 1 },
        { playerId: 'p4', team: 2 },
      ],
    })

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(await screen.findByRole('button', { name: 'Randomize' }))

    await waitFor(() => {
      expect(generateNextMatchModule.generateNextMatch).toHaveBeenCalled()
    })
    const [, calledCandidates] = vi.mocked(
      generateNextMatchModule.generateNextMatch,
    ).mock.calls[0]
    expect(calledCandidates.map((c) => c.id).sort()).toEqual(['p3', 'p4'])

    expect(
      screen.queryByText(
        'Not enough other players available -- this draw reuses someone currently playing in the Current match.',
      ),
    ).toBeNull()
  })

  it('falls back to reusing a Current match participant, with a warning, when too few other players remain', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'queued'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
    ])
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 2 },
      ],
    })

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(await screen.findByRole('button', { name: 'Randomize' }))

    await waitFor(() => {
      expect(generateNextMatchModule.generateNextMatch).toHaveBeenCalled()
    })
    const [, calledCandidates] = vi.mocked(
      generateNextMatchModule.generateNextMatch,
    ).mock.calls[0]
    expect(calledCandidates.map((c) => c.id).sort()).toEqual(['p1', 'p2'])

    expect(
      await screen.findByText(
        'Not enough other players available -- this draw reuses someone currently playing in the Current match.',
      ),
    ).toBeInTheDocument()
  })
})

describe('TournamentDetail: Next match inline edit', () => {
  it('allows editing the Next match draw before starting it, marking it as manually adjusted', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      {
        tournament_id: 't1',
        player_id: 'p1',
        joined_at: '2026-01-01T00:00:00Z',
        status: 'active',
        match_count_offset: 0,
      },
      {
        tournament_id: 't1',
        player_id: 'p2',
        joined_at: '2026-01-01T00:00:00Z',
        status: 'active',
        match_count_offset: 0,
      },
      {
        tournament_id: 't1',
        player_id: 'p3',
        joined_at: '2026-01-01T00:00:00Z',
        status: 'active',
        match_count_offset: 0,
      },
    ])
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      ...players,
      {
        id: 'p3',
        name: 'Carol',
        gender: 'female',
        self_selected_level: 'beginner',
        created_at: '',
      },
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 2 },
      ],
    })
    vi.mocked(matchesApi.createMatch).mockResolvedValue(
      makeMatch('m-new', 1, 'queued'),
    )

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(await screen.findByRole('button', { name: 'Randomize' }))
    await screen.findByText('Alice vs Bob')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const team1Slot = screen.getByRole('combobox', { name: 'Team 1 player 1' })
    await user.selectOptions(team1Slot, 'p3')

    await user.click(screen.getByRole('button', { name: 'Start match' }))

    await waitFor(() => {
      expect(matchesApi.createMatch).toHaveBeenCalledWith(
        't1',
        1,
        [
          { player_id: 'p3', team: 1 },
          { player_id: 'p2', team: 2 },
        ],
        'test-passphrase',
        true,
      )
    })
  })

  it('shows a non-blocking warning when an edit leaves a 2-2 doubles quartet split into same-gender teams', async () => {
    const doublesTournament: Tournament = {
      ...activeTournament,
      type: 'doubles',
    }
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      doublesTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      {
        tournament_id: 't1',
        player_id: 'p1',
        joined_at: '2026-01-01T00:00:00Z',
        status: 'active',
        match_count_offset: 0,
      },
      {
        tournament_id: 't1',
        player_id: 'p2',
        joined_at: '2026-01-01T00:00:00Z',
        status: 'active',
        match_count_offset: 0,
      },
      {
        tournament_id: 't1',
        player_id: 'p3',
        joined_at: '2026-01-01T00:00:00Z',
        status: 'active',
        match_count_offset: 0,
      },
      {
        tournament_id: 't1',
        player_id: 'p4',
        joined_at: '2026-01-01T00:00:00Z',
        status: 'active',
        match_count_offset: 0,
      },
      {
        tournament_id: 't1',
        player_id: 'p5',
        joined_at: '2026-01-01T00:00:00Z',
        status: 'active',
        match_count_offset: 0,
      },
    ])
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      {
        id: 'p1',
        name: 'Ann',
        gender: 'male',
        self_selected_level: 'beginner',
        created_at: '',
      },
      {
        id: 'p2',
        name: 'Ben',
        gender: 'male',
        self_selected_level: 'beginner',
        created_at: '',
      },
      {
        id: 'p3',
        name: 'Cid',
        gender: 'female',
        self_selected_level: 'beginner',
        created_at: '',
      },
      {
        id: 'p4',
        name: 'Dee',
        gender: 'female',
        self_selected_level: 'beginner',
        created_at: '',
      },
      {
        id: 'p5',
        name: 'Eve',
        gender: 'male',
        self_selected_level: 'beginner',
        created_at: '',
      },
    ])
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: [
        {
          id: 'p1',
          gender: 'male',
          skillValue: 50,
          matchesPlayedInTournament: 0,
        },
        {
          id: 'p2',
          gender: 'male',
          skillValue: 50,
          matchesPlayedInTournament: 0,
        },
        {
          id: 'p3',
          gender: 'female',
          skillValue: 50,
          matchesPlayedInTournament: 0,
        },
        {
          id: 'p4',
          gender: 'female',
          skillValue: 50,
          matchesPlayedInTournament: 0,
        },
      ],
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 1 },
        { playerId: 'p3', team: 2 },
        { playerId: 'p4', team: 2 },
      ],
    })
    vi.mocked(matchesApi.createMatch).mockResolvedValue(
      makeMatch('m-new', 1, 'queued'),
    )

    const warningText =
      "This lineup isn't gender-mixed, though a mixed pairing was possible."

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(await screen.findByRole('button', { name: 'Randomize' }))
    await screen.findByText('Ann & Ben vs Cid & Dee')
    expect(screen.queryByText(warningText)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const team1SecondSlot = screen.getByRole('combobox', {
      name: 'Team 1 player 2',
    })
    await user.selectOptions(team1SecondSlot, 'p5')

    expect(await screen.findByText(warningText)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start match' }))

    await waitFor(() => {
      expect(matchesApi.createMatch).toHaveBeenCalledWith(
        't1',
        1,
        [
          { player_id: 'p1', team: 1 },
          { player_id: 'p5', team: 1 },
          { player_id: 'p3', team: 2 },
          { player_id: 'p4', team: 2 },
        ],
        'test-passphrase',
        true,
      )
    })
  })
})

describe('TournamentDetail: Save result confirm dialog', () => {
  it('opens a confirm dialog on Save result and only calls recordMatchResult on Confirm', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'queued'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
    ])
    vi.mocked(matchesApi.recordMatchResult).mockResolvedValue(
      makeMatch('m1', 1, 'completed'),
    )

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const team1Input = await screen.findByRole('spinbutton', {
      name: 'Alice -- Game 1',
    })
    const team2Input = screen.getByRole('spinbutton', { name: 'Bob -- Game 1' })
    await user.type(team1Input, '21')
    await user.type(team2Input, '15')

    // No Next match has been drawn in this scenario, so Save result stays
    // locked until "Is last match" is checked (see the dedicated lock tests
    // below for the no-checkbox / Next-drawn cases).
    expect(screen.getByRole('button', { name: 'Save result' })).toBeDisabled()
    await user.click(
      screen.getByRole('checkbox', { name: 'This is the last match' }),
    )

    await user.click(screen.getByRole('button', { name: 'Save result' }))

    expect(await screen.findByText('Confirm this result?')).toBeInTheDocument()
    expect(matchesApi.recordMatchResult).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Confirm result' }))

    await waitFor(() => {
      expect(matchesApi.recordMatchResult).toHaveBeenCalledWith(
        'm1',
        [{ game_number: 1, team1_score: 21, team2_score: 15 }],
        'test-passphrase',
      )
    })
  })

  it('locks Save result until a Next match is drawn, unless "Is last match" is checked', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'queued'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
    ])
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p3', team: 1 },
        { playerId: 'p4', team: 2 },
      ],
    })

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const team1Input = await screen.findByRole('spinbutton', {
      name: 'Alice -- Game 1',
    })
    const team2Input = screen.getByRole('spinbutton', { name: 'Bob -- Game 1' })
    await user.type(team1Input, '21')
    await user.type(team2Input, '15')

    expect(screen.getByRole('button', { name: 'Save result' })).toBeDisabled()
    expect(
      screen.getByText(
        'Draw the Next match before saving this result, or check "This is the last match".',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Randomize' }))
    await screen.findByText('p3 vs p4')

    expect(screen.getByRole('button', { name: 'Save result' })).toBeEnabled()
    expect(
      screen.queryByText(
        'Draw the Next match before saving this result, or check "This is the last match".',
      ),
    ).not.toBeInTheDocument()
  })

  it('unchecking "Is last match" re-locks Save result if no Next match is drawn', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'queued'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
    ])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const team1Input = await screen.findByRole('spinbutton', {
      name: 'Alice -- Game 1',
    })
    const team2Input = screen.getByRole('spinbutton', { name: 'Bob -- Game 1' })
    await user.type(team1Input, '21')
    await user.type(team2Input, '15')

    const checkbox = screen.getByRole('checkbox', {
      name: 'This is the last match',
    })
    await user.click(checkbox)
    expect(screen.getByRole('button', { name: 'Save result' })).toBeEnabled()

    await user.click(checkbox)
    expect(screen.getByRole('button', { name: 'Save result' })).toBeDisabled()
  })
})

describe('TournamentDetail: End tournament confirm dialog', () => {
  it('shows an enabled End tournament button for an active tournament with a confirmed result', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'completed'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(
      await screen.findByRole('button', { name: 'End tournament' }),
    ).toBeEnabled()
  })

  it('hides End tournament for a completed tournament', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      completedTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'completed'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t2" />)

    await screen.findByText('Completed T')
    expect(screen.queryByRole('button', { name: 'End tournament' })).toBeNull()
  })

  it('hides End tournament for an active tournament with zero confirmed results', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByText('Active T')
    expect(screen.queryByRole('button', { name: 'End tournament' })).toBeNull()
  })

  it('opens a confirm dialog on End tournament and only calls endTournament/onEnded on Confirm', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'completed'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(tournamentsApi.endTournament).mockResolvedValue({
      ...activeTournament,
      status: 'completed',
    })
    const onEnded = vi.fn()

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" onEnded={onEnded} />)

    await user.click(
      await screen.findByRole('button', { name: 'End tournament' }),
    )

    expect(await screen.findByText('End this tournament?')).toBeInTheDocument()
    expect(tournamentsApi.endTournament).not.toHaveBeenCalled()
    expect(onEnded).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: 'Yes, end tournament' }),
    )

    await waitFor(() => {
      expect(tournamentsApi.endTournament).toHaveBeenCalledWith(
        't1',
        'test-passphrase',
      )
    })
    await waitFor(() => {
      expect(onEnded).toHaveBeenCalledTimes(1)
    })
  })
})

describe('TournamentDetail: Cancel tournament confirm dialog', () => {
  it('shows an enabled Cancel tournament button for an active tournament with zero confirmed results', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(
      await screen.findByRole('button', { name: 'Cancel tournament' }),
    ).toBeEnabled()
  })

  it('hides Cancel tournament once a confirmed result exists', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'completed'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(
      await screen.findByRole('button', { name: 'End tournament' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cancel tournament' }),
    ).toBeNull()
  })

  it('hides Cancel tournament for a non-active tournament', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      completedTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t2" />)

    await screen.findByText('Completed T')
    expect(
      screen.queryByRole('button', { name: 'Cancel tournament' }),
    ).toBeNull()
  })

  it('opens a confirm dialog on Cancel tournament and only calls cancelTournament/onCancelled on Confirm', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(tournamentsApi.cancelTournament).mockResolvedValue({
      ...activeTournament,
      status: 'cancelled',
    })
    const onCancelled = vi.fn()

    const user = userEvent.setup()
    renderWithClient(
      <TournamentDetail tournamentId="t1" onCancelled={onCancelled} />,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Cancel tournament' }),
    )

    expect(
      await screen.findByText('Cancel this tournament?'),
    ).toBeInTheDocument()
    expect(tournamentsApi.cancelTournament).not.toHaveBeenCalled()
    expect(onCancelled).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: 'Yes, cancel tournament' }),
    )

    await waitFor(() => {
      expect(tournamentsApi.cancelTournament).toHaveBeenCalledWith(
        't1',
        'test-passphrase',
      )
    })
    await waitFor(() => {
      expect(onCancelled).toHaveBeenCalledTimes(1)
    })
  })
})

describe('TournamentDetail: Leave participant', () => {
  it('shows an enabled Leave button for an active participant not on the Current match', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
      makeParticipant('p2'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const leaveButtons = await screen.findAllByRole('button', { name: 'Leave' })
    expect(leaveButtons).toHaveLength(2)
    expect(leaveButtons[0]).toBeEnabled()
    expect(leaveButtons[1]).toBeEnabled()
  })

  it('disables the Leave button only for participants who are part of the queued Current match', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      ...players,
      {
        id: 'p3',
        name: 'Carol',
        gender: 'female',
        self_selected_level: 'beginner',
        created_at: '',
      },
    ])
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
      makeParticipant('p2'),
      makeParticipant('p3'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'queued'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
    ])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const leaveButtons = await screen.findAllByRole('button', { name: 'Leave' })
    expect(leaveButtons).toHaveLength(3)
    expect(leaveButtons[0]).toBeDisabled() // Alice (p1) -- in Current match
    expect(leaveButtons[1]).toBeDisabled() // Bob (p2) -- in Current match
    expect(leaveButtons[2]).toBeEnabled() // Carol (p3) -- not in Current match
  })

  it('hides the Leave button entirely for a non-active tournament', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      completedTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t2" />)

    await screen.findByText('Completed T')
    expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull()
  })

  it('renders a left participant greyed out with a Left badge and no Leave button', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
      makeParticipant('p2', 'left'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    // Bob (left) also reappears as an Add-participant option (the rejoin surface) --
    // scope to the participants list to avoid matching that <option>'s text too.
    const list = await screen.findByRole('list')
    const bobRow = within(list).getByText('Bob').closest('li')
    expect(bobRow).not.toBeNull()
    expect(bobRow).toHaveClass('participant-left')
    expect(within(bobRow!).getByText('Left')).toBeInTheDocument()
    expect(within(bobRow!).queryByRole('button', { name: 'Leave' })).toBeNull()

    // Alice (still active) keeps her Leave button
    expect(
      within(list).getByRole('button', { name: 'Leave' }),
    ).toBeInTheDocument()
  })

  it('opens a confirm dialog on Leave and only calls leaveParticipant on Confirm', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
      makeParticipant('p2'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(tournamentsApi.leaveParticipant).mockResolvedValue(
      makeParticipant('p2', 'left'),
    )

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const leaveButtons = await screen.findAllByRole('button', { name: 'Leave' })
    await user.click(leaveButtons[1]) // Bob (p2)

    expect(
      await screen.findByText('Remove Bob from this tournament?'),
    ).toBeInTheDocument()
    expect(tournamentsApi.leaveParticipant).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))

    await waitFor(() => {
      expect(tournamentsApi.leaveParticipant).toHaveBeenCalledWith(
        't1',
        'p2',
        'test-passphrase',
      )
    })
  })

  it('clears the Next match draw when the left participant was part of it', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
      makeParticipant('p2'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 2 },
      ],
    })
    vi.mocked(tournamentsApi.leaveParticipant).mockResolvedValue(
      makeParticipant('p2', 'left'),
    )

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(await screen.findByRole('button', { name: 'Randomize' }))
    await screen.findByText('Alice vs Bob')

    const leaveButtons = screen.getAllByRole('button', { name: 'Leave' })
    await user.click(leaveButtons[1]) // Bob, who is part of the Next match draw
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))

    await waitFor(() => {
      expect(screen.getByText('Not picked yet')).toBeInTheDocument()
    })
  })

  it('does not clear the Next match draw when the left participant was not part of it', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      ...players,
      {
        id: 'p3',
        name: 'Carol',
        gender: 'female',
        self_selected_level: 'beginner',
        created_at: '',
      },
    ])
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
      makeParticipant('p2'),
      makeParticipant('p3'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 2 },
      ],
    })
    vi.mocked(tournamentsApi.leaveParticipant).mockResolvedValue(
      makeParticipant('p3', 'left'),
    )

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(await screen.findByRole('button', { name: 'Randomize' }))
    await screen.findByText('Alice vs Bob')

    const leaveButtons = screen.getAllByRole('button', { name: 'Leave' })
    await user.click(leaveButtons[2]) // Carol, who is not part of the Next match draw
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))

    await waitFor(() => {
      expect(tournamentsApi.leaveParticipant).toHaveBeenCalledWith(
        't1',
        'p3',
        'test-passphrase',
      )
    })
    expect(screen.getByText('Alice vs Bob')).toBeInTheDocument()
    expect(screen.queryByText('Not picked yet')).toBeNull()
  })
})

describe('TournamentDetail: Add participant', () => {
  it('shows the picker and Add button for an active tournament', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1', 'left'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(await screen.findByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('hides the picker and Add button entirely for a non-active tournament', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      completedTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t2" />)

    await screen.findByText('Completed T')
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull()
  })

  it('excludes active participants from the picker but includes a left participant, surfacing rejoin', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
      makeParticipant('p2', 'left'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const select = await screen.findByRole('combobox')
    const optionNames = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(optionNames).not.toContain('Alice') // p1 is active -- excluded from the picker
    expect(optionNames).toContain('Bob') // p2 left -- reappears, the only rejoin surface
  })

  it('selecting a player and clicking Add calls addParticipant directly, with no confirm dialog', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1', 'left'),
      makeParticipant('p2', 'left'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(tournamentsApi.addParticipant).mockResolvedValue(
      makeParticipant('p1'),
    )

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const select = await screen.findByRole('combobox')
    await user.selectOptions(select, 'p1')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(tournamentsApi.addParticipant).toHaveBeenCalledWith(
        't1',
        'p1',
        'test-passphrase',
      )
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the empty-pool message instead of the picker when everyone is already active', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
      makeParticipant('p2'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(
      await screen.findByText(
        'Everyone in the member pool is already active in this tournament.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('shows an error message when addParticipant is rejected', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1', 'left'),
      makeParticipant('p2', 'left'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(tournamentsApi.addParticipant).mockRejectedValue(
      new Error('boom'),
    )

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const select = await screen.findByRole('combobox')
    await user.selectOptions(select, 'p1')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(
      await screen.findByText(
        "Couldn't add that participant. Please try again.",
      ),
    ).toBeInTheDocument()
  })
})
