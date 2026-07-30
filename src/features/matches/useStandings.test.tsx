import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useStandings } from './useStandings'
import * as matchesApi from './matchesApi'

vi.mock('./matchesApi', () => ({
  getStandings: vi.fn(),
}))

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('useStandings polling', () => {
  it('refetches automatically after the 30s poll interval elapses', async () => {
    vi.mocked(matchesApi.getStandings).mockResolvedValue([])

    renderHook(() => useStandings('t1'), { wrapper: createWrapper() })

    await vi.advanceTimersByTimeAsync(0) // let the initial fetch settle
    expect(matchesApi.getStandings).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(matchesApi.getStandings).toHaveBeenCalledTimes(2)
  })

  it('does not refetch before the poll interval has elapsed', async () => {
    vi.mocked(matchesApi.getStandings).mockResolvedValue([])

    renderHook(() => useStandings('t1'), { wrapper: createWrapper() })

    await vi.advanceTimersByTimeAsync(0)
    expect(matchesApi.getStandings).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(29_000)
    expect(matchesApi.getStandings).toHaveBeenCalledTimes(1)
  })
})
