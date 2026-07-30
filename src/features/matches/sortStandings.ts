import type { TournamentStanding } from './matchesApi'

/**
 * Sorts standings by games won (desc), then point differential (desc), then
 * player id (asc) as a stable tiebreak -- so fully-tied players keep a fixed,
 * deterministic order instead of flickering between refreshes.
 */
export function sortStandings(standings: TournamentStanding[]): TournamentStanding[] {
  return [...standings].sort((a, b) => {
    const gamesWonDiff = (b.games_won ?? 0) - (a.games_won ?? 0)
    if (gamesWonDiff !== 0) return gamesWonDiff

    const pointDiffDiff = (b.point_diff ?? 0) - (a.point_diff ?? 0)
    if (pointDiffDiff !== 0) return pointDiffDiff

    return (a.player_id ?? '').localeCompare(b.player_id ?? '')
  })
}
