import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemberPage } from './MemberPage'
import * as playersApi from '../features/players/playersApi'

vi.mock('../features/players/playersApi', () => ({
  listPlayers: vi.fn(),
  listPlayerStats: vi.fn(),
  createPlayer: vi.fn(),
  updatePlayer: vi.fn(),
  removePlayerFromSport: vi.fn(),
}))

vi.mock('../features/passphrase/usePassphraseGate', () => ({
  usePassphraseGate: () => ({
    getPassphrase: vi.fn().mockResolvedValue('test-passphrase'),
  }),
}))

vi.mock('../features/sport/useSport', () => ({
  useSport: () => ({ sport: 'badminton', setSport: vi.fn() }),
}))

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberPage />
    </QueryClientProvider>,
  )
}

describe('MemberPage', () => {
  it('renders both headings, the add-member forms, and the member list', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([])

    renderWithClient()

    expect(screen.getByRole('heading', { name: 'Member' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Add a new member' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Add an existing member' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /add member/i }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('No members in this sport yet.'),
    ).toBeInTheDocument()
  })
})
