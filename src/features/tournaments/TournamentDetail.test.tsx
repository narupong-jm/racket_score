import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TournamentDetail } from './TournamentDetail'
import * as tournamentsApi from './tournamentsApi'
import * as playersApi from '../players/playersApi'
import type { Tournament } from './tournamentsApi'
import type { Player } from '../players/playersApi'

vi.mock('./tournamentsApi', () => ({
  listTournaments: vi.fn(),
  listParticipants: vi.fn(),
  addParticipant: vi.fn(),
  endTournament: vi.fn(),
}))

vi.mock('../players/playersApi', () => ({
  listPlayers: vi.fn(),
  createPlayer: vi.fn(),
}))

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const activeTournament: Tournament = {
  id: 't1',
  name: 'Active T',
  type: 'singles',
  games_per_match: 3,
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
  name: 'Completed T',
  status: 'completed',
  ended_at: '2026-01-02T00:00:00Z',
}
const searchablePlayer: Player = {
  id: 'p1',
  name: 'Searchable Player',
  gender: 'male',
  self_selected_level: 'beginner',
  created_at: '2026-01-01T00:00:00Z',
}

describe('TournamentDetail end tournament', () => {
  it('shows an enabled End tournament button and enabled add-participant controls for an active tournament', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament])
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([])
    vi.mocked(playersApi.listPlayers).mockResolvedValue([searchablePlayer])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    expect(await screen.findByRole('button', { name: /end tournament/i })).toBeEnabled()

    await user.type(screen.getByLabelText(/search players/i), 'Searchable')
    expect(await screen.findByRole('button', { name: /^add$/i })).toBeEnabled()
  })

  it('hides End tournament and disables add-participant controls for a completed tournament', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([completedTournament])
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([])
    vi.mocked(playersApi.listPlayers).mockResolvedValue([searchablePlayer])

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t2" />)

    await screen.findByText('Completed T')
    expect(screen.queryByRole('button', { name: /end tournament/i })).toBeNull()

    await user.type(screen.getByLabelText(/search players/i), 'Searchable')
    expect(await screen.findByRole('button', { name: /^add$/i })).toBeDisabled()

    await user.type(screen.getByLabelText(/new player name/i), 'Someone New')
    expect(screen.getByRole('button', { name: /create & add/i })).toBeDisabled()
  })

  it('calls endTournament with the correct id on click', async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([activeTournament])
    vi.mocked(tournamentsApi.listParticipants).mockResolvedValue([])
    vi.mocked(playersApi.listPlayers).mockResolvedValue([])
    vi.mocked(tournamentsApi.endTournament).mockResolvedValue({
      ...activeTournament,
      status: 'completed',
    })

    const user = userEvent.setup()
    renderWithClient(<TournamentDetail tournamentId="t1" />)

    const endButton = await screen.findByRole('button', { name: /end tournament/i })
    await user.click(endButton)

    await waitFor(() => {
      expect(tournamentsApi.endTournament).toHaveBeenCalledWith('t1')
    })
  })
})
