import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreatePlayerForm } from './CreatePlayerForm'
import * as playersApi from './playersApi'

vi.mock('./playersApi', () => ({
  createPlayer: vi.fn(),
}))

vi.mock('../passphrase/usePassphraseGate', () => ({
  usePassphraseGate: () => ({ getPassphrase: vi.fn().mockResolvedValue('test-passphrase') }),
}))

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('CreatePlayerForm', () => {
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
      self_selected_level: 'advanced',
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
          self_selected_level: 'advanced',
        },
        'test-passphrase',
      )
    })
  })
})
