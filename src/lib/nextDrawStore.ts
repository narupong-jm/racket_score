import type { GeneratedMatchParticipant } from '../features/matchmaking/generateNextMatch'

function storageKey(tournamentId: string): string {
  return `racket-score.nextDraw.${tournamentId}`
}

export function getCachedNextDraw(
  tournamentId: string,
): GeneratedMatchParticipant[] | null {
  const raw = localStorage.getItem(storageKey(tournamentId))
  if (!raw) return null
  return JSON.parse(raw) as GeneratedMatchParticipant[]
}

export function setCachedNextDraw(
  tournamentId: string,
  draw: GeneratedMatchParticipant[],
): void {
  localStorage.setItem(storageKey(tournamentId), JSON.stringify(draw))
}

export function clearCachedNextDraw(tournamentId: string): void {
  localStorage.removeItem(storageKey(tournamentId))
}
