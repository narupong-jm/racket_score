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
}))

function renderWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberPage />
    </QueryClientProvider>,
  )
}

describe('MemberPage', () => {
  it('renders the heading, add-member form, and member list', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([])

    renderWithClient()

    expect(screen.getByRole('heading', { name: 'Member' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Add member' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add member/i })).toBeInTheDocument()
    expect(await screen.findByText('No players yet.')).toBeInTheDocument()
  })
})
