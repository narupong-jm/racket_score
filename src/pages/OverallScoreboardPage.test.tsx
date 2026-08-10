import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OverallScoreboardPage } from './OverallScoreboardPage'
import * as useOverallScoreboardModule from '../features/scoreboard/useOverallScoreboard'
import type { PlayerScoreboardEntry } from '../features/scoreboard/aggregateScoreboard'

vi.mock('../features/scoreboard/useOverallScoreboard', async () => {
  const { useQuery } = await import('@tanstack/react-query')
  const fetchOverallScoreboard = vi.fn()
  return {
    fetchOverallScoreboard,
    useOverallScoreboard: (period: string, type: string, sport: string) =>
      useQuery({
        queryKey: ['overallScoreboard', period, type, sport],
        queryFn: () => fetchOverallScoreboard(period, type, sport),
      }),
  }
})

vi.mock('../features/sport/useSport', () => ({
  useSport: () => ({ sport: 'badminton', setSport: vi.fn() }),
}))

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

const entries: PlayerScoreboardEntry[] = [
  {
    player_id: 'p1',
    name: 'Alice',
    matches_played: 3,
    matches_won: 2,
    total_points: 60,
    win_rate: 2 / 3,
  },
]

afterEach(() => {
  vi.clearAllMocks()
})

describe('OverallScoreboardPage', () => {
  it('calls useOverallScoreboard with the selected period/type filters', async () => {
    vi.mocked(
      useOverallScoreboardModule.fetchOverallScoreboard,
    ).mockResolvedValue(entries)

    const user = userEvent.setup()
    renderWithClient(<OverallScoreboardPage />)

    await waitFor(() => {
      expect(
        useOverallScoreboardModule.fetchOverallScoreboard,
      ).toHaveBeenCalledWith('all', 'all', 'badminton')
    })

    await user.click(screen.getByRole('button', { name: 'This month' }))
    await user.click(screen.getByRole('button', { name: 'Singles' }))

    await waitFor(() => {
      expect(
        useOverallScoreboardModule.fetchOverallScoreboard,
      ).toHaveBeenCalledWith('month', 'singles', 'badminton')
    })
  })

  it('shows an empty state when no matches match the filter', async () => {
    vi.mocked(
      useOverallScoreboardModule.fetchOverallScoreboard,
    ).mockResolvedValue([])

    renderWithClient(<OverallScoreboardPage />)

    expect(await screen.findByText('No matches yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('renders the scoreboard table with the total points column when data is present', async () => {
    vi.mocked(
      useOverallScoreboardModule.fetchOverallScoreboard,
    ).mockResolvedValue(entries)

    renderWithClient(<OverallScoreboardPage />)

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Total Points' }),
    ).toBeInTheDocument()
  })
})
