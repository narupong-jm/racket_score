import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CreateTournamentPage } from './CreateTournamentPage'
import * as playersApi from '../features/players/playersApi'
import * as tournamentsApi from '../features/tournaments/tournamentsApi'
import * as useDrawInputsModule from '../features/matches/useDrawInputs'
import * as matchesApi from '../features/matches/matchesApi'
import * as generateNextMatchModule from '../features/matchmaking/generateNextMatch'
import type { Player, PlayerStats } from '../features/players/playersApi'
import type { Tournament } from '../features/tournaments/tournamentsApi'
import type { Match } from '../features/matches/matchesApi'

vi.mock('../features/players/playersApi', () => ({
  listPlayers: vi.fn(),
  listPlayerStats: vi.fn(),
}))

vi.mock('../features/tournaments/tournamentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/tournaments/tournamentsApi')>()
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
  const actual = await importOriginal<typeof import('../features/matches/matchesApi')>()
  return {
    ...actual,
    createMatch: vi.fn(),
  }
})

vi.mock('../features/matchmaking/generateNextMatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/matchmaking/generateNextMatch')>()
  return {
    ...actual,
    generateNextMatch: vi.fn(),
  }
})

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/create']}>
        <Routes>
          <Route path="/create" element={<CreateTournamentPage />} />
          <Route path="/tournaments/:id" element={<p>Manage tournament t1</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function makePlayer(id: string, name: string): Player {
  return { id, name, gender: 'male', self_selected_level: 'beginner', created_at: '' }
}

function makeStats(playerId: string): PlayerStats {
  return {
    player_id: playerId,
    name: playerId,
    gender: 'male',
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

const tournament: Tournament = {
  id: 't1',
  name: 'Sunday Smash',
  type: 'doubles',
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

describe('CreateTournamentPage', () => {
  it('blocks submit and shows an inline error with 2 selected for Doubles (needs 4)', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(players.map((p) => makeStats(p.id)))

    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('radio', { name: 'Doubles' }))
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }))
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }))

    expect(
      screen.getByText('Select at least 4 players (2 selected).'),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText(/name/i), 'Sunday Smash')
    expect(screen.getByRole('button', { name: /create tournament/i })).toBeDisabled()
    expect(tournamentsApi.createTournament).not.toHaveBeenCalled()
  })

  it('succeeds with 4 selected for Doubles: shows the popup with the correct matchup and navigates on confirm', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(players.map((p) => makeStats(p.id)))
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
        { playerId: 'p2', team: 1 },
        { playerId: 'p3', team: 2 },
        { playerId: 'p4', team: 2 },
      ],
    })
    vi.mocked(matchesApi.createMatch).mockResolvedValue(firstMatch)

    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText(/name/i), 'Sunday Smash')
    await user.click(screen.getByRole('radio', { name: 'Doubles' }))
    await user.click(screen.getByRole('checkbox', { name: 'Alice' }))
    await user.click(screen.getByRole('checkbox', { name: 'Bob' }))
    await user.click(screen.getByRole('checkbox', { name: 'Carol' }))
    await user.click(screen.getByRole('checkbox', { name: 'Dave' }))

    const submitButton = screen.getByRole('button', { name: /create tournament/i })
    expect(submitButton).toBeEnabled()
    await user.click(submitButton)

    await waitFor(() => {
      expect(tournamentsApi.createTournament).toHaveBeenCalledWith({
        name: 'Sunday Smash',
        type: 'doubles',
        games_per_match: 3,
        points_per_game: 21,
      })
    })
    await waitFor(() => {
      expect(matchesApi.createMatch).toHaveBeenCalledWith('t1', 1, [
        { player_id: 'p1', team: 1 },
        { player_id: 'p2', team: 1 },
        { player_id: 'p3', team: 2 },
        { player_id: 'p4', team: 2 },
      ])
    })

    expect(
      await screen.findByText(
        (_, element) => element?.textContent === 'First match: Alice & Bob vs Carol & Dave',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go to Manage Tournament' }))

    expect(await screen.findByText('Manage tournament t1')).toBeInTheDocument()
  })
})
