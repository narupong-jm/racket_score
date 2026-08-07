export interface GameScore {
  team1_score: number
  team2_score: number
}

/**
 * Validates that a set of games (in play order) is a complete, non-extended
 * best-of-`gamesPerMatch` outcome: the match must be decided (one team
 * reaches the majority of games) on exactly the last game provided --
 * neither earlier (under-decided) nor later (extra games after the match
 * was already won).
 */
export function validateMatchGames(
  games: GameScore[],
  gamesPerMatch: number,
): boolean {
  if (games.length === 0 || games.length > gamesPerMatch) return false

  const majority = Math.floor(gamesPerMatch / 2) + 1

  let team1Wins = 0
  let team2Wins = 0

  for (let i = 0; i < games.length; i++) {
    const { team1_score, team2_score } = games[i]

    if (team1_score > team2_score) team1Wins++
    else if (team2_score > team1_score) team2Wins++
    else return false // a tied game score is never a valid completed game

    const isLastGame = i === games.length - 1
    const decided = team1Wins >= majority || team2Wins >= majority

    if (decided && !isLastGame) return false // match was already won before this game
    if (!decided && isLastGame) return false // not yet decided by the last game provided
  }

  return true
}
