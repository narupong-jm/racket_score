import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TournamentScoreboardRoute } from './TournamentScoreboardRoute'
import * as tournamentsApi from './tournamentsApi'
import type { TournamentStanding } from '../matches/matchesApi'

vi.mock('./tournamentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tournamentsApi')>()
  return {
    ...actual,
    getTournamentStandingsRanked: vi.fn(),
  }
})

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tournaments/:id/scoreboard" element={<TournamentScoreboardRoute />} />
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

afterEach(() => {
  vi.clearAllMocks()
})

describe('TournamentScoreboardRoute', () => {
  it('fetches standings for the id in the URL and renders them sorted with the point-diff column', async () => {
    vi.mocked(tournamentsApi.getTournamentStandingsRanked).mockResolvedValue([
      standing('a', 0.25, -5),
      standing('b', 0.75, 10),
    ])

    renderAt('/tournaments/t1/scoreboard')

    expect(await screen.findByText('b')).toBeInTheDocument()
    expect(tournamentsApi.getTournamentStandingsRanked).toHaveBeenCalledWith('t1')

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0].textContent).toContain('b')
    expect(rows[1].textContent).toContain('a')
    expect(screen.getByRole('columnheader', { name: 'Point Diff' })).toBeInTheDocument()
  })

  it('shows an empty state when the tournament has no standings yet', async () => {
    vi.mocked(tournamentsApi.getTournamentStandingsRanked).mockResolvedValue([])

    renderAt('/tournaments/t1/scoreboard')

    expect(await screen.findByText('No standings yet.')).toBeInTheDocument()
  })
})
