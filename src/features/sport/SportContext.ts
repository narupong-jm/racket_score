import { createContext } from 'react'
import type { Sport } from './sportTypes'

export interface SportContextValue {
  sport: Sport | null
  setSport: (sport: Sport) => void
}

export const SportContext = createContext<SportContextValue | null>(null)
