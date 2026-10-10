import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlayerList } from './PlayerList'
import * as playersApi from './playersApi'
import * as useSportModule from '../sport/useSport'
import type { Player, PlayerStats } from './playersApi'

vi.mock('./playersApi', () => ({
  listPlayers: vi.fn(),
  listPlayerStats: vi.fn(),
  updatePlayer: vi.fn(),
  removePlayerFromSport: vi.fn(),
}))

vi.mock('../passphrase/usePassphraseGate', () => ({
  usePassphraseGate: () => ({
    getPassphrase: vi.fn().mockResolvedValue('test-passphrase'),
  }),
}))

vi.mock('../sport/useSport', () => ({
  useSport: vi.fn(),
}))

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(useSportModule.useSport).mockReturnValue({
    sport: 'badminton',
    setSport: vi.fn(),
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

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

const tennisOnlyPlayer: Player = {
  id: 'p4',
  name: 'Tennis Only Player',
  gender: 'female',
  badminton_self_selected_level: null,
  tennis_self_selected_level: 'beginner',
  created_at: '2026-01-01T00:00:00Z',
}

const bothSportsPlayer: Player = {
  id: 'p5',
  name: 'Both Sports Player',
  gender: 'male',
  badminton_self_selected_level: 'beginner',
  tennis_self_selected_level: 'intermediate',
  created_at: '2026-01-01T00:00:00Z',
}
const bothSportsStats: PlayerStats = {
  player_id: 'p5',
  name: 'Both Sports Player',
  gender: 'male',
  sport: 'badminton',
  self_selected_level: 'beginner',
  total_matches: 0,
  total_wins: 0,
  win_rate: 0,
  effective_level: 'beginner',
}

describe('PlayerList per-sport membership', () => {
  it('a tennis-only person is absent from the badminton list and vice versa', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      editablePlayer,
      tennisOnlyPlayer,
    ])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([editableStats])

    renderWithClient(<PlayerList />)

    expect(await screen.findByText('Editable Player')).toBeInTheDocument()
    expect(screen.queryByText('Tennis Only Player')).toBeNull()
  })

  it('a badminton-only person is absent from the tennis list', async () => {
    vi.mocked(useSportModule.useSport).mockReturnValue({
      sport: 'tennis',
      setSport: vi.fn(),
    })
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      editablePlayer,
      tennisOnlyPlayer,
    ])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([])

    renderWithClient(<PlayerList />)

    expect(await screen.findByText('Tennis Only Player')).toBeInTheDocument()
    expect(screen.queryByText('Editable Player')).toBeNull()
  })
})

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

  it('blocks a name that conflicts with an existing member (differing only by case/padding) and never calls updatePlayer', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      lockedPlayer,
      editablePlayer,
    ])
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
    await user.clear(input)
    await user.type(input, '  editable player  ')

    expect(
      await screen.findByText('Someone already has this name.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
    expect(playersApi.updatePlayer).not.toHaveBeenCalled()
  })

  it('still allows renaming a person to a case/padding variant of their own current name', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([lockedPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([lockedStats])
    vi.mocked(playersApi.updatePlayer).mockResolvedValue({
      ...lockedPlayer,
      name: 'locked player',
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
    await user.type(input, 'locked player')

    expect(
      screen.queryByText('Someone already has this name.'),
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(playersApi.updatePlayer).toHaveBeenCalledWith(
        'p2',
        { name: 'locked player' },
        'test-passphrase',
      )
    })
  })

  it('shows the name-taken message when a server name_taken rejection slips through a race', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([lockedPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([lockedStats])
    vi.mocked(playersApi.updatePlayer).mockRejectedValue(
      new Error('name_taken'),
    )

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
    await user.type(input, 'Brand New Name')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(
      await screen.findByText('Someone already has this name.'),
    ).toBeInTheDocument()
    expect(playersApi.updatePlayer).toHaveBeenCalledTimes(1)
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

  it('shows the single-sport body ("permanently deletes their record") for a person in only this sport', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([noHistoryPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([noHistoryStats])

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    await user.click(await screen.findByRole('button', { name: /remove/i }))

    expect(
      screen.getByText(/permanently deletes their record/i),
    ).toBeInTheDocument()
  })

  it('shows the other-sport body ("stays a member of Tennis") for a person in both sports', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([bothSportsPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([bothSportsStats])

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    await user.click(await screen.findByRole('button', { name: /remove/i }))

    expect(screen.getByText(/stay a member of Tennis/i)).toBeInTheDocument()
  })

  it('closes the dialog without removing when Cancel is clicked', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([noHistoryPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([noHistoryStats])

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    await user.click(await screen.findByRole('button', { name: /remove/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(
      screen.queryByText(/permanently deletes their record/i),
    ).toBeNull()
    expect(playersApi.removePlayerFromSport).not.toHaveBeenCalled()
  })

  it('removes the member from this sport and closes the dialog when Confirm is clicked', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([noHistoryPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([noHistoryStats])
    vi.mocked(playersApi.removePlayerFromSport).mockResolvedValue(true)

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    await user.click(await screen.findByRole('button', { name: /remove/i }))
    await user.click(screen.getByRole('button', { name: /yes, remove/i }))

    await waitFor(() => {
      expect(playersApi.removePlayerFromSport).toHaveBeenCalledWith(
        'p3',
        'badminton',
        'test-passphrase',
      )
    })
    await waitFor(() => {
      expect(
        screen.queryByText(/permanently deletes their record/i),
      ).toBeNull()
    })
  })

  it('shows the player_has_matches message and keeps the dialog open when removal fails that way', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([noHistoryPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([noHistoryStats])
    vi.mocked(playersApi.removePlayerFromSport).mockRejectedValue(
      new Error('player_has_matches'),
    )

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    await user.click(await screen.findByRole('button', { name: /remove/i }))
    await user.click(screen.getByRole('button', { name: /yes, remove/i }))

    expect(
      await screen.findByText(
        /this member has already played matches in this sport/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/permanently deletes their record/i),
    ).toBeInTheDocument()
  })

  it('shows the player_in_tournament message when removal fails that way', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([noHistoryPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([noHistoryStats])
    vi.mocked(playersApi.removePlayerFromSport).mockRejectedValue(
      new Error('player_in_tournament'),
    )

    const user = userEvent.setup()
    renderWithClient(<PlayerList />)

    await user.click(await screen.findByRole('button', { name: /remove/i }))
    await user.click(screen.getByRole('button', { name: /yes, remove/i }))

    expect(
      await screen.findByText(
        /this member is on an active tournament's roster in this sport/i,
      ),
    ).toBeInTheDocument()
  })
})
