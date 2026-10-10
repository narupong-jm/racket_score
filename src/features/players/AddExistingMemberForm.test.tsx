import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddExistingMemberForm } from './AddExistingMemberForm'
import * as playersApi from './playersApi'
import type { Player, PlayerStats } from './playersApi'

vi.mock('./playersApi', () => ({
  listPlayers: vi.fn(),
  listPlayerStats: vi.fn(),
  updatePlayer: vi.fn(),
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

const tennisOnlyPlayer: Player = {
  id: 'p1',
  name: 'Nim',
  gender: 'female',
  badminton_self_selected_level: null,
  tennis_self_selected_level: 'beginner',
  created_at: '2026-01-01T00:00:00Z',
}
const tennisOnlyStats: PlayerStats = {
  player_id: 'p1',
  name: 'Nim',
  gender: 'female',
  sport: 'tennis',
  self_selected_level: 'beginner',
  total_matches: 0,
  total_wins: 0,
  win_rate: 0,
  effective_level: 'beginner',
}

const badmintonMember: Player = {
  id: 'p2',
  name: 'Already Badminton',
  gender: 'male',
  badminton_self_selected_level: 'advanced',
  tennis_self_selected_level: null,
  created_at: '2026-01-01T00:00:00Z',
}

describe('AddExistingMemberForm', () => {
  it('shows a tennis-only person with their tennis level in the Badminton workspace', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      tennisOnlyPlayer,
      badmintonMember,
    ])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([
      tennisOnlyStats,
    ])

    renderWithClient(<AddExistingMemberForm />)

    const select = await screen.findByLabelText('Member')
    expect(
      within(select).getByRole('option', { name: 'Nim (Tennis: Beginner)' }),
    ).toBeInTheDocument()
  })

  it('does not list existing badminton members as candidates', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      tennisOnlyPlayer,
      badmintonMember,
    ])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([
      tennisOnlyStats,
    ])

    renderWithClient(<AddExistingMemberForm />)

    const select = await screen.findByLabelText('Member')
    expect(
      within(select).queryByRole('option', { name: /already badminton/i }),
    ).toBeNull()
  })

  it('defaults the level select to Beginner, and respects a chosen level on Add', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([tennisOnlyPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([
      tennisOnlyStats,
    ])
    vi.mocked(playersApi.updatePlayer).mockResolvedValue({
      ...tennisOnlyPlayer,
      badminton_self_selected_level: 'advanced',
    })

    const user = userEvent.setup()
    renderWithClient(<AddExistingMemberForm />)

    const memberSelect = await screen.findByLabelText('Member')
    const levelSelect = screen.getByLabelText('Level')
    expect(levelSelect).toHaveValue('beginner')

    await user.selectOptions(memberSelect, 'p1')
    await user.selectOptions(levelSelect, 'advanced')
    await user.click(screen.getByRole('button', { name: /add/i }))

    await waitFor(() => {
      expect(playersApi.updatePlayer).toHaveBeenCalledWith(
        'p1',
        { sport: 'badminton', self_selected_level: 'advanced' },
        'test-passphrase',
      )
    })
  })

  it('shows the empty state, replacing the controls, when nobody is left to add', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([badmintonMember])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([])

    renderWithClient(<AddExistingMemberForm />)

    expect(
      await screen.findByText(
        'Everyone in the system is already a member of this sport.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Member')).toBeNull()
  })

  it('shows a failure message when Add fails', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([tennisOnlyPlayer])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([
      tennisOnlyStats,
    ])
    vi.mocked(playersApi.updatePlayer).mockRejectedValue(new Error('boom'))

    const user = userEvent.setup()
    renderWithClient(<AddExistingMemberForm />)

    const memberSelect = await screen.findByLabelText('Member')
    await user.selectOptions(memberSelect, 'p1')
    await user.click(screen.getByRole('button', { name: /add/i }))

    expect(
      await screen.findByText("Couldn't add that member. Please try again."),
    ).toBeInTheDocument()
  })
})
