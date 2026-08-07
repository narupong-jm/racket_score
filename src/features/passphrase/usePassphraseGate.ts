import { useContext } from 'react'
import {
  PassphraseGateContext,
  type PassphraseGateContextValue,
} from './PassphraseGateContext'

export function usePassphraseGate(): PassphraseGateContextValue {
  const context = useContext(PassphraseGateContext)
  if (!context) {
    throw new Error(
      'usePassphraseGate must be used within a PassphraseGateProvider',
    )
  }
  return context
}
