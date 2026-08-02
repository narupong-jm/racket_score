import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PassphraseModal } from './PassphraseModal'

describe('PassphraseModal', () => {
  it('calls onSubmit with the typed passphrase', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <PassphraseModal open invalid={false} submitting={false} onSubmit={onSubmit} onCancel={() => {}} />,
    )

    await user.type(screen.getByLabelText('Passphrase'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledWith('secret')
  })

  it('shows the inline error and keeps the field visible when invalid', () => {
    render(
      <PassphraseModal open invalid submitting={false} onSubmit={() => {}} onCancel={() => {}} />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect passphrase. Try again.')
    expect(screen.getByLabelText('Passphrase')).toBeInTheDocument()
  })

  it('calls onCancel when the close button is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <PassphraseModal open invalid={false} submitting={false} onSubmit={() => {}} onCancel={onCancel} />,
    )

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when the Cancel button is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <PassphraseModal open invalid={false} submitting={false} onSubmit={() => {}} onCancel={onCancel} />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('disables the submit button while submitting', () => {
    render(
      <PassphraseModal open invalid={false} submitting onSubmit={() => {}} onCancel={() => {}} />,
    )

    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })

  it('disables the submit button until something is typed', () => {
    render(
      <PassphraseModal open invalid={false} submitting={false} onSubmit={() => {}} onCancel={() => {}} />,
    )

    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })

  it('renders nothing when not open', () => {
    render(
      <PassphraseModal open={false} invalid={false} submitting={false} onSubmit={() => {}} onCancel={() => {}} />,
    )

    expect(screen.queryByLabelText('Passphrase')).not.toBeInTheDocument()
  })
})
