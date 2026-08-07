import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTournamentMatches, useStartNextMatch } from './useMatchQueue'
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
    completed_at: null,
    manually_adjusted: true,
  }
}

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
      // Call 1: initial query mount. Call 2: inside useStartNextMatch's
      // mutationFn (computing the next sequence number). Both resolve
      // immediately with an empty roster. Call 3 is the post-mutation
      // refetch triggered by invalidateQueries -- held pending until the
      // test explicitly releases it, so we can observe mutation/onSuccess
      // ordering relative to it.
      if (listMatchesCallCount < 3) return Promise.resolve([])
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
