import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreatePlayerForm } from './CreatePlayerForm'
import * as playersApi from './playersApi'
import type { Player } from './playersApi'

vi.mock('./playersApi', () => ({
  createPlayer: vi.fn(),
  listPlayers: vi.fn(),
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

const existingPlayer: Player = {
  id: 'p1',
  name: 'Existing Player',
  gender: 'male',
  badminton_self_selected_level: 'beginner',
  tennis_self_selected_level: null,
  created_at: '2026-01-01T00:00:00Z',
}

describe('CreatePlayerForm', () => {
  beforeEach(() => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('blocks submit when name is empty', () => {
    renderWithClient(<CreatePlayerForm />)

    const submitButton = screen.getByRole('button', { name: /add member/i })
    expect(submitButton).toBeDisabled()
    expect(playersApi.createPlayer).not.toHaveBeenCalled()
  })

  it('submits with valid input and calls the API with the entered payload', async () => {
    vi.mocked(playersApi.createPlayer).mockResolvedValue({
      id: '1',
      name: 'New Player',
      gender: 'female',
      badminton_self_selected_level: 'advanced',
      tennis_self_selected_level: null,
      created_at: '2026-01-01T00:00:00Z',
    })
    const user = userEvent.setup()
    renderWithClient(<CreatePlayerForm />)

    await user.type(screen.getByLabelText(/name/i), 'New Player')
    await user.click(screen.getByRole('radio', { name: 'Female' }))
    await user.selectOptions(screen.getByLabelText(/level/i), 'advanced')

    const submitButton = screen.getByRole('button', { name: /add member/i })
    expect(submitButton).toBeEnabled()
    await user.click(submitButton)

    await waitFor(() => {
      expect(playersApi.createPlayer).toHaveBeenCalledWith(
        {
          name: 'New Player',
          gender: 'female',
          sport: 'badminton',
          self_selected_level: 'advanced',
        },
        'test-passphrase',
      )
    })
  })

  it('blocks submit and shows a message for a name that conflicts with an existing member', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([existingPlayer])
    const user = userEvent.setup()
    renderWithClient(<CreatePlayerForm />)

    await user.type(screen.getByLabelText(/name/i), '  existing player  ')

    expect(
      await screen.findByText(
        'Someone already has this name. Use "Add an existing member" instead.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add member/i })).toBeDisabled()
    expect(playersApi.createPlayer).not.toHaveBeenCalled()
  })
})
