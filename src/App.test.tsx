import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import * as playersApi from './features/players/playersApi'
import * as tournamentsApi from './features/tournaments/tournamentsApi'

vi.mock('./features/players/playersApi', () => ({
  listPlayers: vi.fn(),
  listPlayerStats: vi.fn(),
}))

vi.mock('./features/tournaments/tournamentsApi', () => ({
  listTournaments: vi.fn(),
}))

describe('App', () => {
  it('renders without crashing', async () => {
    vi.mocked(playersApi.listPlayers).mockResolvedValue([])
    vi.mocked(playersApi.listPlayerStats).mockResolvedValue([])
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('No players yet.')).toBeInTheDocument()
    expect(await screen.findByText('No tournaments yet.')).toBeInTheDocument()
  })
})
