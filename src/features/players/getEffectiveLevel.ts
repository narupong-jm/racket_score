import type { PlayerLevel } from './playerLevels'

export interface EffectiveLevelPlayer {
  self_selected_level: PlayerLevel
}

export interface EffectiveLevelStats {
  total_matches: number
  win_rate: number | null
}

export function getEffectiveLevel(
  player: EffectiveLevelPlayer,
  stats: EffectiveLevelStats,
): PlayerLevel {
  if (stats.total_matches < 3) return player.self_selected_level

  const winRate = stats.win_rate ?? 0
  if (winRate >= 75) return 'pro'
  if (winRate >= 50) return 'advanced'
  if (winRate >= 25) return 'intermediate'
  return 'beginner'
}
