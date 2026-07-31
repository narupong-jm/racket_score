import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders its content when open', () => {
    render(
      <Modal open onClose={() => {}}>
        <p>Modal content</p>
      </Modal>,
    )

    expect(screen.getByText('Modal content')).toBeInTheDocument()
  })

  it('renders nothing when not open', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>,
    )

    expect(screen.queryByText('Modal content')).not.toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Modal open onClose={onClose}>
        <p>Modal content</p>
      </Modal>,
    )

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
