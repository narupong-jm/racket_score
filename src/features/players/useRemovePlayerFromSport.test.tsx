import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRemovePlayerFromSport } from './useRemovePlayerFromSport'
import * as playersApi from './playersApi'

vi.mock('./playersApi', () => ({
  removePlayerFromSport: vi.fn(),
}))

vi.mock('../passphrase/usePassphraseGate', () => ({
  usePassphraseGate: () => ({
    getPassphrase: vi.fn().mockResolvedValue('test-passphrase'),
  }),
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useRemovePlayerFromSport', () => {
  it('calls removePlayerFromSport with the passphrase and invalidates players, playerStats and overallScoreboard', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(playersApi.removePlayerFromSport).mockResolvedValue(false)

    const { result } = renderHook(() => useRemovePlayerFromSport(), {
      wrapper: createWrapper(queryClient),
    })
    act(() => {
      result.current.mutate({ id: 'p1', sport: 'badminton' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(playersApi.removePlayerFromSport).toHaveBeenCalledWith(
      'p1',
      'badminton',
      'test-passphrase',
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['players'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['playerStats'] })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['overallScoreboard'],
    })
  })

  it('resolves with the boolean the RPC returns', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.mocked(playersApi.removePlayerFromSport).mockResolvedValue(true)

    const { result } = renderHook(() => useRemovePlayerFromSport(), {
      wrapper: createWrapper(queryClient),
    })
    act(() => {
      result.current.mutate({ id: 'p1', sport: 'tennis' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(true)
  })
})
