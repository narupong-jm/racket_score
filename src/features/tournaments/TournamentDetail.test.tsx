import { act, render, screen, waitFor, within } from '@testing-library/react'
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
import type { Player, PlayerStats } from '../players/playersApi'
import type { Match, MatchHistoryEntry } from '../matches/matchesApi'
import type { CandidatePlayer } from '../matchmaking/types'
import { getQueue, setQueue, type QueuedMatch } from '../../lib/matchQueueStore'

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
    deleteMatchResult: vi.fn(),
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
  sport: 'badminton',
  games_per_match: 1,
  points_per_game: 21,
  win_by: 2,
  point_cap: 30,
  status: 'active',
  court_count: 1,
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
    badminton_self_selected_level: 'beginner',
    tennis_self_selected_level: 'beginner',
    created_at: '',
  },
  {
    id: 'p2',
    name: 'Bob',
    gender: 'male',
    badminton_self_selected_level: 'beginner',
    tennis_self_selected_level: 'beginner',
    created_at: '',
  },
]

const playerStats: PlayerStats[] = players.map((p) => ({
  player_id: p.id,
  name: p.name,
  gender: p.gender,
  sport: 'badminton',
  self_selected_level: 'beginner',
  total_matches: 0,
  total_wins: 0,
  win_rate: null,
  effective_level: 'beginner',
}))

const twoCandidates: CandidatePlayer[] = [
  { id: 'p1', gender: 'female', skillValue: 50, matchesPlayedInTournament: 0 },
  { id: 'p2', gender: 'male', skillValue: 50, matchesPlayedInTournament: 0 },
]

function makeMatch(
  id: string,
  sequenceNumber: number,
  status: 'queued' | 'completed',
  courtNumber: number | null = null,
): Match {
  return {
    id,
    tournament_id: 't1',
    sequence_number: sequenceNumber,
    status,
    created_at: '2026-01-01T00:00:00Z',
    court_number: courtNumber,
    completed_at: status === 'completed' ? '2026-01-01T00:00:00Z' : null,
    manually_adjusted: false,
  }
}

const twoCourtTournament: Tournament = { ...activeTournament, court_count: 2 }

function makePlayer(
  id: string,
  name: string,
  gender: 'male' | 'female',
): Player {
  return {
    id,
    name,
    gender,
    badminton_self_selected_level: 'beginner',
    tennis_self_selected_level: 'beginner',
    created_at: '',
  }
}

const fourPlayers: Player[] = [
  ...players,
  makePlayer('p3', 'Carol', 'female'),
  makePlayer('p4', 'Dave', 'male'),
]

const fourCandidates: CandidatePlayer[] = [
  ...twoCandidates,
  { id: 'p3', gender: 'female', skillValue: 50, matchesPlayedInTournament: 0 },
  { id: 'p4', gender: 'male', skillValue: 50, matchesPlayedInTournament: 0 },
]

/** A not-yet-adjusted singles queue entry: a (team 1) vs b (team 2). */
function singles(a: string, b: string): QueuedMatch {
  return {
    participants: [
      { playerId: a, team: 1 },
      { playerId: b, team: 2 },
    ],
    manuallyAdjusted: false,
  }
}

function seedQueue(queue: QueuedMatch[], tournamentId = 't1') {
  setQueue(tournamentId, queue)
}

function queueCard(): HTMLElement {
  return screen.getByRole('heading', { name: /^Queue \(/ }).closest('section')!
}

/**
 * listMatches/getParticipantsForMatches backed by in-memory state that
 * createMatch appends to, so a Start shows up after the refetch.
 */
function stubStatefulMatches() {
  let matchesState: Match[] = []
  let participantsState: MatchHistoryEntry[] = []
  vi.mocked(matchesApi.listMatches).mockImplementation(async () => matchesState)
  vi.mocked(matchesApi.getParticipantsForMatches).mockImplementation(
    async (ids: string[]) =>
      participantsState.filter((p) => ids.includes(p.match_id)),
  )
  vi.mocked(matchesApi.createMatch).mockImplementation(
    async (_tournamentId, courtNumber, participants) => {
      const match = makeMatch(
        `m${matchesState.length + 1}`,
        matchesState.length + 1,
        'queued',
        courtNumber,
      )
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
  vi.mocked(playersApi.listPlayerStats).mockResolvedValue(playerStats)
  vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([])
  vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
    candidates: twoCandidates,
    pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
  })
  vi.mocked(matchesApi.listGamesForMatches).mockResolvedValue([])
}

afterEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('TournamentDetail: Courts (multi-court)', () => {
  it('shows a free one-court strip whose Start is disabled with a hint while the queue is empty', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const strip = (await screen.findByText('Court 1 · free')).closest('li')!
    expect(within(strip).getByRole('button', { name: 'Start' })).toBeDisabled()
    expect(
      within(strip).getByText('Draw a match into the queue first'),
    ).toBeInTheDocument()
  })

  it('renders courts in court-number order: a full card for an in-progress court and a one-line strip for a free one, with the Queue below', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m3', 3, 'queued', 2),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm3', player_id: 'p1', team: 1 },
      { match_id: 'm3', player_id: 'p2', team: 2 },
    ])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const court2Heading = await screen.findByRole('heading', {
      name: 'Court 2 · Match 3',
    })
    const court2Card = court2Heading.closest('li')!
    expect(within(court2Card).getByText('Alice vs Bob')).toBeInTheDocument()
    expect(
      within(court2Card).getByRole('spinbutton', { name: 'Alice -- Game 1' }),
    ).toBeInTheDocument()
    expect(
      within(court2Card).getByRole('button', { name: 'Save result' }),
    ).toBeInTheDocument()

    const court1Strip = screen.getByText('Court 1 · free').closest('li')!
    expect(within(court1Strip).queryByRole('spinbutton')).toBeNull()

    const queueHeading = screen.getByRole('heading', { name: 'Queue (0/3)' })
    // Court 1 strip, then Court 2 card, then the Queue.
    expect(
      court1Strip.compareDocumentPosition(court2Card) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      court2Card.compareDocumentPosition(queueHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('Start on a free court starts the queue HEAD on that court, shrinks the queue and shows the court with fresh score inputs', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    stubStatefulMatches()
    seedQueue([
      singles('p1', 'p2'),
      { ...singles('p3', 'p4'), manuallyAdjusted: true },
    ])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const court2Strip = (await screen.findByText('Court 2 · free')).closest(
      'li',
    )!
    await user.click(
      within(court2Strip).getByRole('button', { name: 'Start ▶ Alice vs Bob' }),
    )

    await waitFor(() => {
      expect(matchesApi.createMatch).toHaveBeenCalledWith(
        't1',
        2,
        [
          { player_id: 'p1', team: 1 },
          { player_id: 'p2', team: 2 },
        ],
        'test-passphrase',
        false,
      )
    })

    const court2Card = (
      await screen.findByRole('heading', { name: 'Court 2 · Match 1' })
    ).closest('li')!
    expect(
      within(court2Card).getByRole('spinbutton', { name: 'Alice -- Game 1' }),
    ).toHaveValue(null)
    expect(screen.getByText('Court 1 · free')).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { name: 'Queue (1/3)' }),
    ).toBeInTheDocument()
    expect(getQueue('t1')).toEqual([
      { ...singles('p3', 'p4'), manuallyAdjusted: true },
    ])
    // The remaining free court now offers the new head.
    expect(
      within(screen.getByText('Court 1 · free').closest('li')!).getByRole(
        'button',
        { name: 'Start ▶ Carol vs Dave' },
      ),
    ).toBeEnabled()
  })

  it('blocks Start (disabled, with the names) when a head player is still playing on another court', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'queued', 1),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p3', team: 2 },
    ])
    seedQueue([singles('p1', 'p2')])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const court2Strip = (await screen.findByText('Court 2 · free')).closest(
      'li',
    )!
    expect(
      within(court2Strip).getByRole('button', { name: 'Start ▶ Alice vs Bob' }),
    ).toBeDisabled()
    expect(
      within(court2Strip).getByText('Alice still playing on another court'),
    ).toBeInTheDocument()
  })

  it('disables Start for a tournament that is no longer active', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      completedTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    seedQueue([singles('p1', 'p2')], 't2')

    renderWithClient(<TournamentDetail tournamentId="t2" />)

    const strip = (await screen.findByText('Court 1 · free')).closest('li')!
    expect(
      within(strip).getByRole('button', { name: 'Start ▶ Alice vs Bob' }),
    ).toBeDisabled()
  })
})

describe('TournamentDetail: Queue (Randomize / Fill queue / Remove)', () => {
  it('shows the empty state and Randomize adds exactly one match to the queue without persisting a match', async () => {
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

    expect(
      await screen.findByText('No matches in the queue'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Queue (0/2)' }),
    ).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Randomize' }))

    expect(
      await screen.findByRole('heading', { name: 'Queue (1/2)' }),
    ).toBeInTheDocument()
    expect(generateNextMatchModule.generateNextMatch).toHaveBeenCalledTimes(1)
    const queueSection = queueCard()
    expect(within(queueSection).getByText('Alice vs Bob')).toBeInTheDocument()
    expect(screen.queryByText('No matches in the queue')).toBeNull()
    expect(getQueue('t1')).toEqual([singles('p1', 'p2')])
    expect(matchesApi.createMatch).not.toHaveBeenCalled()
  })

  it('Fill queue fills the queue to courts + 1, then both draw buttons are disabled as full', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: fourCandidates,
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(generateNextMatchModule.generateNextMatch)
      .mockReturnValueOnce({
        ok: true,
        participants: [
          { playerId: 'p1', team: 1 },
          { playerId: 'p2', team: 2 },
        ],
      })
      .mockReturnValueOnce({
        ok: true,
        participants: [
          { playerId: 'p3', team: 1 },
          { playerId: 'p4', team: 2 },
        ],
      })
      .mockReturnValueOnce({
        ok: true,
        participants: [
          { playerId: 'p1', team: 1 },
          { playerId: 'p3', team: 2 },
        ],
      })

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(await screen.findByRole('button', { name: 'Fill queue' }))

    expect(
      await screen.findByRole('heading', { name: 'Queue (3/3)' }),
    ).toBeInTheDocument()
    expect(generateNextMatchModule.generateNextMatch).toHaveBeenCalledTimes(3)
    expect(getQueue('t1')).toEqual([
      singles('p1', 'p2'),
      singles('p3', 'p4'),
      singles('p1', 'p3'),
    ])
    expect(screen.getByRole('button', { name: 'Randomize' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Fill queue' })).toBeDisabled()
    expect(screen.getByText('Queue is full')).toBeInTheDocument()
  })

  it('Fill queue only draws the missing slots', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    seedQueue([singles('p1', 'p2'), singles('p3', 'p4')])
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p3', team: 2 },
      ],
    })

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(await screen.findByRole('button', { name: 'Fill queue' }))

    expect(
      await screen.findByRole('heading', { name: 'Queue (3/3)' }),
    ).toBeInTheDocument()
    expect(generateNextMatchModule.generateNextMatch).toHaveBeenCalledTimes(1)
  })

  it('treats in-progress and already-queued matches as planned (+1 match each) when drawing', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: fourCandidates,
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'queued', 1),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
    ])
    seedQueue([singles('p1', 'p3')])
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p4', team: 1 },
        { playerId: 'p2', team: 2 },
      ],
    })

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByRole('heading', { name: 'Court 1 · Match 1' })
    await user.click(await screen.findByRole('button', { name: 'Randomize' }))

    await waitFor(() => {
      expect(generateNextMatchModule.generateNextMatch).toHaveBeenCalled()
    })
    const [, calledCandidates] = vi.mocked(
      generateNextMatchModule.generateNextMatch,
    ).mock.calls[0]
    expect(
      Object.fromEntries(
        calledCandidates.map((c) => [c.id, c.matchesPlayedInTournament]),
      ),
    ).toEqual({ p1: 2, p2: 1, p3: 1, p4: 0 })
  })

  it('warns with the reused players’ names when a draw reuses someone already in progress, and clears it on Remove', async () => {
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

    await screen.findByRole('heading', { name: 'Court 1 · Match 1' })
    await user.click(screen.getByRole('button', { name: 'Randomize' }))

    const warning = 'Alice, Bob already in another queued or in-progress match'
    expect(await screen.findByText(warning)).toBeInTheDocument()

    await user.click(
      within(queueCard()).getByRole('button', { name: /^Remove/ }),
    )
    await waitFor(() => {
      expect(screen.queryByText(warning)).toBeNull()
    })
    expect(screen.getByText('No matches in the queue')).toBeInTheDocument()
  })

  it('Remove drops exactly the chosen queue entry', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    seedQueue([singles('p1', 'p2'), singles('p3', 'p4'), singles('p1', 'p3')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByRole('heading', { name: 'Queue (3/3)' })
    await user.click(
      screen.getByRole('button', { name: 'Remove 2. Carol vs Dave' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Queue (2/3)' }),
    ).toBeInTheDocument()
    expect(getQueue('t1')).toEqual([singles('p1', 'p2'), singles('p1', 'p3')])
    expect(within(queueCard()).queryByText('Carol vs Dave')).toBeNull()
  })

  it('shows the not-enough-players message when the draw cannot produce a match', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: false,
      error: 'not_enough_players',
    })

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(await screen.findByRole('button', { name: 'Randomize' }))

    expect(
      await screen.findByText('Not enough players to draw a match.'),
    ).toBeInTheDocument()
    expect(getQueue('t1')).toEqual([])
  })

  it('disables both draw buttons with a count message when the roster is smaller than one match', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: [twoCandidates[0]],
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(
      await screen.findByText(
        'Not enough players to draw a match. Need at least 2, have 1.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Randomize' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Fill queue' })).toBeDisabled()
  })

  it('disables both draw buttons for a tournament that is no longer active', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      completedTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t2" />)

    await screen.findByText('Completed T')
    expect(
      await screen.findByRole('button', { name: 'Randomize' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Fill queue' })).toBeDisabled()
  })
})

describe('TournamentDetail: Queue entry inline edit', () => {
  it('editing a queued match swaps the player and marks it manually adjusted, which Start passes on', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
      makeParticipant('p2'),
      makeParticipant('p3'),
    ])
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(matchesApi.createMatch).mockResolvedValue(
      makeMatch('m-new', 1, 'queued', 1),
    )
    seedQueue([singles('p1', 'p2')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'Edit 1. Alice vs Bob' }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Team 1 player 1' }),
      'p3',
    )
    await user.click(screen.getByRole('button', { name: 'Done editing' }))

    expect(getQueue('t1')).toEqual([
      {
        participants: [
          { playerId: 'p3', team: 1 },
          { playerId: 'p2', team: 2 },
        ],
        manuallyAdjusted: true,
      },
    ])

    await user.click(
      await screen.findByRole('button', { name: 'Start ▶ Carol vs Bob' }),
    )

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

  it('edits only the chosen queue entry', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue(
      ['p1', 'p2', 'p3', 'p4'].map((id) => makeParticipant(id)),
    )
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    seedQueue([singles('p1', 'p2'), singles('p3', 'p4')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'Edit 2. Carol vs Dave' }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Team 2 player 1' }),
      'p2',
    )

    expect(getQueue('t1')).toEqual([
      singles('p1', 'p2'),
      {
        participants: [
          { playerId: 'p3', team: 1 },
          { playerId: 'p2', team: 2 },
        ],
        manuallyAdjusted: true,
      },
    ])
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
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue(
      ['p1', 'p2', 'p3', 'p4', 'p5'].map((id) => makeParticipant(id)),
    )
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      makePlayer('p1', 'Ann', 'male'),
      makePlayer('p2', 'Ben', 'male'),
      makePlayer('p3', 'Cid', 'female'),
      makePlayer('p4', 'Dee', 'female'),
      makePlayer('p5', 'Eve', 'male'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    seedQueue([
      {
        participants: [
          { playerId: 'p1', team: 1 },
          { playerId: 'p2', team: 1 },
          { playerId: 'p3', team: 2 },
          { playerId: 'p4', team: 2 },
        ],
        manuallyAdjusted: false,
      },
    ])

    const warningText =
      "This lineup isn't gender-mixed, though a mixed pairing was possible."

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findAllByText('Ann & Ben vs Cid & Dee')
    expect(screen.queryByText(warningText)).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Edit 1. Ann & Ben vs Cid & Dee' }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Team 1 player 2' }),
      'p5',
    )

    expect(await screen.findByText(warningText)).toBeInTheDocument()
  })

  it('opens the Edit queue popup on Edit and closes it via Done editing', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    seedQueue([singles('p1', 'p2')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'Edit 1. Alice vs Bob' }),
    )
    expect(
      await screen.findByText('Edit queue match 1 of 1'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Done editing' }))
    await waitFor(() => {
      expect(screen.queryByText('Edit queue match 1 of 1')).toBeNull()
    })
  })

  it('lists every participant’s games played, fewest first, with +1 for each in-progress match on ANY court', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue(
      ['p1', 'p2', 'p3', 'p4', 'p5'].map((id) => makeParticipant(id)),
    )
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      ...fourPlayers,
      makePlayer('p5', 'Erin', 'female'),
    ])
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: [
        // The draw input count may include the late-joiner fairness offset
        // (here p1 reports 4); the table must show real matches only.
        ...fourCandidates.map((c) =>
          c.id === 'p1' ? { ...c, matchesPlayedInTournament: 4 } : c,
        ),
        {
          id: 'p5',
          gender: 'female',
          skillValue: 50,
          matchesPlayedInTournament: 0,
        },
      ],
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'queued', 1),
      makeMatch('m2', 2, 'queued', 2),
      makeMatch('m0', 3, 'completed'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
      { match_id: 'm2', player_id: 'p3', team: 1 },
      { match_id: 'm2', player_id: 'p4', team: 2 },
      { match_id: 'm0', player_id: 'p1', team: 1 },
      { match_id: 'm0', player_id: 'p3', team: 2 },
    ])
    seedQueue([singles('p5', 'p2')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'Edit 1. Erin vs Bob' }),
    )
    await screen.findByText('Edit queue match 1 of 1')

    const table = screen.getByRole('table')
    const rowTexts = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      )
    // Erin & Bob are in the entry being edited, so it is not listed as their
    // queue position.
    expect(rowTexts).toEqual([
      ['Erin', '0', '—'],
      ['Bob', '1', 'Court 1'],
      ['Dave', '1', 'Court 2'],
      ['Alice', '2', 'Court 1'],
      ['Carol', '2', 'Court 2'],
    ])
  })
})

describe('TournamentDetail: Queue persistence (localStorage)', () => {
  it('keeps the drawn-but-not-started queue after the component remounts', async () => {
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
    const first = renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(await screen.findByRole('button', { name: 'Randomize' }))
    await screen.findByRole('heading', { name: 'Queue (1/2)' })
    expect(localStorage.getItem('racket-score.matchQueue.t1')).not.toBeNull()

    first.unmount()

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(
      await screen.findByRole('heading', { name: 'Queue (1/2)' }),
    ).toBeInTheDocument()
    expect(within(queueCard()).getByText('Alice vs Bob')).toBeInTheDocument()
  })

  it('removes the started match from the stored queue once Start succeeds', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(matchesApi.createMatch).mockResolvedValue(
      makeMatch('m-new', 1, 'queued', 1),
    )
    seedQueue([singles('p1', 'p2')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'Start ▶ Alice vs Bob' }),
    )

    await waitFor(() => {
      expect(matchesApi.createMatch).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(localStorage.getItem('racket-score.matchQueue.t1')).toBeNull()
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

    // The queue is empty in this scenario, so Save result stays locked until
    // "Is last match" is checked (see the dedicated lock tests below).
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

  it('locks Save result while the queue is empty (with a hint), and unlocks it once a match is drawn into the queue', async () => {
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

    const hint =
      'Draw at least one match into the queue before saving this result (or tick “Is last match”)'
    expect(screen.getByRole('button', { name: 'Save result' })).toBeDisabled()
    expect(screen.getByText(hint)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Randomize' }))
    await screen.findByRole('heading', { name: 'Queue (1/2)' })

    expect(screen.getByRole('button', { name: 'Save result' })).toBeEnabled()
    expect(screen.queryByText(hint)).not.toBeInTheDocument()
  })

  it('enables Save result straight away when the queue already holds a match', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'queued', 1),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
    ])
    seedQueue([singles('p3', 'p4')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.type(
      await screen.findByRole('spinbutton', { name: 'Alice -- Game 1' }),
      '21',
    )
    await user.type(
      screen.getByRole('spinbutton', { name: 'Bob -- Game 1' }),
      '15',
    )

    expect(screen.getByRole('button', { name: 'Save result' })).toBeEnabled()
  })

  it('"Is last match" unlocks Save result on THAT court only', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'queued', 1),
      makeMatch('m2', 2, 'queued', 2),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
      { match_id: 'm2', player_id: 'p3', team: 1 },
      { match_id: 'm2', player_id: 'p4', team: 2 },
    ])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const court1 = (
      await screen.findByRole('heading', { name: 'Court 1 · Match 1' })
    ).closest('li')!
    const court2 = screen
      .getByRole('heading', { name: 'Court 2 · Match 2' })
      .closest('li')!

    for (const [card, a, b] of [
      [court1, 'Alice', 'Bob'],
      [court2, 'Carol', 'Dave'],
    ] as const) {
      await user.type(
        within(card).getByRole('spinbutton', { name: `${a} -- Game 1` }),
        '21',
      )
      await user.type(
        within(card).getByRole('spinbutton', { name: `${b} -- Game 1` }),
        '15',
      )
    }

    await user.click(
      within(court1).getByRole('checkbox', { name: 'This is the last match' }),
    )

    expect(
      within(court1).getByRole('button', { name: 'Save result' }),
    ).toBeEnabled()
    expect(
      within(court2).getByRole('button', { name: 'Save result' }),
    ).toBeDisabled()
  })

  it('unchecking "Is last match" re-locks Save result while the queue is empty', async () => {
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
    expect(
      screen.getByText(
        "This can't be undone. Any drawn-but-unplayed matches will be discarded.",
      ),
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
  it('shows an enabled Leave button for an active participant not in an in-progress match', async () => {
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

  it('disables the Leave button for participants in an in-progress match on ANY court', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      ...fourPlayers,
      makePlayer('p5', 'Erin', 'female'),
    ])
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue(
      ['p1', 'p2', 'p3', 'p4', 'p5'].map((id) => makeParticipant(id)),
    )
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'queued', 1),
      makeMatch('m2', 2, 'queued', 2),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
      { match_id: 'm2', player_id: 'p3', team: 1 },
      { match_id: 'm2', player_id: 'p4', team: 2 },
    ])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByRole('heading', { name: 'Court 2 · Match 2' })
    const leaveButtons = await screen.findAllByRole('button', { name: 'Leave' })
    expect(leaveButtons).toHaveLength(5)
    expect(leaveButtons[0]).toBeDisabled() // Alice -- Court 1
    expect(leaveButtons[1]).toBeDisabled() // Bob -- Court 1
    expect(leaveButtons[2]).toBeDisabled() // Carol -- Court 2
    expect(leaveButtons[3]).toBeDisabled() // Dave -- Court 2
    expect(leaveButtons[4]).toBeEnabled() // Erin -- not playing
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
    const participantsCard = (
      await screen.findByRole('heading', { name: 'Participants' })
    ).closest('section')!
    const list = within(participantsCard).getByRole('list')
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

  it('removes every queued match containing the left participant, keeping the others', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue(
      ['p1', 'p2', 'p3', 'p4'].map((id) => makeParticipant(id)),
    )
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(tournamentsApi.leaveParticipant).mockResolvedValue(
      makeParticipant('p2', 'left'),
    )
    seedQueue([singles('p1', 'p2'), singles('p3', 'p4'), singles('p2', 'p3')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByRole('heading', { name: 'Queue (3/3)' })
    const leaveButtons = screen.getAllByRole('button', { name: 'Leave' })
    await user.click(leaveButtons[1]) // Bob, in queued matches 1 and 3
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))

    expect(
      await screen.findByRole('heading', { name: 'Queue (1/3)' }),
    ).toBeInTheDocument()
    expect(getQueue('t1')).toEqual([singles('p3', 'p4')])
  })

  it('leaves the queue untouched when the left participant is not in it', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
      makeParticipant('p2'),
      makeParticipant('p3'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(tournamentsApi.leaveParticipant).mockResolvedValue(
      makeParticipant('p3', 'left'),
    )
    seedQueue([singles('p1', 'p2')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByRole('heading', { name: 'Queue (1/2)' })
    const leaveButtons = screen.getAllByRole('button', { name: 'Leave' })
    await user.click(leaveButtons[2]) // Carol, not queued
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))

    await waitFor(() => {
      expect(tournamentsApi.leaveParticipant).toHaveBeenCalledWith(
        't1',
        'p3',
        'test-passphrase',
      )
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(getQueue('t1')).toEqual([singles('p1', 'p2')])
    expect(
      screen.getByRole('heading', { name: 'Queue (1/2)' }),
    ).toBeInTheDocument()
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
        "Everyone in this sport's member pool is already active in this tournament.",
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

  it("omits a non-member of the tournament's sport from the picker, using the tournament's own sport regardless of the active workspace", async () => {
    // Carol is a tennis-only member -- not a badminton member -- and
    // `activeTournament.sport` is 'badminton'. `ParticipantsCard` reads
    // `tournament.sport` directly (it never calls `useSport()`), so this
    // also demonstrates that a Badminton tournament's picker stays scoped
    // to Badminton members regardless of whatever sport workspace is
    // active elsewhere in the app.
    const tennisOnlyPlayer: Player = {
      id: 'p3',
      name: 'Carol',
      gender: 'female',
      badminton_self_selected_level: null,
      tennis_self_selected_level: 'beginner',
      created_at: '',
    }
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      ...players,
      tennisOnlyPlayer,
    ])
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1', 'left'),
      makeParticipant('p2', 'left'),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const select = await screen.findByRole('combobox')
    expect(
      within(select).queryByRole('option', { name: 'Carol' }),
    ).toBeNull()
    expect(
      within(select).getByRole('option', { name: 'Bob' }),
    ).not.toBeDisabled()
  })
})

describe('TournamentDetail: Rounds played -- delete last match', () => {
  function setUpTwoCompletedMatches() {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'completed'),
      makeMatch('m2', 2, 'completed'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
      { match_id: 'm2', player_id: 'p1', team: 1 },
      { match_id: 'm2', player_id: 'p2', team: 2 },
    ])
    vi.mocked(matchesApi.listGamesForMatches).mockResolvedValue([
      { match_id: 'm1', game_number: 1, team1_score: 21, team2_score: 15 },
      { match_id: 'm2', game_number: 1, team1_score: 21, team2_score: 18 },
    ])
  }

  it('shows the "Delete last match" button only on the newest (first) row', async () => {
    setUpTwoCompletedMatches()

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    // Matches are sorted newest-first, so "Match 2" (m2) is the first row.
    await screen.findByText('Match 2')
    expect(screen.getByText('Match 1')).toBeInTheDocument()

    expect(
      screen.getAllByRole('button', { name: 'Delete last match' }),
    ).toHaveLength(1)
  })

  it('confirming the delete calls deleteMatchResult with the newest match id', async () => {
    setUpTwoCompletedMatches()
    vi.mocked(matchesApi.deleteMatchResult).mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByText('Match 2')
    await user.click(screen.getByRole('button', { name: 'Delete last match' }))

    expect(
      await screen.findByRole('heading', {
        name: 'Delete this match result?',
      }),
    ).toBeInTheDocument()

    const passphraseInput = await screen.findByLabelText('Passphrase')
    await user.type(passphraseInput, 'the-real-secret')
    await user.click(screen.getByRole('button', { name: 'Delete match' }))

    await waitFor(() => {
      expect(matchesApi.deleteMatchResult).toHaveBeenCalledWith(
        'm2',
        'the-real-secret',
      )
    })

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Delete this match result?' }),
      ).not.toBeInTheDocument()
    })
  })
})

describe('TournamentDetail: Queue Edit popup -- title and Now column', () => {
  function setUpNowScenario() {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      ...fourPlayers,
      makePlayer('p5', 'Erin', 'female'),
      makePlayer('p6', 'Frank', 'male'),
      makePlayer('p7', 'Gina', 'female'),
    ])
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue(
      ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map((id) =>
        makeParticipant(id),
      ),
    )
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map((id) => ({
        id,
        gender: 'female' as const,
        skillValue: 50,
        matchesPlayedInTournament: id === 'p7' ? 2 : 0,
      })),
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })
    // Gina and Frank have one real completed match together (Gina's draw-input
    // count of 2 above is a fairness offset and must not be shown).
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'queued', 1),
      makeMatch('m0', 2, 'completed'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
      { match_id: 'm0', player_id: 'p7', team: 1 },
      { match_id: 'm0', player_id: 'p6', team: 2 },
    ])
    seedQueue([singles('p3', 'p1'), singles('p4', 'p5'), singles('p3', 'p6')])
  }

  function nowByName(): Record<string, string[]> {
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    return Object.fromEntries(
      rows.map((row) => {
        const cells = within(row)
          .getAllByRole('cell')
          .map((c) => c.textContent ?? '')
        return [cells[0], [cells[1], cells[2]]]
      }),
    )
  }

  it('titles the popup with the entry position and the queue length', async () => {
    setUpNowScenario()

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'Edit 2. Dave vs Erin' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Edit queue match 2 of 3' }),
    ).toBeInTheDocument()
  })

  it('has a Now column: court, other queue positions, both (court first), or a dash', async () => {
    setUpNowScenario()

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'Edit 2. Dave vs Erin' }),
    )
    await screen.findByRole('heading', { name: 'Edit queue match 2 of 3' })

    expect(
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Player', 'Games played', 'Now'])

    expect(nowByName()).toEqual({
      // on Court 1 AND in queue match 1
      Alice: ['1', 'Court 1, Queue #1'],
      // on Court 1 only
      Bob: ['1', 'Court 1'],
      // in queue matches 1 and 3
      Carol: ['0', 'Queue #1, Queue #3'],
      // Dave & Erin are only in the entry being edited: not its own "Queue #"
      Dave: ['0', '—'],
      Erin: ['0', '—'],
      Frank: ['1', 'Queue #3'],
      Gina: ['1', '—'],
    })
  })

  it('updates the Now column when a slot is swapped in the open popup', async () => {
    setUpNowScenario()

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'Edit 2. Dave vs Erin' }),
    )
    await screen.findByRole('heading', { name: 'Edit queue match 2 of 3' })
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Team 1 player 1' }),
      'p7',
    )

    // Gina joined the entry being edited, so it is not listed as her queue slot.
    expect(nowByName().Gina).toEqual(['1', '—'])
    expect(nowByName().Dave).toEqual(['0', '—'])
  })
})

describe('TournamentDetail: Matches played', () => {
  it('shows the Matches played heading and the empty state', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(
      await screen.findByRole('heading', { name: 'Matches played' }),
    ).toBeInTheDocument()
    expect(screen.getByText('No matches played yet')).toBeInTheDocument()
  })

  function setUpTwoCourtResults() {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    // m2 (higher sequence number, court 2) was confirmed FIRST; m1 (court 1)
    // was confirmed later, so m1 is the most recent result.
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      {
        ...makeMatch('m1', 1, 'completed', 1),
        completed_at: '2026-01-01T10:30:00Z',
      },
      {
        ...makeMatch('m2', 2, 'completed', 2),
        completed_at: '2026-01-01T10:10:00Z',
      },
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
      { match_id: 'm2', player_id: 'p1', team: 1 },
      { match_id: 'm2', player_id: 'p2', team: 2 },
    ])
    vi.mocked(matchesApi.listGamesForMatches).mockResolvedValue([
      { match_id: 'm1', game_number: 1, team1_score: 21, team2_score: 15 },
      { match_id: 'm2', game_number: 1, team1_score: 21, team2_score: 18 },
    ])
  }

  it('orders rows by confirmation time and labels them with the court on a multi-court tournament', async () => {
    setUpTwoCourtResults()

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const first = (await screen.findByText('Match 1 · Court 1')).closest('li')!
    const second = screen.getByText('Match 2 · Court 2').closest('li')!
    expect(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('puts "Delete last match" on the most recently CONFIRMED row, not the highest sequence number', async () => {
    setUpTwoCourtResults()

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const first = (await screen.findByText('Match 1 · Court 1')).closest('li')!
    const second = screen.getByText('Match 2 · Court 2').closest('li')!
    expect(
      within(first).getByRole('button', { name: 'Delete last match' }),
    ).toBeInTheDocument()
    expect(
      within(second).queryByRole('button', { name: 'Delete last match' }),
    ).toBeNull()
  })

  it('breaks completed_at ties by the higher sequence number first', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'completed', 1),
      makeMatch('m2', 2, 'completed', 2),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const first = (await screen.findByText('Match 2 · Court 2')).closest('li')!
    expect(
      within(first).getByRole('button', { name: 'Delete last match' }),
    ).toBeInTheDocument()
  })
})

describe('TournamentDetail: Queue reuse warning is derived', () => {
  const overlapWarning = 'Alice already in another queued or in-progress match'

  function setUpOverlap() {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue(
      ['p1', 'p2', 'p3', 'p4'].map((id) => makeParticipant(id)),
    )
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    // Entry 2 reuses Alice (also in entry 1) -- present on the FIRST render.
    seedQueue([singles('p1', 'p2'), singles('p1', 'p3')])
  }

  it('shows on the first render of a pre-filled queue with overlap', async () => {
    setUpOverlap()

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(await screen.findByText(overlapWarning)).toBeInTheDocument()
  })

  it('is not shown when nothing overlaps', async () => {
    setUpOverlap()
    seedQueue([singles('p1', 'p2'), singles('p3', 'p4')])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByRole('heading', { name: 'Queue (2/3)' })
    expect(screen.queryByText(/already in another queued/)).toBeNull()
  })

  it('disappears once the offending entry is removed', async () => {
    setUpOverlap()

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByText(overlapWarning)
    await user.click(
      within(queueCard()).getByRole('button', {
        name: 'Remove 2. Alice vs Carol',
      }),
    )

    await waitFor(() => {
      expect(screen.queryByText(overlapWarning)).toBeNull()
    })
  })

  it('disappears once an edit swaps the reused player out', async () => {
    setUpOverlap()

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByText(overlapWarning)
    await user.click(
      within(queueCard()).getByRole('button', {
        name: 'Edit 2. Alice vs Carol',
      }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Team 1 player 1' }),
      'p4',
    )

    await waitFor(() => {
      expect(screen.queryByText(overlapWarning)).toBeNull()
    })
  })

  it('stays correct after Start: the queued overlap becomes an in-progress overlap', async () => {
    setUpOverlap()
    stubStatefulMatches()

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await screen.findByText(overlapWarning)
    const court1Strip = screen.getByText('Court 1 · free').closest('li')!
    await user.click(
      within(court1Strip).getByRole('button', { name: /^Start/ }),
    )

    await screen.findByRole('heading', { name: 'Court 1 · Match 1' })
    // Alice is now on court 1 and in the remaining queued entry: still reused.
    expect(screen.getAllByText(/already in another queued/)).toHaveLength(1)
    expect(screen.getByText(overlapWarning)).toBeInTheDocument()
  })
})

describe('TournamentDetail: Start failure and pending state', () => {
  it('shows the start-failed message on THAT court only and leaves the queue untouched', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(matchesApi.createMatch).mockRejectedValue(new Error('boom'))
    seedQueue([singles('p1', 'p2')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const court2Strip = (await screen.findByText('Court 2 · free')).closest(
      'li',
    )!
    await user.click(
      within(court2Strip).getByRole('button', { name: /^Start/ }),
    )

    const message = "Couldn't start the match. Please try again."
    expect(await within(court2Strip).findByText(message)).toBeInTheDocument()
    const court1Strip = screen.getByText('Court 1 · free').closest('li')!
    expect(within(court1Strip).queryByText(message)).toBeNull()
    expect(screen.queryByText('Failed to draw a match.')).toBeNull()
    expect(getQueue('t1')).toEqual([singles('p1', 'p2')])
  })

  it('explains a court_occupied failure and refetches so the screen is no longer stale', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(matchesApi.createMatch).mockRejectedValue(
      new Error('court_occupied'),
    )
    seedQueue([singles('p1', 'p2')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const court1Strip = (await screen.findByText('Court 1 · free')).closest(
      'li',
    )!
    const listCallsBefore = vi.mocked(matchesApi.listMatches).mock.calls.length
    await user.click(
      within(court1Strip).getByRole('button', { name: /^Start/ }),
    )

    expect(
      await within(court1Strip).findByText(
        'That court was just taken -- the screen has been refreshed.',
      ),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        vi.mocked(matchesApi.listMatches).mock.calls.length,
      ).toBeGreaterThan(listCallsBefore)
    })
    expect(getQueue('t1')).toEqual([singles('p1', 'p2')])
  })

  it('says nothing when the user dismissed the passphrase prompt', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(matchesApi.createMatch).mockRejectedValue(
      new Error('passphrase_cancelled'),
    )
    seedQueue([singles('p1', 'p2')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const strip = (await screen.findByText('Court 1 · free')).closest('li')!
    await user.click(within(strip).getByRole('button', { name: /^Start/ }))

    await waitFor(() => {
      expect(matchesApi.createMatch).toHaveBeenCalled()
    })
    expect(within(strip).queryByText(/start the match/i)).toBeNull()
    expect(within(strip).queryByText(/just taken/i)).toBeNull()
  })

  it('disables Start on the other free court while a Start is pending', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(matchesApi.createMatch).mockReturnValue(new Promise(() => {}))
    seedQueue([singles('p1', 'p2')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const court1Strip = (await screen.findByText('Court 1 · free')).closest(
      'li',
    )!
    const court2Strip = screen.getByText('Court 2 · free').closest('li')!
    await user.click(
      within(court1Strip).getByRole('button', { name: /^Start/ }),
    )

    await waitFor(() => {
      expect(
        within(court2Strip).getByRole('button', { name: /^Start/ }),
      ).toBeDisabled()
    })
    expect(
      within(court1Strip).getByRole('button', { name: /^Start/ }),
    ).toBeDisabled()
  })
})

describe('TournamentDetail: queue vs. roster and Start/Cancel bookkeeping', () => {
  it('drops queued matches containing a participant who already left (e.g. on another device)', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
      makeParticipant('p2', 'left'),
      makeParticipant('p3'),
      makeParticipant('p4'),
    ])
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    seedQueue([singles('p1', 'p2'), singles('p3', 'p4')])

    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(
      await screen.findByRole('heading', { name: 'Queue (1/2)' }),
    ).toBeInTheDocument()
    expect(within(queueCard()).getByText('Carol vs Dave')).toBeInTheDocument()
    expect(within(queueCard()).queryByText('Alice vs Bob')).toBeNull()
    expect(getQueue('t1')).toEqual([singles('p3', 'p4')])
  })

  it('does not offer a participant who left in the queue Edit pickers', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
      makeParticipant('p2'),
      makeParticipant('p3', 'left'),
    ])
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    seedQueue([singles('p1', 'p2')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'Edit 1. Alice vs Bob' }),
    )
    const picker = screen.getByRole('combobox', { name: 'Team 1 player 1' })
    expect(within(picker).queryByRole('option', { name: 'Carol' })).toBeNull()
  })

  it('Start removes the entry that was started even if the queue head changed while it was in flight', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([
      makeParticipant('p1'),
      makeParticipant('p2'),
      makeParticipant('p3'),
      makeParticipant('p4'),
    ])
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    let release: () => void = () => {}
    vi.mocked(matchesApi.createMatch).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(makeMatch('m-new', 1, 'queued', 1))
        }),
    )
    seedQueue([singles('p1', 'p2'), singles('p3', 'p4')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'Start ▶ Alice vs Bob' }),
    )
    await waitFor(() => expect(matchesApi.createMatch).toHaveBeenCalled())

    // Meanwhile the started head is removed (e.g. from another tab).
    setQueue('t1', [singles('p3', 'p4')])
    const listCallsBefore = vi.mocked(matchesApi.listMatches).mock.calls.length
    release()

    // The success handler (queue update, then invalidation) has run once the
    // matches query is refetched.
    await waitFor(() => {
      expect(
        vi.mocked(matchesApi.listMatches).mock.calls.length,
      ).toBeGreaterThan(listCallsBefore)
    })
    expect(getQueue('t1')).toEqual([singles('p3', 'p4')])
  })

  it('closes the Edit popup when its entry disappears and does not re-open it when the queue grows again', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue(
      ['p1', 'p2', 'p3', 'p4'].map((id) => makeParticipant(id)),
    )
    vi.mocked(playersApi.listPlayers).mockResolvedValue(fourPlayers)
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    seedQueue([singles('p1', 'p2'), singles('p3', 'p4')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'Edit 2. Carol vs Dave' }),
    )
    await screen.findByText('Edit queue match 2 of 2')

    // e.g. another tab of this browser removes the entry being edited.
    act(() => setQueue('t1', [singles('p1', 'p2')]))
    await waitFor(() => {
      expect(screen.queryByText(/^Edit queue match/)).toBeNull()
    })

    act(() => setQueue('t1', [singles('p1', 'p2'), singles('p3', 'p4')]))
    await screen.findByRole('button', { name: 'Edit 2. Carol vs Dave' })
    expect(screen.queryByText(/^Edit queue match/)).toBeNull()
  })

  it('warns in the End dialog which courts still have a match in progress (it will not be recorded)', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'completed', 1),
      makeMatch('m2', 2, 'queued', 2),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
      { match_id: 'm2', player_id: 'p1', team: 1 },
      { match_id: 'm2', player_id: 'p2', team: 2 },
    ])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'End tournament' }),
    )
    expect(
      await screen.findByText(
        "Still in progress on Court 2 -- that match won't be recorded.",
      ),
    ).toBeInTheDocument()
  })

  it('shows no in-progress warning in the End dialog when every court is free', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      twoCourtTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'completed', 1),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'End tournament' }),
    )
    await screen.findByText('End this tournament?')
    expect(screen.queryByText(/Still in progress on/)).toBeNull()
  })

  it('clears the stored queue when the tournament is cancelled', async () => {
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
    seedQueue([singles('p1', 'p2')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'Cancel tournament' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Yes, cancel tournament' }),
    )

    await waitFor(() => {
      expect(tournamentsApi.cancelTournament).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(localStorage.getItem('racket-score.matchQueue.t1')).toBeNull()
    })
  })

  it('clears the stored queue when the tournament is ended', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    setupCommonMocks()
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      makeMatch('m1', 1, 'completed'),
    ])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm1', player_id: 'p1', team: 1 },
      { match_id: 'm1', player_id: 'p2', team: 2 },
    ])
    vi.mocked(tournamentsApi.endTournament).mockResolvedValue({
      ...activeTournament,
      status: 'completed',
    })
    seedQueue([singles('p1', 'p2')])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    await user.click(
      await screen.findByRole('button', { name: 'End tournament' }),
    )
    await user.click(await screen.findByRole('button', { name: /^Yes, end/ }))

    await waitFor(() => {
      expect(tournamentsApi.endTournament).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(localStorage.getItem('racket-score.matchQueue.t1')).toBeNull()
    })
  })
})
