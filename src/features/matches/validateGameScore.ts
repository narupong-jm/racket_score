export interface GameScoreRules {
  pointsPerGame: number
  winBy: number
  cap: number
}

/**
 * Validates a single completed game's score against the tournament's scoring
 * rules: must reach the target with the required win-by margin, or -- once
 * play is extended into deuce -- win by exactly that margin, or reach the
 * hard cap outright (which overrides the win-by margin requirement).
 */
export function validateGameScore(
  score1: number,
  score2: number,
  { pointsPerGame, winBy, cap }: GameScoreRules,
): boolean {
  if (score1 < 0 || score2 < 0) return false
  if (score1 === score2) return false

  const max = Math.max(score1, score2)
  const min = Math.min(score1, score2)
  const margin = max - min

  if (max > cap) return false
  if (max < pointsPerGame) return false
  if (max === cap) return true
  if (max === pointsPerGame) return margin >= winBy

  // pointsPerGame < max < cap: play only stops the instant the win-by margin
  // is met, so a wider margin here would have ended the game earlier.
  return margin === winBy
}
