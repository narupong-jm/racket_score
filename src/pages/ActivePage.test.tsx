import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ActivePage } from './ActivePage'
import * as tournamentsApi from '../features/tournaments/tournamentsApi'
import * as matchesApi from '../features/matches/matchesApi'
import type { Tournament } from '../features/tournaments/tournamentsApi'
import type { Match } from '../features/matches/matchesApi'

vi.mock('../features/tournaments/tournamentsApi', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../features/tournaments/tournamentsApi')
    >()
  return {
    ...actual,
    listTournaments: vi.fn(),
  }
})

vi.mock('../features/matches/matchesApi', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../features/matches/matchesApi')>()
  return {
    ...actual,
    listMatches: vi.fn(),
  }
})

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/active']}>
        <Routes>
          <Route path="/active" element={<ActivePage />} />
          <Route
            path="/tournaments/:id"
            element={<p>Manage tournament t1</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    name: 'Sunday Smash',
    type: 'singles',
    games_per_match: 3,
    points_per_game: 21,
    win_by: 2,
    point_cap: 30,
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    ended_at: null,
    ...overrides,
  }
}

function match(id: string, sequenceNumber: number): Match {
  return {
    id,
    tournament_id: 't1',
    sequence_number: sequenceNumber,
    status: 'completed',
    created_at: '2026-01-01T00:00:00Z',
    completed_at: '2026-01-01T00:00:00Z',
    manually_adjusted: false,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('ActivePage', () => {
  it('navigates to the tournament on card tap', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([tournament()])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([
      match('m1', 1),
      match('m2', 2),
    ])

    const user = userEvent.setup()
    renderApp()

    const card = await screen.findByRole('button', { name: /sunday smash/i })
    await screen.findByText('Round 2')

    await user.click(card)

    expect(await screen.findByText('Manage tournament t1')).toBeInTheDocument()
  })

  it('shows only active tournaments, filtering out completed ones', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      tournament({ id: 't1', name: 'Sunday Smash', status: 'active' }),
      tournament({ id: 't2', name: 'Old League', status: 'completed' }),
    ])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])

    renderApp()

    expect(await screen.findByText('Sunday Smash')).toBeInTheDocument()
    expect(screen.queryByText('Old League')).toBeNull()
  })

  it('shows the exact empty-state copy when there are no active tournaments', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([])

    renderApp()

    expect(await screen.findByText('No active tournaments')).toBeInTheDocument()
  })
})
