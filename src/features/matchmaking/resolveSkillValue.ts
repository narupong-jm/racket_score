export type SelfSelectedLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro'

const SELF_SELECTED_MIDPOINT: Record<SelfSelectedLevel, number> = {
  beginner: 12.5,
  intermediate: 37.5,
  advanced: 62.5,
  pro: 87.5,
}

export interface ResolveSkillValueInput {
  selfSelectedLevel: SelfSelectedLevel
  /** Lifetime (cross-tournament) match count. */
  totalMatches: number
  /** Lifetime win rate, 0-100. Ignored below the 3-match threshold. */
  winRate: number | null
}

export function resolveSkillValue(player: ResolveSkillValueInput): number {
  if (player.totalMatches >= 3) {
    return player.winRate ?? 0
  }
  return SELF_SELECTED_MIDPOINT[player.selfSelectedLevel]
}
