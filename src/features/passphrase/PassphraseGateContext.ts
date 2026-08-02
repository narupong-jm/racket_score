import { createContext } from 'react'

export interface PassphraseGateContextValue {
  getPassphrase: () => Promise<string>
}

export const PassphraseGateContext = createContext<PassphraseGateContextValue | null>(null)
