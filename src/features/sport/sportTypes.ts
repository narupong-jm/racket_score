export const SPORTS = ['badminton', 'tennis'] as const

export type Sport = (typeof SPORTS)[number]
