import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SportProvider } from './SportProvider'
import { useSport } from './useSport'

function TestConsumer() {
  const { sport, setSport } = useSport()
  return (
    <div>
      <p>sport: {sport ?? 'none'}</p>
      <button onClick={() => setSport('tennis')}>Choose tennis</button>
    </div>
  )
}

describe('SportProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with sport: null when nothing is cached', () => {
    render(
      <SportProvider>
        <TestConsumer />
      </SportProvider>,
    )
    expect(screen.getByText('sport: none')).toBeInTheDocument()
  })

  it('initializes from a pre-seeded localStorage value', () => {
    localStorage.setItem('racket-score.selectedSport', 'badminton')
    render(
      <SportProvider>
        <TestConsumer />
      </SportProvider>,
    )
    expect(screen.getByText('sport: badminton')).toBeInTheDocument()
  })

  it('setSport updates the context value and persists to localStorage', async () => {
    const user = userEvent.setup()
    render(
      <SportProvider>
        <TestConsumer />
      </SportProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Choose tennis' }))

    expect(screen.getByText('sport: tennis')).toBeInTheDocument()
    expect(localStorage.getItem('racket-score.selectedSport')).toBe('tennis')
  })
})

describe('useSport', () => {
  it('throws when used outside a SportProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow(
      'useSport must be used within a SportProvider',
    )
    consoleError.mockRestore()
  })
})
