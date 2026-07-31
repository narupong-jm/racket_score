import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('renders the initials of the first two words of the name', () => {
    render(<Avatar name="Somchai Jaidee" size={40} />)

    expect(screen.getByRole('img', { name: 'Somchai Jaidee' })).toHaveTextContent('SJ')
  })

  it('renders a single initial for a one-word name', () => {
    render(<Avatar name="Prince" size={40} />)

    expect(screen.getByRole('img', { name: 'Prince' })).toHaveTextContent('P')
  })

  it('ignores extra words beyond the first two', () => {
    render(<Avatar name="Somchai Jaidee Suksan" size={40} />)

    expect(screen.getByRole('img', { name: 'Somchai Jaidee Suksan' })).toHaveTextContent('SJ')
  })
})
