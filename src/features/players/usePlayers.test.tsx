import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePlayers } from './usePlayers'
import * as playersApi from './playersApi'
import type { Player } from './playersApi'

vi.mock('./playersApi', () => ({
  listPlayers: vi.fn(),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('usePlayers', () => {
  it('goes from loading to success against a mocked client', async () => {
    const mockPlayers: Player[] = [
      {
        id: '1',
        name: 'Mock Player',
        gender: 'male',
        badminton_self_selected_level: 'beginner',
        tennis_self_selected_level: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    vi.mocked(playersApi.listPlayers).mockResolvedValue(mockPlayers)

    const { result } = renderHook(() => usePlayers(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockPlayers)
  })
})
