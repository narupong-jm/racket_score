import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PassphraseGateProvider } from './PassphraseGateProvider'
import { usePassphraseGate } from './usePassphraseGate'
import * as passphraseApi from './passphraseApi'
import * as passphraseStore from '../../lib/passphraseStore'

vi.mock('./passphraseApi', () => ({
  verifyWritePassphrase: vi.fn(),
}))

vi.mock('../../lib/passphraseStore', () => ({
  getCachedPassphrase: vi.fn(),
  setCachedPassphrase: vi.fn(),
  clearCachedPassphrase: vi.fn(),
}))

function TestConsumer() {
  const { getPassphrase } = usePassphraseGate()
  const [result, setResult] = useState<string | null>(null)

  return (
    <div>
      <button onClick={() => getPassphrase().then(setResult)}>
        Trigger write
      </button>
      <p>result: {result ?? 'none'}</p>
    </div>
  )
}

describe('PassphraseGateProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(passphraseStore.getCachedPassphrase).mockReturnValue(null)
  })

  it('resolves immediately with a cached passphrase, without opening the modal', async () => {
    vi.mocked(passphraseStore.getCachedPassphrase).mockReturnValue(
      'cached-secret',
    )
    const user = userEvent.setup()

    render(
      <PassphraseGateProvider>
        <TestConsumer />
      </PassphraseGateProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Trigger write' }))

    await waitFor(() =>
      expect(screen.getByText('result: cached-secret')).toBeInTheDocument(),
    )
    expect(screen.queryByLabelText('Passphrase')).not.toBeInTheDocument()
    expect(passphraseApi.verifyWritePassphrase).not.toHaveBeenCalled()
  })

  it('opens the modal and resolves only after a successful verify call', async () => {
    vi.mocked(passphraseApi.verifyWritePassphrase).mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <PassphraseGateProvider>
        <TestConsumer />
      </PassphraseGateProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Trigger write' }))

    const input = await screen.findByLabelText('Passphrase')
    await user.type(input, 'right-secret')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() =>
      expect(screen.getByText('result: right-secret')).toBeInTheDocument(),
    )
    expect(passphraseApi.verifyWritePassphrase).toHaveBeenCalledWith(
      'right-secret',
    )
    expect(passphraseStore.setCachedPassphrase).toHaveBeenCalledWith(
      'right-secret',
    )
    expect(screen.queryByLabelText('Passphrase')).not.toBeInTheDocument()
  })

  it('shows an inline error and keeps the modal open on a failed verify call', async () => {
    vi.mocked(passphraseApi.verifyWritePassphrase).mockRejectedValueOnce(
      new Error('invalid_passphrase'),
    )
    const user = userEvent.setup()

    render(
      <PassphraseGateProvider>
        <TestConsumer />
      </PassphraseGateProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Trigger write' }))
    const input = await screen.findByLabelText('Passphrase')
    await user.type(input, 'wrong-secret')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByLabelText('Passphrase')).toBeInTheDocument()
    expect(passphraseStore.setCachedPassphrase).not.toHaveBeenCalled()
    expect(screen.getByText('result: none')).toBeInTheDocument()
  })
})
