import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from '@tanstack/react-query'
import { useRecordMatchResult } from './useRecordMatchResult'
import * as matchesApi from './matchesApi'

vi.mock('./matchesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./matchesApi')>()
  return { ...actual, recordMatchResult: vi.fn() }
})

vi.mock('../passphrase/usePassphraseGate', () => ({
  usePassphraseGate: () => ({
    getPassphrase: vi.fn().mockResolvedValue('test-passphrase'),
  }),
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('useRecordMatchResult', () => {
  it('does not settle until the matches and drawInputs refetches finish', async () => {
    vi.mocked(matchesApi.recordMatchResult).mockResolvedValue(undefined)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    let gate: Promise<void> = Promise.resolve()
    let releaseRefetch: () => void = () => {}
    const queryFn = async () => {
      await gate
      return []
    }
    // Active observers so invalidateQueries really refetches.
    const unsubscribes = [
      new QueryObserver(queryClient, {
        queryKey: ['matches', 't1'],
        queryFn,
      }).subscribe(() => {}),
      new QueryObserver(queryClient, {
        queryKey: ['drawInputs', 't1'],
        queryFn,
      }).subscribe(() => {}),
    ]
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    // From now on every refetch blocks until released.
    gate = new Promise<void>((resolve) => {
      releaseRefetch = resolve
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useRecordMatchResult('t1'), { wrapper })

    let settled = false
    let pending: Promise<unknown> = Promise.resolve()
    await act(async () => {
      pending = result.current
        .mutateAsync({ matchId: 'm1', games: [] })
        .then(() => {
          settled = true
        })
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(settled).toBe(false)

    await act(async () => {
      releaseRefetch()
      await pending
    })
    expect(settled).toBe(true)
    unsubscribes.forEach((u) => u())
  })
})
