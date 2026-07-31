import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import * as playersApi from './features/players/playersApi'
import * as tournamentsApi from './features/tournaments/tournamentsApi'
import * as matchesApi from './features/matches/matchesApi'
import * as scoreboardApi from './features/scoreboard/scoreboardApi'

vi.mock('./features/players/playersApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/players/playersApi')>()
  return {
    ...actual,
    listPlayers: vi.fn(),
    listPlayerStats: vi.fn(),
  }
})

vi.mock('./features/tournaments/tournamentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/tournaments/tournamentsApi')>()
  return {
    ...actual,
    listTournaments: vi.fn(),
  }
})

vi.mock('./features/matches/matchesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/matches/matchesApi')>()
  return {
    ...actual,
    listRecentCompletedMatches: vi.fn(),
  }
})

vi.mock('./features/scoreboard/scoreboardApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/scoreboard/scoreboardApi')>()
  return {
    ...actual,
    listPlayerMatchHistory: vi.fn(),
  }
})

function renderApp(initialPath = '/') {
  vi.mocked(playersApi.listPlayers).mockResolvedValue([])
  vi.mocked(playersApi.listPlayerStats).mockResolvedValue([])
  vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([])
  vi.mocked(matchesApi.listRecentCompletedMatches).mockResolvedValue([])
  vi.mocked(scoreboardApi.listPlayerMatchHistory).mockResolvedValue([])

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App', () => {
  it('renders all 5 tab links with the correct text and destination', () => {
    renderApp()

    const tabs: [string, string][] = [
      ['Create', '/create'],
      ['Active', '/active'],
      ['Scoreboard', '/scoreboard'],
      ['History', '/history'],
      ['Member', '/member'],
    ]

    for (const [name, href] of tabs) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
    }
  })

  it('redirects the index route ("/") to the Create tab', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Create' })).toBeInTheDocument()
  })

  it('navigates to each tab and renders its page', async () => {
    const user = userEvent.setup()
    renderApp('/create')

    expect(await screen.findByRole('heading', { name: 'Create' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Active' }))
    expect(await screen.findByRole('heading', { name: 'Active' })).toBeInTheDocument()
    expect(await screen.findByText('No active tournaments')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Scoreboard' }))
    expect(await screen.findByRole('heading', { name: 'Scoreboard' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'History' }))
    expect(await screen.findByRole('heading', { name: 'History' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'By match' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'By tournament' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Member' }))
    expect(await screen.findByRole('heading', { name: 'Member' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Create' }))
    expect(await screen.findByRole('heading', { name: 'Create' })).toBeInTheDocument()
  })
})
