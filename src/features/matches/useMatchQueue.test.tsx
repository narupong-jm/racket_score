import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useTournamentMatches,
  useStartNextMatch,
  useStartMatchOnCourt,
} from './useMatchQueue'
import { getQueue, setQueue, type QueuedMatch } from '../../lib/matchQueueStore'
import * as matchesApi from './matchesApi'
import type { Match } from './matchesApi'

vi.mock('./matchesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./matchesApi')>()
  return {
    ...actual,
    listMatches: vi.fn(),
    getParticipantsForMatches: vi.fn(),
    listGamesForMatches: vi.fn(),
    createMatch: vi.fn(),
  }
})

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

function makeMatch(id: string, sequenceNumber: number): Match {
  return {
    id,
    tournament_id: 't1',
    sequence_number: sequenceNumber,
    status: 'queued',
    created_at: '2026-01-01T00:00:00Z',
    court_number: null,
    completed_at: null,
    manually_adjusted: true,
  }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useStartNextMatch', () => {
  it('does not resolve until the matches query has refetched, so a caller onSuccess always sees the up-to-date roster', async () => {
    // Regression test for a race where the mutation's own onSuccess fired
    // invalidateQueries without returning/awaiting it, letting the
    // mutate()-call-site onSuccess (which resets the Next-match draw in
    // TournamentDetail, re-enabling Randomize) run against a stale
    // ['matches', tournamentId] cache -- so a player who'd just been
    // promoted into Current wasn't excluded from the very next draw.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = createWrapper(queryClient)

    let listMatchesCallCount = 0
    let resolveRefetch: (() => void) | null = null
    vi.mocked(matchesApi.listMatches).mockImplementation(() => {
      listMatchesCallCount += 1
      // Call 1: initial query mount, resolves immediately with an empty
      // roster. Call 2 is the post-mutation refetch triggered by
      // invalidateQueries -- held pending until the test explicitly releases
      // it, so we can observe mutation/onSuccess ordering relative to it.
      if (listMatchesCallCount < 2) return Promise.resolve([])
      return new Promise<Match[]>((resolve) => {
        resolveRefetch = () => resolve([makeMatch('m-new', 1)])
      })
    })
    vi.mocked(matchesApi.getParticipantsForMatches).mockResolvedValue([
      { match_id: 'm-new', player_id: 'p3', team: 1 },
      { match_id: 'm-new', player_id: 'p2', team: 2 },
    ])
    vi.mocked(matchesApi.listGamesForMatches).mockResolvedValue([])
    vi.mocked(matchesApi.createMatch).mockResolvedValue(makeMatch('m-new', 1))

    const { result: matchesResult } = renderHook(
      () => useTournamentMatches('t1'),
      { wrapper },
    )
    await waitFor(() => expect(matchesResult.current.isSuccess).toBe(true))
    expect(matchesResult.current.data?.matches).toEqual([])

    const { result: startResult } = renderHook(() => useStartNextMatch('t1'), {
      wrapper,
    })

    let refetchWasReleased = false
    let onSuccessSawReleasedRefetch = false

    act(() => {
      startResult.current.mutate(
        {
          participants: [
            { player_id: 'p3', team: 1 },
            { player_id: 'p2', team: 2 },
          ],
          manuallyAdjusted: true,
        },
        {
          onSuccess: () => {
            onSuccessSawReleasedRefetch = refetchWasReleased
          },
        },
      )
    })

    // The mutationFn (createMatch) has run, but the mutation must NOT be
    // "done" yet -- it should still be waiting on the refetch this fix
    // makes it await.
    await waitFor(() => expect(matchesApi.createMatch).toHaveBeenCalled())
    expect(startResult.current.isSuccess).toBe(false)

    refetchWasReleased = true
    resolveRefetch?.()

    await waitFor(() => expect(startResult.current.isSuccess).toBe(true))
    expect(onSuccessSawReleasedRefetch).toBe(true)
    expect(
      queryClient.getQueryData<{ matches: Match[] }>(['matches', 't1'])
        ?.matches,
    ).toEqual([makeMatch('m-new', 1)])
  })
})

describe('useStartMatchOnCourt', () => {
  const entryA: QueuedMatch = {
    participants: [
      { playerId: 'p1', team: 1 },
      { playerId: 'p2', team: 2 },
    ],
    manuallyAdjusted: false,
  }
  const entryB: QueuedMatch = {
    participants: [
      { playerId: 'p3', team: 1 },
      { playerId: 'p4', team: 2 },
    ],
    manuallyAdjusted: true,
  }

  it('calls createMatch with the court, shifts the queue head and invalidates matches + drawInputs', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(matchesApi.createMatch).mockResolvedValue(makeMatch('m-new', 1))
    setQueue('t1', [entryA, entryB])

    const { result } = renderHook(() => useStartMatchOnCourt('t1'), {
      wrapper: createWrapper(queryClient),
    })
    act(() => {
      result.current.mutate({
        participants: [
          { player_id: 'p1', team: 1 },
          { player_id: 'p2', team: 2 },
        ],
        manuallyAdjusted: true,
        courtNumber: 2,
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(matchesApi.createMatch).toHaveBeenCalledWith(
      't1',
      2,
      [
        { player_id: 'p1', team: 1 },
        { player_id: 'p2', team: 2 },
      ],
      'test-passphrase',
      true,
    )
    expect(getQueue('t1')).toEqual([entryB])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['matches', 't1'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['drawInputs', 't1'] })
  })

  it('defaults manuallyAdjusted to false', async () => {
    const queryClient = new QueryClient()
    vi.mocked(matchesApi.createMatch).mockResolvedValue(makeMatch('m-new', 1))
    const { result } = renderHook(() => useStartMatchOnCourt('t1'), {
      wrapper: createWrapper(queryClient),
    })
    act(() => {
      result.current.mutate({
        participants: [{ player_id: 'p1', team: 1 }],
        courtNumber: 1,
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(matchesApi.createMatch).toHaveBeenCalledWith(
      't1',
      1,
      [{ player_id: 'p1', team: 1 }],
      'test-passphrase',
      false,
    )
  })

  it('leaves the queue untouched when createMatch fails', async () => {
    const queryClient = new QueryClient()
    vi.mocked(matchesApi.createMatch).mockRejectedValue(new Error('boom'))
    setQueue('t1', [entryA, entryB])

    const { result } = renderHook(() => useStartMatchOnCourt('t1'), {
      wrapper: createWrapper(queryClient),
    })
    act(() => {
      result.current.mutate({
        participants: [{ player_id: 'p1', team: 1 }],
        courtNumber: 1,
      })
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getQueue('t1')).toEqual([entryA, entryB])
  })
})
