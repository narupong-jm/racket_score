export const TOURNAMENT_TYPES = ['singles', 'doubles'] as const

export type TournamentType = (typeof TOURNAMENT_TYPES)[number]
