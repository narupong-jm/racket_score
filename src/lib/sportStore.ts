import type { Sport } from '../features/sport/sportTypes'

const STORAGE_KEY = 'racket-score.selectedSport'

export function getCachedSport(): Sport | null {
  return localStorage.getItem(STORAGE_KEY) as Sport | null
}

export function setCachedSport(sport: Sport): void {
  localStorage.setItem(STORAGE_KEY, sport)
}
