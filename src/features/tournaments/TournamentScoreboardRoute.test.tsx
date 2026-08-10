import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TournamentScoreboardRoute } from './TournamentScoreboardRoute'
import * as tournamentsApi from './tournamentsApi'
import * as scoreboardApi from '../scoreboard/scoreboardApi'
import type { TournamentStanding } from '../matches/matchesApi'
import type { PlayerMatchHistoryRow } from '../scoreboard/scoreboardApi'

vi.mock('./tournamentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tournamentsApi')>()
  return {
    ...actual,
    getTournamentStandingsRanked: vi.fn(),
  }
})

vi.mock('../scoreboard/scoreboardApi', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../scoreboard/scoreboardApi')>()
  return {
    ...actual,
    listPlayerMatchHistory: vi.fn(),
  }
})

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/tournaments/:id/scoreboard"
            element={<TournamentScoreboardRoute />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function standing(
  player_id: string,
  win_rate: number | null,
  point_diff: number,
): TournamentStanding {
  return {
    tournament_id: 't1',
    player_id,
    name: player_id,
    matches_played: win_rate === null ? 0 : 1,
    games_won: 0,
    games_played: 0,
    point_diff,
    matches_won: 0,
    win_rate,
  }
}

function historyRow(
  player_id: string,
  points_for: number,
): PlayerMatchHistoryRow {
  return {
    player_id,
    match_id: `m-${player_id}`,
    tournament_id: 't1',
    tournament_type: 'singles',
    sport: 'badminton',
    completed_at: '2026-01-01T00:00:00Z',
    won: true,
    points_for,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('TournamentScoreboardRoute', () => {
  it('fetches standings for the id in the URL, merges in total points, and renders the same column set as the Overall Scoreboard', async () => {
    vi.mocked(tournamentsApi.getTournamentStandingsRanked).mockResolvedValue([
      standing('a', 0.25, -5),
      standing('b', 0.75, 10),
    ])
    vi.mocked(scoreboardApi.listPlayerMatchHistory).mockResolvedValue([
      historyRow('a', 15),
      historyRow('b', 21),
    ])

    renderAt('/tournaments/t1/scoreboard')

    expect(await screen.findByText('b')).toBeInTheDocument()
    expect(tournamentsApi.getTournamentStandingsRanked).toHaveBeenCalledWith(
      't1',
    )
    expect(scoreboardApi.listPlayerMatchHistory).toHaveBeenCalledWith({
      tournamentId: 't1',
    })

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0].textContent).toContain('b')
    expect(rows[1].textContent).toContain('a')
    expect(
      screen.getByRole('columnheader', { name: 'Total Points' }),
    ).toBeInTheDocument()
    expect(rows[0].textContent).toContain('21')
    expect(rows[1].textContent).toContain('15')
  })

  it('shows an empty state when the tournament has no standings yet', async () => {
    vi.mocked(tournamentsApi.getTournamentStandingsRanked).mockResolvedValue([])
    vi.mocked(scoreboardApi.listPlayerMatchHistory).mockResolvedValue([])

    renderAt('/tournaments/t1/scoreboard')

    expect(await screen.findByText('No standings yet.')).toBeInTheDocument()
  })
})
