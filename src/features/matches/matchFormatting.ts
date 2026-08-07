import type { MatchGame, MatchHistoryEntry } from './matchesApi'

/** Joins the names of every player on the given team, e.g. "Alice & Bob". */
export function teamNames(
  participants: MatchHistoryEntry[],
  team: number,
  playerNameById: Map<string, string>,
): string {
  return participants
    .filter((p) => p.team === team)
    .map((p) => playerNameById.get(p.player_id) ?? p.player_id)
    .join(' & ')
}

/** Tallies games won per side from a match's per-game scores. */
export function summarizeGamesWon(games: MatchGame[]): {
  team1Games: number
  team2Games: number
} {
  let team1Games = 0
  let team2Games = 0
  for (const g of games) {
    if (g.team1_score > g.team2_score) team1Games++
    else if (g.team2_score > g.team1_score) team2Games++
  }
  return { team1Games, team2Games }
}
