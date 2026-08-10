import { useContext } from 'react'
import { SportContext, type SportContextValue } from './SportContext'

export function useSport(): SportContextValue {
  const context = useContext(SportContext)
  if (!context) {
    throw new Error('useSport must be used within a SportProvider')
  }
  return context
}
