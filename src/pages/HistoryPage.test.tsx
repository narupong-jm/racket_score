import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    manually_adjusted: false,
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

const cancelledTournament: Tournament = {
  ...activeTournament,
  id: 't3',
  name: 'Rained Out Cup',
  status: 'cancelled',
  ended_at: null,
}

describe('HistoryPage', () => {
  it('renders both the By match and By tournament sections, each collapsed by default', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
    vi.mocked(matchesApi.listRecentCompletedMatches).mockResolvedValue([recentMatch])
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament, completedTournament])

    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('heading', { name: 'By match' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'By tournament' })).toBeInTheDocument()

    // Collapsed by default: heading + toggle only, no item content yet.
    expect(screen.queryByText('Round 2')).toBeNull()
    expect(screen.queryByText('Winter Cup')).toBeNull()
    const toggles = screen.getAllByRole('button', { name: 'Show more' })
    expect(toggles).toHaveLength(2)

    await user.click(toggles[0])
    expect(await screen.findByText('Round 2')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('1-0')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show more' }))
    expect(await screen.findByText('Winter Cup')).toBeInTheDocument()
    expect(screen.getAllByText('Sunday Smash').length).toBeGreaterThan(0)
  })

  it('links every By-tournament row to its scoreboard, regardless of status', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
    vi.mocked(matchesApi.listRecentCompletedMatches).mockResolvedValue([])
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament, completedTournament])

    const user = userEvent.setup()
    renderPage()

    const byTournamentHeading = await screen.findByRole('heading', { name: 'By tournament' })
    const byTournamentToggle = byTournamentHeading.parentElement!.querySelector('button')!
    await user.click(byTournamentToggle)

    const activeLink = await screen.findByRole('link', { name: /sunday smash/i })
    const completedLink = screen.getByRole('link', { name: /winter cup/i })

    expect(activeLink).toHaveAttribute('href', '/tournaments/t1/scoreboard')
    expect(completedLink).toHaveAttribute('href', '/tournaments/t2/scoreboard')
  })

  describe('collapsible sections', () => {
    it('shows only the heading and toggle when collapsed, with no item peek', async () => {
      vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
      vi.mocked(matchesApi.listRecentCompletedMatches).mockResolvedValue([recentMatch])
      vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament])

      renderPage()

      await screen.findByRole('heading', { name: 'By match' })
      expect(screen.queryByText('Round 2')).toBeNull()
      expect(screen.queryByText('Sunday Smash')).toBeNull()
      expect(screen.getAllByRole('button', { name: 'Show more' })).toHaveLength(2)
    })

    it('expands a section on toggle click and flips its label to Show less', async () => {
      vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
      vi.mocked(matchesApi.listRecentCompletedMatches).mockResolvedValue([recentMatch])
      vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament])

      const user = userEvent.setup()
      renderPage()

      const byMatchHeading = screen.getByRole('heading', { name: 'By match' })
      const byMatchToggle = byMatchHeading.parentElement!.querySelector('button')!

      await user.click(byMatchToggle)

      expect(await screen.findByText('Round 2')).toBeInTheDocument()
      expect(byMatchToggle).toHaveTextContent('Show less')
    })

    it('re-collapses a section on a second toggle click', async () => {
      vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
      vi.mocked(matchesApi.listRecentCompletedMatches).mockResolvedValue([recentMatch])
      vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament])

      const user = userEvent.setup()
      renderPage()

      const byMatchHeading = screen.getByRole('heading', { name: 'By match' })
      const byMatchToggle = byMatchHeading.parentElement!.querySelector('button')!

      await user.click(byMatchToggle)
      expect(await screen.findByText('Round 2')).toBeInTheDocument()

      await user.click(byMatchToggle)
      expect(screen.queryByText('Round 2')).toBeNull()
      expect(byMatchToggle).toHaveTextContent('Show more')
    })

    it('toggles each section independently', async () => {
      vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
      vi.mocked(matchesApi.listRecentCompletedMatches).mockResolvedValue([recentMatch])
      vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament])

      const user = userEvent.setup()
      renderPage()

      const byMatchHeading = screen.getByRole('heading', { name: 'By match' })
      const byMatchToggle = byMatchHeading.parentElement!.querySelector('button')!

      await user.click(byMatchToggle)
      expect(await screen.findByText('Round 2')).toBeInTheDocument()

      // By tournament section is untouched -- still collapsed.
      const byTournamentHeading = screen.getByRole('heading', { name: 'By tournament' })
      const byTournamentToggle = byTournamentHeading.parentElement!.querySelector('button')!
      expect(byTournamentToggle).toHaveTextContent('Show more')
      expect(screen.queryByRole('link', { name: /sunday smash/i })).toBeNull()
    })
  })

  describe('cancelled tournament row', () => {
    it('renders a cancelled tournament as plain text with a Cancelled badge, not a link', async () => {
      vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
      vi.mocked(matchesApi.listRecentCompletedMatches).mockResolvedValue([])
      vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
        activeTournament,
        cancelledTournament,
      ])

      const user = userEvent.setup()
      renderPage()

      const byTournamentHeading = await screen.findByRole('heading', { name: 'By tournament' })
      const byTournamentToggle = byTournamentHeading.parentElement!.querySelector('button')!
      await user.click(byTournamentToggle)

      expect(await screen.findByText('Rained Out Cup')).toBeInTheDocument()
      expect(screen.getByText('Cancelled')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /rained out cup/i })).toBeNull()

      // Active/completed rows are unaffected -- still plain links, still unbadged.
      const activeLink = screen.getByRole('link', { name: /sunday smash/i })
      expect(activeLink).toHaveAttribute('href', '/tournaments/t1/scoreboard')
    })
  })

  describe('manually-adjusted badge', () => {
    it('does not show a badge for a match that was not manually adjusted', async () => {
      vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
      vi.mocked(matchesApi.listRecentCompletedMatches).mockResolvedValue([recentMatch])
      vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([])

      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getAllByRole('button', { name: 'Show more' })[0])

      await screen.findByText('Round 2')
      expect(screen.queryByText('Manually adjusted')).toBeNull()
    })

    it('shows a badge next to a match that was manually adjusted', async () => {
      const adjustedMatch: RecentCompletedMatch = {
        ...recentMatch,
        match: { ...recentMatch.match, manually_adjusted: true },
      }
      vi.mocked(playersApi.listPlayers).mockResolvedValue(players)
      vi.mocked(matchesApi.listRecentCompletedMatches).mockResolvedValue([adjustedMatch])
      vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([])

      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getAllByRole('button', { name: 'Show more' })[0])

      expect(await screen.findByText('Round 2')).toBeInTheDocument()
      expect(screen.getByText('Manually adjusted')).toBeInTheDocument()
    })
  })
})
