import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StandingsTable } from './StandingsTable'
import * as matchesApi from './matchesApi'
import type { TournamentStanding } from './matchesApi'

vi.mock('./matchesApi', () => ({
  getStandings: vi.fn(),
}))

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

function standing(player_id: string, games_won: number, point_diff: number): TournamentStanding {
  return {
    tournament_id: 't1',
    player_id,
    name: player_id,
    matches_played: 1,
    games_won,
    games_played: 1,
    point_diff,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('StandingsTable edge cases', () => {
  it('shows a clear empty state for a tournament with no standings yet', async () => {
    vi.mocked(matchesApi.getStandings).mockResolvedValue([])

    renderWithClient(<StandingsTable tournamentId="t1" />)

    expect(await screen.findByText('No standings yet.')).toBeInTheDocument()
  })

  it('renders fully-tied players in the same deterministic order regardless of the raw data order', async () => {
    const playerB = standing('player-b', 2, 5)
    const playerA = standing('player-a', 2, 5)

    vi.mocked(matchesApi.getStandings).mockResolvedValueOnce([playerB, playerA])
    const { unmount } = renderWithClient(<StandingsTable tournamentId="t1" />)
    const rowsFirst = await screen.findAllByRole('row')
    const orderFirst = rowsFirst.slice(1).map((row) => row.textContent)
    unmount()

    vi.mocked(matchesApi.getStandings).mockResolvedValueOnce([playerA, playerB])
    renderWithClient(<StandingsTable tournamentId="t1" />)
    const rowsSecond = await screen.findAllByRole('row')
    const orderSecond = rowsSecond.slice(1).map((row) => row.textContent)

    expect(orderFirst).toEqual(orderSecond)
    expect(orderFirst[0]).toContain('player-a')
    expect(orderFirst[1]).toContain('player-b')
  })
})
