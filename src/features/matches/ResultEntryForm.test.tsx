import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResultEntryForm } from './ResultEntryForm'
import * as matchesApi from './matchesApi'

vi.mock('./matchesApi', () => ({
  recordMatchResult: vi.fn(),
}))

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const baseProps = {
  tournamentId: 't1',
  matchId: 'm1',
  gamesPerMatch: 3,
  pointsPerGame: 21,
  winBy: 2,
  cap: 30,
}

describe('ResultEntryForm', () => {
  it('disables submit with no games entered', () => {
    renderWithClient(<ResultEntryForm {...baseProps} />)

    expect(screen.getByRole('button', { name: /submit result/i })).toBeDisabled()
  })

  it('blocks submit and shows a visible error for an invalid game score (win-by-1)', async () => {
    const user = userEvent.setup()
    renderWithClient(<ResultEntryForm {...baseProps} />)

    await user.type(screen.getByLabelText('Game 1 - Team 1'), '21')
    await user.type(screen.getByLabelText('Game 1 - Team 2'), '20')

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid score/i)
    expect(screen.getByRole('button', { name: /submit result/i })).toBeDisabled()
    expect(matchesApi.recordMatchResult).not.toHaveBeenCalled()
  })

  it('blocks submit for an under-decided match (1-1 with nothing else entered)', async () => {
    const user = userEvent.setup()
    renderWithClient(<ResultEntryForm {...baseProps} />)

    await user.type(screen.getByLabelText('Game 1 - Team 1'), '21')
    await user.type(screen.getByLabelText('Game 1 - Team 2'), '15')
    await user.type(screen.getByLabelText('Game 2 - Team 1'), '15')
    await user.type(screen.getByLabelText('Game 2 - Team 2'), '21')

    expect(await screen.findByText(/do not add up to a decided match/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit result/i })).toBeDisabled()
  })

  it('submits the correct payload for a match decided in the minimum number of games', async () => {
    vi.mocked(matchesApi.recordMatchResult).mockResolvedValue({
      id: 'm1',
      tournament_id: 't1',
      sequence_number: 1,
      status: 'completed',
      created_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:00:00Z',
    })

    const user = userEvent.setup()
    renderWithClient(<ResultEntryForm {...baseProps} />)

    await user.type(screen.getByLabelText('Game 1 - Team 1'), '21')
    await user.type(screen.getByLabelText('Game 1 - Team 2'), '15')
    await user.type(screen.getByLabelText('Game 2 - Team 1'), '21')
    await user.type(screen.getByLabelText('Game 2 - Team 2'), '18')

    const submitButton = screen.getByRole('button', { name: /submit result/i })
    expect(submitButton).toBeEnabled()
    await user.click(submitButton)

    await waitFor(() => {
      expect(matchesApi.recordMatchResult).toHaveBeenCalledWith('m1', [
        { game_number: 1, team1_score: 21, team2_score: 15 },
        { game_number: 2, team1_score: 21, team2_score: 18 },
      ])
    })
  })

  it('submits the correct payload for a match decided with the full game count', async () => {
    vi.mocked(matchesApi.recordMatchResult).mockResolvedValue({
      id: 'm1',
      tournament_id: 't1',
      sequence_number: 1,
      status: 'completed',
      created_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:00:00Z',
    })

    const user = userEvent.setup()
    renderWithClient(<ResultEntryForm {...baseProps} />)

    await user.type(screen.getByLabelText('Game 1 - Team 1'), '21')
    await user.type(screen.getByLabelText('Game 1 - Team 2'), '15')
    await user.type(screen.getByLabelText('Game 2 - Team 1'), '18')
    await user.type(screen.getByLabelText('Game 2 - Team 2'), '21')
    await user.type(screen.getByLabelText('Game 3 - Team 1'), '21')
    await user.type(screen.getByLabelText('Game 3 - Team 2'), '19')

    await user.click(screen.getByRole('button', { name: /submit result/i }))

    await waitFor(() => {
      expect(matchesApi.recordMatchResult).toHaveBeenCalledWith('m1', [
        { game_number: 1, team1_score: 21, team2_score: 15 },
        { game_number: 2, team1_score: 18, team2_score: 21 },
        { game_number: 3, team1_score: 21, team2_score: 19 },
      ])
    })
  })

  it('blocks submit for extra games entered after the match was already decided', async () => {
    const user = userEvent.setup()
    renderWithClient(<ResultEntryForm {...baseProps} />)

    await user.type(screen.getByLabelText('Game 1 - Team 1'), '21')
    await user.type(screen.getByLabelText('Game 1 - Team 2'), '15')
    await user.type(screen.getByLabelText('Game 2 - Team 1'), '21')
    await user.type(screen.getByLabelText('Game 2 - Team 2'), '18')
    await user.type(screen.getByLabelText('Game 3 - Team 1'), '15')
    await user.type(screen.getByLabelText('Game 3 - Team 2'), '21')

    expect(await screen.findByText(/do not add up to a decided match/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit result/i })).toBeDisabled()
  })
})
