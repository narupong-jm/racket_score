import type { TournamentStanding } from '../matches/matchesApi'

/**
 * Sorts standings by win rate (desc, null treated as -1 so 0-match players
 * sort last), then point differential (desc), then player id (asc) as a
 * stable tiebreak -- so fully-tied players keep a fixed, deterministic order
 * instead of flickering between refreshes.
 */
export function sortScoreboard(standings: TournamentStanding[]): TournamentStanding[] {
  return [...standings].sort((a, b) => {
    const winRateDiff = (b.win_rate ?? -1) - (a.win_rate ?? -1)
    if (winRateDiff !== 0) return winRateDiff

    const pointDiffDiff = (b.point_diff ?? 0) - (a.point_diff ?? 0)
    if (pointDiffDiff !== 0) return pointDiffDiff

    return (a.player_id ?? '').localeCompare(b.player_id ?? '')
  })
}
