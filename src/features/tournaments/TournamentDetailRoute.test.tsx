import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TournamentDetailRoute } from './TournamentDetailRoute'
import * as tournamentsApi from './tournamentsApi'
import * as playersApi from '../players/playersApi'
import * as matchesApi from '../matches/matchesApi'
import type { Tournament } from './tournamentsApi'

vi.mock('./tournamentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tournamentsApi')>()
  return {
    ...actual,
    listTournaments: vi.fn(),
    listParticipants: vi.fn(),
  }
})

vi.mock('../players/playersApi', () => ({
  listPlayers: vi.fn(),
  listPlayerStats: vi.fn(),
}))

vi.mock('../matches/matchesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../matches/matchesApi')>()
  return {
    ...actual,
    listMatches: vi.fn(),
    getParticipantsForMatches: vi.fn(),
    listGamesForMatches: vi.fn(),
  }
})

vi.mock('../passphrase/usePassphraseGate', () => ({
  usePassphraseGate: () => ({
    getPassphrase: vi.fn().mockResolvedValue('test-passphrase'),
  }),
}))

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tournaments/:id" element={<TournamentDetailRoute />} />
          <Route
            path="/tournaments/:id/scoreboard"
            element={<p>Scoreboard for t1</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const completedTournament: Tournament = {
  id: 't1',
  name: 'Completed T',
  type: 'singles',
  sport: 'badminton',
  games_per_match: 1,
  points_per_game: 21,
  win_by: 2,
  point_cap: 30,
  status: 'completed',
  created_at: '2026-01-01T00:00:00Z',
  ended_at: '2026-01-02T00:00:00Z',
}

const activeTournament: Tournament = {
  ...completedTournament,
  name: 'Active T',
  status: 'active',
  ended_at: null,
}

describe('TournamentDetailRoute', () => {
  it('redirects to the scoreboard route when the tournament is already completed', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      completedTournament,
    ])

    renderAt('/tournaments/t1')

    expect(await screen.findByText('Scoreboard for t1')).toBeInTheDocument()
  })

  it('renders the Manage Tournament screen (no redirect) for an active tournament', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      activeTournament,
    ])
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([])
    vi.mocked(playersApi.listPlayers).mockResolvedValue([])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([])
    vi.mocked(matchesApi.listMatches).mockResolvedValue([])
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([])
    vi.mocked(matchesApi.listGamesForMatches).mockResolvedValue([])

    renderAt('/tournaments/t1')

    expect(
      await screen.findByText('Active T', { exact: false }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Scoreboard for t1')).toBeNull()
  })
})
