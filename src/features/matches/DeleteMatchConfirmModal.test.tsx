import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DeleteMatchConfirmModal } from './DeleteMatchConfirmModal'
import * as matchesApi from './matchesApi'
import * as playersApi from '../players/playersApi'
import type { RecentCompletedMatch } from './matchesApi'
import type { PlayerStats } from '../players/playersApi'

vi.mock('./matchesApi', async () => {
  const actual =
    await vi.importActual<typeof import('./matchesApi')>('./matchesApi')
  return {
    ...actual,
    deleteMatchResult: vi.fn(),
  }
})

vi.mock('../players/playersApi', () => ({
  listPlayerStats: vi.fn(),
}))

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

const row: RecentCompletedMatch = {
  match: {
    id: 'm1',
    tournament_id: 't1',
    sequence_number: 1,
    status: 'completed',
    manually_adjusted: false,
    created_at: '2026-01-01T00:00:00Z',
    completed_at: '2026-01-01T00:10:00Z',
  },
  tournamentName: 'Spring Open',
  participants: [
    { match_id: 'm1', player_id: 'p1', team: 1 },
    { match_id: 'm1', player_id: 'p2', team: 2 },
  ],
  games: [{ match_id: 'm1', game_number: 1, team1_score: 21, team2_score: 15 }],
}

const playerNameById = new Map([
  ['p1', 'Alice'],
  ['p2', 'Bob'],
])

const statsList: PlayerStats[] = [
  {
    player_id: 'p1',
    name: 'Alice',
    gender: 'female',
    sport: 'badminton',
    self_selected_level: 'beginner',
    total_matches: 5,
    total_wins: 3,
    win_rate: 60,
    effective_level: 'beginner',
  },
  {
    player_id: 'p2',
    name: 'Bob',
    gender: 'male',
    sport: 'badminton',
    self_selected_level: 'beginner',
    total_matches: 5,
    total_wins: 2,
    win_rate: 40,
    effective_level: 'beginner',
  },
]

describe('DeleteMatchConfirmModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the impact preview with correct before/after numbers for each participant', async () => {
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(statsList)

    renderWithClient(
      <DeleteMatchConfirmModal
        row={row}
        sport="badminton"
        playerNameById={playerNameById}
        onClose={vi.fn()}
      />,
    )

    // team1 (p1/Alice) won the only game 21-15, so p1 loses a win on delete
    // (5 matches/60% -> 4 matches/50%) while p2 just loses a played match
    // (5 matches/40% -> 4 matches/50%).
    expect(
      await screen.findByText('Alice: 5 matches (60%) -> 4 matches (50%)'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Bob: 5 matches (40%) -> 4 matches (50%)'),
    ).toBeInTheDocument()
  })

  it('passes the exact typed passphrase to the delete mutation on Confirm', async () => {
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(statsList)
    vi.mocked(matchesApi.deleteMatchResult).mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderWithClient(
      <DeleteMatchConfirmModal
        row={row}
        sport="badminton"
        playerNameById={playerNameById}
        onClose={vi.fn()}
      />,
    )

    const input = await screen.findByLabelText('Passphrase')
    await user.type(input, 'the-real-secret')
    await user.click(screen.getByRole('button', { name: 'Delete match' }))

    await waitFor(() => {
      expect(matchesApi.deleteMatchResult).toHaveBeenCalledWith(
        'm1',
        'the-real-secret',
      )
    })
  })

  it('does not call the mutation on Cancel, and clears the field on reopen', async () => {
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(statsList)
    const onClose = vi.fn()
    const user = userEvent.setup()

    const { rerender } = renderWithClient(
      <DeleteMatchConfirmModal
        row={row}
        sport="badminton"
        playerNameById={playerNameById}
        onClose={onClose}
      />,
    )

    const input = await screen.findByLabelText('Passphrase')
    await user.type(input, 'typed-but-cancelled')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(matchesApi.deleteMatchResult).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)

    // Simulate the parent clearing `row` after onClose, then reopening it.
    rerender(
      <QueryClientProvider
        client={new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })}
      >
        <DeleteMatchConfirmModal
          row={null}
          sport="badminton"
          playerNameById={playerNameById}
          onClose={onClose}
        />
      </QueryClientProvider>,
    )
    rerender(
      <QueryClientProvider
        client={new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })}
      >
        <DeleteMatchConfirmModal
          row={row}
          sport="badminton"
          playerNameById={playerNameById}
          onClose={onClose}
        />
      </QueryClientProvider>,
    )

    const reopenedInput = await screen.findByLabelText('Passphrase')
    expect(reopenedInput).toHaveValue('')
  })

  it('shows the generic error message and keeps the field populated on a rejected delete', async () => {
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(statsList)
    vi.mocked(matchesApi.deleteMatchResult).mockRejectedValue(
      new Error('invalid_passphrase'),
    )
    const user = userEvent.setup()

    renderWithClient(
      <DeleteMatchConfirmModal
        row={row}
        sport="badminton"
        playerNameById={playerNameById}
        onClose={vi.fn()}
      />,
    )

    const input = await screen.findByLabelText('Passphrase')
    await user.type(input, 'wrong-secret')
    await user.click(screen.getByRole('button', { name: 'Delete match' }))

    expect(
      await screen.findByText("Couldn't delete the match. Please try again."),
    ).toBeInTheDocument()
    expect(input).toHaveValue('wrong-secret')
  })

  it('disables the Confirm button while the passphrase field is empty', async () => {
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue(statsList)

    renderWithClient(
      <DeleteMatchConfirmModal
        row={row}
        sport="badminton"
        playerNameById={playerNameById}
        onClose={vi.fn()}
      />,
    )

    expect(
      await screen.findByRole('button', { name: 'Delete match' }),
    ).toBeDisabled()
  })
})
