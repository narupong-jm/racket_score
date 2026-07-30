import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlayerList } from './PlayerList'
import * as playersApi from './playersApi'
import type { Player, PlayerStats } from './playersApi'

vi.mock('./playersApi', () => ({
  listPlayers: vi.fn(),
  listPlayerStats: vi.fn(),
  updatePlayer: vi.fn(),
}))

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const editablePlayer: Player = {
  id: 'p1',
  name: 'Editable Player',
  gender: 'male',
  self_selected_level: 'beginner',
  created_at: '2026-01-01T00:00:00Z',
}
const lockedPlayer: Player = {
  id: 'p2',
  name: 'Locked Player',
  gender: 'female',
  self_selected_level: 'intermediate',
  created_at: '2026-01-01T00:00:00Z',
}

const editableStats: PlayerStats = {
  player_id: 'p1',
  name: 'Editable Player',
  gender: 'male',
  self_selected_level: 'beginner',
  total_matches: 2,
  total_wins: 1,
  win_rate: 50,
  effective_level: 'beginner',
}
const lockedStats: PlayerStats = {
  player_id: 'p2',
  name: 'Locked Player',
  gender: 'female',
  self_selected_level: 'intermediate',
  total_matches: 3,
  total_wins: 3,
  win_rate: 100,
  effective_level: 'pro',
}

describe('PlayerList level editability', () => {
  it('shows an editable level control for a player with fewer than 3 matches', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([editablePlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([editableStats])

    renderWithClient(<PlayerList />)

    expect(
      await screen.findByRole('combobox', { name: /level for editable player/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('shows a read-only computed level for a player with 3 or more matches', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([lockedPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([lockedStats])

    renderWithClient(<PlayerList />)

    expect(await screen.findByText('Pro')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /level for locked player/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
  })

  it('saves a level change for an editable player', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([editablePlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([editableStats])
    vi.mocked(playersApi.updatePlayer).mockResolvedValue({
      ...editablePlayer,
      self_selected_level: 'advanced',
    })

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    const select = await screen.findByRole('combobox', { name: /level for editable player/i })
    await user.selectOptions(select, 'advanced')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(playersApi.updatePlayer).toHaveBeenCalledWith('p1', {
        self_selected_level: 'advanced',
      })
    })
  })
})
