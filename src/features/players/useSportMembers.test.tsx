import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSportMembers, useNonSportMembers } from './useSportMembers'
import * as playersApi from './playersApi'
import type { Player } from './playersApi'

vi.mock('./playersApi', () => ({
  listPlayers: vi.fn(),
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function makePlayer(
  id: string,
  badminton: Player['badminton_self_selected_level'],
  tennis: Player['tennis_self_selected_level'],
): Player {
  return {
    id,
    name: `Player ${id}`,
    gender: 'male',
    badminton_self_selected_level: badminton,
    tennis_self_selected_level: tennis,
    created_at: '2026-01-01T00:00:00Z',
  }
}

const badmintonOnly = makePlayer('1', 'beginner', null)
const tennisOnly = makePlayer('2', null, 'intermediate')
const both = makePlayer('3', 'advanced', 'beginner')

describe('useSportMembers / useNonSportMembers', () => {
  it('useSportMembers returns only members of the given sport', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      badmintonOnly,
      tennisOnly,
      both,
    ])

    const { result } = renderHook(() => useSportMembers('badminton'), {
      wrapper: createWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([badmintonOnly, both])
  })

  it('useNonSportMembers returns the exact complement', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      badmintonOnly,
      tennisOnly,
      both,
    ])

    const { result } = renderHook(() => useNonSportMembers('badminton'), {
      wrapper: createWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([tennisOnly])
  })

  it('shares one ["players"] cache entry between the two hooks', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      badmintonOnly,
      tennisOnly,
      both,
    ])

    const { result: members } = renderHook(() => useSportMembers('tennis'), {
      wrapper: createWrapper(queryClient),
    })
    const { result: nonMembers } = renderHook(
      () => useNonSportMembers('tennis'),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => expect(members.current.isSuccess).toBe(true))
    await waitFor(() => expect(nonMembers.current.isSuccess).toBe(true))

    // Both hooks read the same underlying ["players"] query: exactly one
    // cache entry exists for it, not one per hook/select.
    expect(
      queryClient.getQueryCache().findAll({ queryKey: ['players'] }),
    ).toHaveLength(1)
  })

  it('keeps a stable selected-array identity across a re-render with the same sport', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.mocked(playersApi.listPlayers).mockResolvedValue([
      badmintonOnly,
      tennisOnly,
      both,
    ])

    const { result, rerender } = renderHook(
      ({ sport }: { sport: 'badminton' | 'tennis' }) => useSportMembers(sport),
      {
        wrapper: createWrapper(queryClient),
        initialProps: { sport: 'badminton' },
      },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const firstData = result.current.data

    rerender({ sport: 'badminton' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(firstData)
  })
})
