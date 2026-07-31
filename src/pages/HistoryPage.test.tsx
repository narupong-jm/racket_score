import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HistoryPage } from './HistoryPage'
import * as playersApi from '../features/players/playersApi'
import * as tournamentsApi from '../features/tournaments/tournamentsApi'
import * as matchesApi from '../features/matches/matchesApi'
import type { Player } from '../features/players/playersApi'
import type { Tournament } from '../features/tournaments/tournamentsApi'
import type { RecentCompletedMatch } from '../features/matches/matchesApi'

vi.mock('../features/players/playersApi', () => ({
  listPlayers: vi.fn(),
}))

vi.mock('../features/tournaments/tournamentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/tournaments/tournamentsApi')>()
  return {
    ...actual,
    listTournaments: vi.fn(),
  }
})

vi.mock('../features/matches/matchesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/matches/matchesApi')>()
  return {
    ...actual,
    listRecentCompletedMatches: vi.fn(),
  }
})

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const players: Player[] = [
  { id: 'p1', name: 'Alice', gender: 'female', self_selected_level: 'beginner', created_at: '' },
  { id: 'p2', name: 'Bob', gender: 'male', self_selected_level: 'beginner', created_at: '' },
]

const recentMatch: RecentCompletedMatch = {
  match: {
    id: 'm1',
    tournament_id: 't1',
    sequence_number: 2,
    status: 'completed',
    created_at: '2026-01-01T00:00:00Z',
    completed_at: '2026-01-01T00:00:00Z',
  },
  tournamentName: 'Sunday Smash',
  participants: [
    { match_id: 'm1', player_id: 'p1', team: 1 },
    { match_id: 'm1', player_id: 'p2', team: 2 },
  ],
  games: [{ match_id: 'm1', game_number: 1, team1_score: 21, team2_score: 15 }],
}

const activeTournament: Tournament = {
  id: 't1',
  name: 'Sunday Smash',
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
  name: 'Winter Cup',
  type: 'doubles',
  status: 'completed',
  ended_at: '2026-01-02T00:00:00Z',
}

describe('HistoryPage', () => {
  it('renders both the By match and By tournament sections', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
    vi.mocked(matchesApi.listRecentCompletedMatches).mockResolvedValue([recentMatch])
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament, completedTournament])

    renderPage()

    expect(screen.getByRole('heading', { name: 'By match' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'By tournament' })).toBeInTheDocument()

    expect(await screen.findByText('Round 2')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('1-0')).toBeInTheDocument()

    expect(await screen.findByText('Winter Cup')).toBeInTheDocument()
    expect(screen.getAllByText('Sunday Smash').length).toBeGreaterThan(0)
  })

  it('links every By-tournament row to its scoreboard, regardless of status', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
    vi.mocked(matchesApi.listRecentCompletedMatches).mockResolvedValue([])
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament, completedTournament])

    renderPage()

    const activeLink = await screen.findByRole('link', { name: /sunday smash/i })
    const completedLink = screen.getByRole('link', { name: /winter cup/i })

    expect(activeLink).toHaveAttribute('href', '/tournaments/t1/scoreboard')
    expect(completedLink).toHaveAttribute('href', '/tournaments/t2/scoreboard')
  })
})
