export const GENDERS = ['male', 'female'] as const
export const PLAYER_LEVELS = ['beginner', 'intermediate', 'advanced', 'pro'] as const

export type Gender = (typeof GENDERS)[number]
export type PlayerLevel = (typeof PLAYER_LEVELS)[number]
