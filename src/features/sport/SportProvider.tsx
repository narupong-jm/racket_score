import { useState, type ReactNode } from 'react'
import { SportContext } from './SportContext'
import type { Sport } from './sportTypes'
import { getCachedSport, setCachedSport } from '../../lib/sportStore'

export function SportProvider({ children }: { children: ReactNode }) {
  const [sport, setSportState] = useState<Sport | null>(() => getCachedSport())

  function setSport(next: Sport) {
    setCachedSport(next)
    setSportState(next)
  }

  return (
    <SportContext.Provider value={{ sport, setSport }}>
      {children}
    </SportContext.Provider>
  )
}
