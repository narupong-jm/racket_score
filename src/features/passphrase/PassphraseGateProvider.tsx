import { useCallback, useRef, useState, type ReactNode } from 'react'
import { PassphraseModal } from '../../components/PassphraseModal'
import {
  getCachedPassphrase,
  setCachedPassphrase,
} from '../../lib/passphraseStore'
import { PassphraseGateContext } from './PassphraseGateContext'
import { verifyWritePassphrase } from './passphraseApi'

interface PendingRequest {
  resolve: (passphrase: string) => void
  reject: (reason: Error) => void
}

export function PassphraseGateProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const pendingRef = useRef<PendingRequest | null>(null)

  const getPassphrase = useCallback((): Promise<string> => {
    const cached = getCachedPassphrase()
    if (cached) return Promise.resolve(cached)

    return new Promise<string>((resolve, reject) => {
      pendingRef.current = { resolve, reject }
      setInvalid(false)
      setIsOpen(true)
    })
  }, [])

  async function handleSubmit(passphrase: string) {
    setSubmitting(true)
    try {
      await verifyWritePassphrase(passphrase)
      setCachedPassphrase(passphrase)
      setIsOpen(false)
      pendingRef.current?.resolve(passphrase)
      pendingRef.current = null
    } catch {
      setInvalid(true)
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    setIsOpen(false)
    pendingRef.current?.reject(new Error('passphrase_cancelled'))
    pendingRef.current = null
  }

  return (
    <PassphraseGateContext.Provider value={{ getPassphrase }}>
      {children}
      <PassphraseModal
        open={isOpen}
        invalid={invalid}
        submitting={submitting}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </PassphraseGateContext.Provider>
  )
}
