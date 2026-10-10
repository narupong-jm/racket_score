import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CreateTournamentPage } from './CreateTournamentPage'
import * as playersApi from '../features/players/playersApi'
import * as tournamentsApi from '../features/tournaments/tournamentsApi'
import * as useDrawInputsModule from '../features/matches/useDrawInputs'
import * as matchesApi from '../features/matches/matchesApi'
import * as generateNextMatchModule from '../features/matchmaking/generateNextMatch'
import * as useSportModule from '../features/sport/useSport'
import type { Player, PlayerStats } from '../features/players/playersApi'
import type { Tournament } from '../features/tournaments/tournamentsApi'
import { clearQueue, getQueue } from '../lib/matchQueueStore'

vi.mock('../features/players/playersApi', () => ({
  listPlayers: vi.fn(),
  listPlayerStats: vi.fn(),
}))

vi.mock('../features/tournaments/tournamentsApi', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../features/tournaments/tournamentsApi')
    >()
  return {
    ...actual,
    createTournament: vi.fn(),
    addParticipant: vi.fn(),
  }
})

vi.mock('../features/matches/useDrawInputs', () => ({
  assembleDrawInputs: vi.fn(),
}))

vi.mock('../features/matches/matchesApi', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../features/matches/matchesApi')>()
  return {
    ...actual,
    createMatch: vi.fn(),
    listMatches: vi.fn(),
  }
})

vi.mock('../features/matchmaking/generateNextMatch', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../features/matchmaking/generateNextMatch')
    >()
  return {
    ...actual,
    generateNextMatch: vi.fn(),
  }
})

vi.mock('../features/passphrase/usePassphraseGate', () => ({
  usePassphraseGate: () => ({
    getPassphrase: vi.fn().mockResolvedValue('test-passphrase'),
  }),
}))

vi.mock('../features/sport/useSport', () => ({
  useSport: vi.fn(),
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/create']}>
        <Routes>
          <Route path="/create" element={<CreateTournamentPage />} />
          <Route
            path="/tournaments/:id"
            element={<p>Manage tournament t1</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function makePlayer(
  id: string,
  name: string,
  sport: 'badminton' | 'tennis' = 'badminton',
): Player {
  return {
    id,
    name,
    gender: 'male',
    badminton_self_selected_level: sport === 'badminton' ? 'beginner' : null,
    tennis_self_selected_level: sport === 'tennis' ? 'beginner' : null,
    created_at: '',
  }
}

function makeStats(
  playerId: string,
  sport: 'badminton' | 'tennis' = 'badminton',
): PlayerStats {
  return {
    player_id: playerId,
    name: playerId,
    gender: 'male',
    sport,
    self_selected_level: 'beginner',
    total_matches: 0,
    total_wins: 0,
    win_rate: null,
    effective_level: 'beginner',
  }
}

const players: Player[] = [
  makePlayer('p1', 'Alice'),
  makePlayer('p2', 'Bob'),
  makePlayer('p3', 'Carol'),
  makePlayer('p4', 'Dave'),
]

const tennisPlayers: Player[] = [
  makePlayer('p1', 'Alice', 'tennis'),
  makePlayer('p2', 'Bob', 'tennis'),
  makePlayer('p3', 'Carol', 'tennis'),
  makePlayer('p4', 'Dave', 'tennis'),
]

const tournament: Tournament = {
  id: 't1',
  name: 'Sunday Smash',
  type: 'doubles',
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

beforeEach(() => {
  clearQueue('t1')
  vi.mocked(useSportModule.useSport).mockReturnValue({
    sport: 'badminton',
    setSport: vi.fn(),
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('CreateTournamentPage', () => {
  it('blocks submit and shows an inline error with 2 selected for Doubles (needs 4)', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(
      players.map((p) => makeStats(p.id)),
    )

    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('radio', { name: 'Doubles' }))
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }))
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }))

    expect(
      screen.getByText('Select at least 4 players (2 selected).'),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText(/name/i), 'Sunday Smash')
    expect(
      screen.getByRole('button', { name: /create tournament/i }),
    ).toBeDisabled()
    expect(tournamentsApi.createTournament).not.toHaveBeenCalled()
  })

  it('succeeds with 4 selected for Doubles: shows the popup with the correct matchup, defers persistence until Confirm, and navigates after', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(
      players.map((p) => makeStats(p.id)),
    )
    vi.mocked(tournamentsApi.createTournament).mockResolvedValue(tournament)
    vi.mocked(tournamentsApi.addParticipant).mockResolvedValue({
      tournament_id: 't1',
      player_id: 'p1',
      joined_at: '2026-01-01T00:00:00Z',
      status: 'active',
      match_count_offset: 0,
    })
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: [],
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 1 },
        { playerId: 'p3', team: 2 },
        { playerId: 'p4', team: 2 },
      ],
    })
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])

    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText(/name/i), 'Sunday Smash')
    await user.click(screen.getByRole('radio', { name: 'Doubles' }))
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }))
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }))
    await user.click(screen.getByRole('checkbox', { name: 'Carol' }))
    await user.click(screen.getByRole('checkbox', { name: 'Dave' }))
    await user.type(screen.getByLabelText('Games per match'), '3')
    await user.type(screen.getByLabelText('Points per game'), '21')

    const submitButton = screen.getByRole('button', {
      name: /create tournament/i,
    })
    expect(submitButton).toBeEnabled()
    await user.click(submitButton)

    await waitFor(() => {
      expect(tournamentsApi.createTournament).toHaveBeenCalledWith(
        {
          name: 'Sunday Smash',
          type: 'doubles',
          games_per_match: 3,
          points_per_game: 21,
          sport: 'badminton',
          court_count: 1,
        },
        'test-passphrase',
      )
    })

    expect(
      await screen.findByRole('heading', { name: 'First match drawn' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('dialog')).getByRole('listitem'),
    ).toHaveTextContent('1.Alice & Bob vs Carol & Dave')
    // Nothing is persisted or queued yet -- the popup shows a computed draft.
    expect(matchesApi.createMatch).not.toHaveBeenCalled()
    expect(getQueue('t1')).toEqual([])

    await user.click(
      screen.getByRole('button', { name: 'Go to Manage Tournament' }),
    )

    expect(await screen.findByText('Manage tournament t1')).toBeInTheDocument()
    expect(getQueue('t1')).toEqual([
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
    // Matches start from the Manage screen, never at creation.
    expect(matchesApi.createMatch).not.toHaveBeenCalled()
  })

  it('allows editing the first-match popup before confirming, marking it manually adjusted', async () => {
    const playersWithBench = [...players, makePlayer('p5', 'Eve')]
    vi.mocked(playersApi.listPlayers).mockResolvedValue(playersWithBench)
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(
      playersWithBench.map((p) => makeStats(p.id)),
    )
    vi.mocked(tournamentsApi.createTournament).mockResolvedValue(tournament)
    vi.mocked(tournamentsApi.addParticipant).mockResolvedValue({
      tournament_id: 't1',
      player_id: 'p1',
      joined_at: '2026-01-01T00:00:00Z',
      status: 'active',
      match_count_offset: 0,
    })
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: [],
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 1 },
        { playerId: 'p3', team: 2 },
        { playerId: 'p4', team: 2 },
      ],
    })
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])

    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText(/name/i), 'Sunday Smash')
    await user.click(screen.getByRole('radio', { name: 'Doubles' }))
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }))
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }))
    await user.click(screen.getByRole('checkbox', { name: 'Carol' }))
    await user.click(screen.getByRole('checkbox', { name: 'Dave' }))
    await user.click(screen.getByRole('checkbox', { name: 'Eve' })) // bench player, not drawn
    await user.type(screen.getByLabelText('Games per match'), '3')
    await user.type(screen.getByLabelText('Points per game'), '21')
    await user.click(screen.getByRole('button', { name: /create tournament/i }))

    await screen.findByRole('heading', { name: 'First match drawn' })

    await user.click(screen.getByRole('button', { name: /^Edit/ }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Team 1 player 1' }),
      'p5',
    )
    await user.click(
      screen.getByRole('button', { name: 'Go to Manage Tournament' }),
    )

    expect(await screen.findByText('Manage tournament t1')).toBeInTheDocument()
    expect(getQueue('t1')).toEqual([
      {
        participants: [
          { playerId: 'p5', team: 1 },
          { playerId: 'p2', team: 1 },
          { playerId: 'p3', team: 2 },
          { playerId: 'p4', team: 2 },
        ],
        manuallyAdjusted: true,
      },
    ])
    expect(matchesApi.createMatch).not.toHaveBeenCalled()
  })

  it('courts stepper defaults to 1 and clamps to 1..8', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(
      players.map((p) => makeStats(p.id)),
    )
    const user = userEvent.setup()
    renderPage()

    const courts = await screen.findByLabelText('Number of courts')
    expect(courts).toHaveValue(1)

    const decrease = screen.getAllByRole('button', { name: 'decrease' })[2]
    const increase = screen.getAllByRole('button', { name: 'increase' })[2]
    expect(decrease).toBeDisabled()

    await user.clear(courts)
    await user.type(courts, '12')
    expect(courts).toHaveValue(8)
    expect(increase).toBeDisabled()
  })

  it('draws one match per court: popup shows n rows, confirm queues them all and navigates', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(
      players.map((p) => makeStats(p.id)),
    )
    vi.mocked(tournamentsApi.createTournament).mockResolvedValue({
      ...tournament,
      type: 'singles',
      court_count: 2,
    })
    vi.mocked(tournamentsApi.addParticipant).mockResolvedValue({
      tournament_id: 't1',
      player_id: 'p1',
      joined_at: '2026-01-01T00:00:00Z',
      status: 'active',
      match_count_offset: 0,
    })
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: [],
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })
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

    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText(/name/i), 'Two Courts')
    for (const name of ['Alice', 'Bob', 'Carol', 'Dave']) {
      await user.click(screen.getByRole('checkbox', { name }))
    }
    await user.type(screen.getByLabelText('Games per match'), '3')
    await user.type(screen.getByLabelText('Points per game'), '21')
    await user.click(screen.getAllByRole('button', { name: 'increase' })[2])
    expect(screen.getByLabelText('Number of courts')).toHaveValue(2)
    await user.click(screen.getByRole('button', { name: /create tournament/i }))

    await waitFor(() => {
      expect(tournamentsApi.createTournament).toHaveBeenCalledWith(
        expect.objectContaining({ court_count: 2 }),
        'test-passphrase',
      )
    })

    expect(
      await screen.findByRole('heading', { name: 'First 2 matches drawn' }),
    ).toBeInTheDocument()
    const rows = within(screen.getByRole('dialog')).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('1.Alice vs Bob')
    expect(rows[1]).toHaveTextContent('2.Carol vs Dave')

    await user.click(
      screen.getByRole('button', { name: 'Go to Manage Tournament' }),
    )

    expect(await screen.findByText('Manage tournament t1')).toBeInTheDocument()
    expect(getQueue('t1')).toHaveLength(2)
    expect(matchesApi.createMatch).not.toHaveBeenCalled()
  })

  it('does not accept a fractional court count (submit stays disabled)', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(
      players.map((p) => makeStats(p.id)),
    )
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText(/name/i), 'Fractions')
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }))
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }))
    await user.type(screen.getByLabelText('Games per match'), '3')
    await user.type(screen.getByLabelText('Points per game'), '21')
    const submit = screen.getByRole('button', { name: /create tournament/i })
    expect(submit).toBeEnabled()

    const courts = screen.getByLabelText('Number of courts')
    await user.clear(courts)
    await user.type(courts, '2.5')
    expect(submit).toBeDisabled()
  })

  it('closing the first-matches popup without confirming still keeps the drawn matches in the queue', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(
      players.map((p) => makeStats(p.id)),
    )
    vi.mocked(tournamentsApi.createTournament).mockResolvedValue({
      ...tournament,
      type: 'singles',
      court_count: 2,
    })
    vi.mocked(tournamentsApi.addParticipant).mockResolvedValue({
      tournament_id: 't1',
      player_id: 'p1',
      joined_at: '2026-01-01T00:00:00Z',
      status: 'active',
      match_count_offset: 0,
    })
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: [],
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })
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

    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText(/name/i), 'Two Courts')
    for (const name of ['Alice', 'Bob', 'Carol', 'Dave']) {
      await user.click(screen.getByRole('checkbox', { name }))
    }
    await user.type(screen.getByLabelText('Games per match'), '3')
    await user.type(screen.getByLabelText('Points per game'), '21')
    await user.click(screen.getAllByRole('button', { name: 'increase' })[2])
    await user.click(screen.getByRole('button', { name: /create tournament/i }))

    await screen.findByRole('heading', { name: 'First 2 matches drawn' })
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(await screen.findByText('Manage tournament t1')).toBeInTheDocument()
    expect(getQueue('t1')).toHaveLength(2)
  })

  it('omits a badminton-only member from a Tennis workspace checklist', async () => {
    vi.mocked(useSportModule.useSport).mockReturnValue({
      sport: 'tennis',
      setSport: vi.fn(),
    })
    const mixedPlayers = [
      makePlayer('p1', 'Alice', 'tennis'),
      makePlayer('p2', 'Bob', 'badminton'),
    ]
    vi.mocked(playersApi.listPlayers).mockResolvedValue(mixedPlayers)
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([
      makeStats('p1', 'tennis'),
    ])

    renderPage()

    expect(
      await screen.findByRole('checkbox', { name: 'Alice' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Bob' })).toBeNull()
  })

  it('shows the empty state when the active sport has no members', async () => {
    vi.mocked(useSportModule.useSport).mockReturnValue({
      sport: 'tennis',
      setSport: vi.fn(),
    })
    vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([])

    renderPage()

    expect(
      await screen.findByText(
        'No members in this sport yet. Add one from the Member tab first.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('tennis: disables the Points per game field at a fixed value of 4', async () => {
    vi.mocked(useSportModule.useSport).mockReturnValue({
      sport: 'tennis',
      setSport: vi.fn(),
    })
    vi.mocked(playersApi.listPlayers).mockResolvedValue(tennisPlayers)
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(
      tennisPlayers.map((p) => makeStats(p.id, 'tennis')),
    )
    vi.mocked(tournamentsApi.createTournament).mockResolvedValue({
      ...tournament,
      sport: 'tennis',
      points_per_game: 4,
    })
    vi.mocked(tournamentsApi.addParticipant).mockResolvedValue({
      tournament_id: 't1',
      player_id: 'p1',
      joined_at: '2026-01-01T00:00:00Z',
      status: 'active',
      match_count_offset: 0,
    })
    vi.mocked(useDrawInputsModule.assembleDrawInputs).mockResolvedValue({
      candidates: [],
      pairingHistory: { opponentPairs: new Set(), teammatePairs: new Set() },
    })
    vi.mocked(generateNextMatchModule.generateNextMatch).mockReturnValue({
      ok: true,
      participants: [
        { playerId: 'p1', team: 1 },
        { playerId: 'p2', team: 1 },
        { playerId: 'p3', team: 2 },
        { playerId: 'p4', team: 2 },
      ],
    })
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])

    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText(/name/i), 'Tennis Night')
    await user.click(screen.getByRole('radio', { name: 'Doubles' }))
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }))
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }))
    await user.click(screen.getByRole('checkbox', { name: 'Carol' }))
    await user.click(screen.getByRole('checkbox', { name: 'Dave' }))
    await user.type(screen.getByLabelText('Games per match'), '3')

    const pointsPerGameInput = screen.getByLabelText('Points per game')
    expect(pointsPerGameInput).toBeDisabled()
    expect(pointsPerGameInput).toHaveValue(4)

    await user.click(screen.getByRole('button', { name: /create tournament/i }))

    await waitFor(() => {
      expect(tournamentsApi.createTournament).toHaveBeenCalledWith(
        {
          name: 'Tennis Night',
          type: 'doubles',
          games_per_match: 3,
          points_per_game: 4,
          sport: 'tennis',
          court_count: 1,
        },
        'test-passphrase',
      )
    })
  })
})
