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
  deletePlayer: vi.fn(),
}))

vi.mock('../passphrase/usePassphraseGate', () => ({
  usePassphraseGate: () => ({
    getPassphrase: vi.fn().mockResolvedValue('test-passphrase'),
  }),
}))

vi.mock('../sport/useSport', () => ({
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

const editablePlayer: Player = {
  id: 'p1',
  name: 'Editable Player',
  gender: 'male',
  badminton_self_selected_level: 'beginner',
  tennis_self_selected_level: null,
  created_at: '2026-01-01T00:00:00Z',
}
const lockedPlayer: Player = {
  id: 'p2',
  name: 'Locked Player',
  gender: 'female',
  badminton_self_selected_level: 'intermediate',
  tennis_self_selected_level: null,
  created_at: '2026-01-01T00:00:00Z',
}

const editableStats: PlayerStats = {
  player_id: 'p1',
  name: 'Editable Player',
  gender: 'male',
  sport: 'badminton',
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
  sport: 'badminton',
  self_selected_level: 'intermediate',
  total_matches: 3,
  total_wins: 3,
  win_rate: 100,
  effective_level: 'pro',
}

const noHistoryPlayer: Player = {
  id: 'p3',
  name: 'No History Player',
  gender: 'male',
  badminton_self_selected_level: 'beginner',
  tennis_self_selected_level: null,
  created_at: '2026-01-01T00:00:00Z',
}
const noHistoryStats: PlayerStats = {
  player_id: 'p3',
  name: 'No History Player',
  gender: 'male',
  sport: 'badminton',
  self_selected_level: 'beginner',
  total_matches: 0,
  total_wins: 0,
  win_rate: 0,
  effective_level: 'beginner',
}

const noLevelPlayer: Player = {
  id: 'p4',
  name: 'No Level Player',
  gender: 'female',
  badminton_self_selected_level: null,
  tennis_self_selected_level: 'beginner',
  created_at: '2026-01-01T00:00:00Z',
}
const noLevelStats: PlayerStats = {
  player_id: 'p4',
  name: 'No Level Player',
  gender: 'female',
  sport: 'badminton',
  self_selected_level: null,
  total_matches: 0,
  total_wins: 0,
  win_rate: null,
  effective_level: null,
}

describe('PlayerList level editability', () => {
  it('shows an editable level control for a player with fewer than 3 matches', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([editablePlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([editableStats])

    renderWithClient(<PlayerList />)

    expect(
      await screen.findByRole('combobox', {
        name: /level for editable player/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Editable Player' }),
    ).toBeInTheDocument()
  })

  it('shows a read-only computed level for a player with 3 or more matches', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([lockedPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([lockedStats])

    renderWithClient(<PlayerList />)

    expect(await screen.findByText('Pro')).toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: /level for locked player/i }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
    expect(
      screen.getByRole('img', { name: 'Locked Player' }),
    ).toBeInTheDocument()
  })

  it('saves a level change for an editable player', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([editablePlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([editableStats])
    vi.mocked(playersApi.updatePlayer).mockResolvedValue({
      ...editablePlayer,
      badminton_self_selected_level: 'advanced',
    })

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    const select = await screen.findByRole('combobox', {
      name: /level for editable player/i,
    })
    await user.selectOptions(select, 'advanced')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(playersApi.updatePlayer).toHaveBeenCalledWith(
        'p1',
        { sport: 'badminton', self_selected_level: 'advanced' },
        'test-passphrase',
      )
    })
  })

  it('shows a "not set" prompt for a player with no level in the active sport, and saves a chosen level', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([noLevelPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([noLevelStats])
    vi.mocked(playersApi.updatePlayer).mockResolvedValue({
      ...noLevelPlayer,
      badminton_self_selected_level: 'beginner',
    })

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    expect(await screen.findByText('Not set yet')).toBeInTheDocument()
    screen.getByRole('combobox', {
      name: /level for no level player/i,
    })
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(playersApi.updatePlayer).toHaveBeenCalledWith(
        'p4',
        { sport: 'badminton', self_selected_level: 'beginner' },
        'test-passphrase',
      )
    })
  })
})

describe('PlayerList name editing', () => {
  it('shows the name as text with an edit affordance by default', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([lockedPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([lockedStats])

    renderWithClient(<PlayerList />)

    expect(await screen.findByText('Locked Player')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /edit name for locked player/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: /new name for locked player/i }),
    ).toBeNull()
  })

  it('reveals a pre-filled input when the edit affordance is clicked', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([lockedPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([lockedStats])

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    await user.click(
      await screen.findByRole('button', {
        name: /edit name for locked player/i,
      }),
    )

    const input = screen.getByRole('textbox', {
      name: /new name for locked player/i,
    })
    expect(input).toHaveValue('Locked Player')
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('saves a name change', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([lockedPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([lockedStats])
    vi.mocked(playersApi.updatePlayer).mockResolvedValue({
      ...lockedPlayer,
      name: 'New Name',
    })

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    await user.click(
      await screen.findByRole('button', {
        name: /edit name for locked player/i,
      }),
    )
    const input = screen.getByRole('textbox', {
      name: /new name for locked player/i,
    })
    await user.clear(input)
    await user.type(input, 'New Name')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(playersApi.updatePlayer).toHaveBeenCalledWith(
        'p2',
        { name: 'New Name' },
        'test-passphrase',
      )
    })
  })
})

describe('PlayerList remove member', () => {
  it('disables the Remove button for a player with match history', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([editablePlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([editableStats])

    renderWithClient(<PlayerList />)

    expect(
      await screen.findByRole('button', { name: /remove/i }),
    ).toBeDisabled()
  })

  it('enables the Remove button for a player with no match history', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([noHistoryPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([noHistoryStats])

    renderWithClient(<PlayerList />)

    expect(await screen.findByRole('button', { name: /remove/i })).toBeEnabled()
  })

  it('opens a confirm dialog with the player name when Remove is clicked', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([noHistoryPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([noHistoryStats])

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    await user.click(await screen.findByRole('button', { name: /remove/i }))

    expect(
      screen.getByText(/remove no history player from the member pool/i),
    ).toBeInTheDocument()
  })

  it('closes the dialog without deleting when Cancel is clicked', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([noHistoryPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([noHistoryStats])

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    await user.click(await screen.findByRole('button', { name: /remove/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(
      screen.queryByText(/remove no history player from the member pool/i),
    ).toBeNull()
    expect(playersApi.deletePlayer).not.toHaveBeenCalled()
  })

  it('deletes the player and closes the dialog when Confirm is clicked', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([noHistoryPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([noHistoryStats])
    vi.mocked(playersApi.deletePlayer).mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    await user.click(await screen.findByRole('button', { name: /remove/i }))
    await user.click(screen.getByRole('button', { name: /yes, remove/i }))

    await waitFor(() => {
      expect(playersApi.deletePlayer).toHaveBeenCalledWith(
        'p3',
        'test-passphrase',
      )
    })
    await waitFor(() => {
      expect(
        screen.queryByText(/remove no history player from the member pool/i),
      ).toBeNull()
    })
  })

  it('shows a generic error and keeps the dialog open when deletion fails', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([noHistoryPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([noHistoryStats])
    vi.mocked(playersApi.deletePlayer).mockRejectedValue(
      new Error('player_has_matches'),
    )

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    await user.click(await screen.findByRole('button', { name: /remove/i }))
    await user.click(screen.getByRole('button', { name: /yes, remove/i }))

    expect(
      await screen.findByText(/couldn't remove that member/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/remove no history player from the member pool/i),
    ).toBeInTheDocument()
  })
})
