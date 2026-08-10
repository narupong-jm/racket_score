import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from './HomePage'
import * as useSportModule from '../features/sport/useSport'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../features/sport/useSport', () => ({
  useSport: vi.fn(),
}))

describe('HomePage', () => {
  it('renders both sport options with correct labels', () => {
    vi.mocked(useSportModule.useSport).mockReturnValue({
      sport: null,
      setSport: vi.fn(),
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('button', { name: 'Badminton' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tennis' })).toBeInTheDocument()
  })

  it('selecting Tennis calls setSport then navigates to /create', async () => {
    const setSport = vi.fn()
    vi.mocked(useSportModule.useSport).mockReturnValue({
      sport: null,
      setSport,
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Tennis' }))

    expect(setSport).toHaveBeenCalledWith('tennis')
    expect(navigateMock).toHaveBeenCalledWith('/create', { replace: true })
  })
})
