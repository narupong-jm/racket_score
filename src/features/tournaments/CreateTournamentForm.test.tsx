import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateTournamentForm } from './CreateTournamentForm'
import * as tournamentsApi from './tournamentsApi'

vi.mock('./tournamentsApi', () => ({
  createTournament: vi.fn(),
}))

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('CreateTournamentForm', () => {
  it('shows the correct default cap and updates it as points per game changes', async () => {
    const user = userEvent.setup()
    renderWithClient(<CreateTournamentForm />)

    expect(screen.getByText('Deuce cap: 30')).toBeInTheDocument() // default 21 -> round(21*30/21)=30

    const pointsInput = screen.getByLabelText(/points per game/i)
    await user.clear(pointsInput)
    await user.type(pointsInput, '15')

    expect(screen.getByText('Deuce cap: 21')).toBeInTheDocument() // 15 -> round(15*30/21)=21
  })

  it('blocks submit when name is empty', () => {
    renderWithClient(<CreateTournamentForm />)

    expect(screen.getByRole('button', { name: /create tournament/i })).toBeDisabled()
    expect(tournamentsApi.createTournament).not.toHaveBeenCalled()
  })

  it('submits the correct payload on valid input', async () => {
    vi.mocked(tournamentsApi.createTournament).mockResolvedValue({
      id: 't1',
      name: 'Friday Battle',
      type: 'doubles',
      games_per_match: 3,
      points_per_game: 15,
      win_by: 2,
      point_cap: 21,
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
      ended_at: null,
    })
    const user = userEvent.setup()
    renderWithClient(<CreateTournamentForm />)

    await user.type(screen.getByLabelText(/name/i), 'Friday Battle')
    await user.click(screen.getByRole('radio', { name: 'Doubles' }))

    const pointsInput = screen.getByLabelText(/points per game/i)
    await user.clear(pointsInput)
    await user.type(pointsInput, '15')

    const submitButton = screen.getByRole('button', { name: /create tournament/i })
    expect(submitButton).toBeEnabled()
    await user.click(submitButton)

    await waitFor(() => {
      expect(tournamentsApi.createTournament).toHaveBeenCalledWith({
        name: 'Friday Battle',
        type: 'doubles',
        games_per_match: 3,
        points_per_game: 15,
      })
    })
  })
})
