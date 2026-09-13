import type { Tables } from '../../lib/database.types'
import { summarizeGamesWon } from './matchFormatting'
import type { MatchGame, MatchHistoryEntry } from './matchesApi'

export type PlayerStats = Tables<'player_stats'>

export interface MatchImpactPreviewEntry {
  playerId: string
  playerName: string
  /** The participant's team (1 or 2) in the match being previewed for deletion. */
  team: number
  /** Whether this participant's team won the match being previewed for deletion. */
  won: boolean
  beforeMatches: number
  beforeWinRate: number | null
  afterMatches: number
  afterWinRate: number | null
}

/** Rounds to 2 decimal places, matching Postgres's `round(x, 2)`. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Previews, for each participant in a match, how their `player_stats` row
 * would change if that match's result were deleted.
 *
 * Reproduces the live `player_stats` view's exact semantics:
 * - A match's winning team is whichever team won more games; a tie (equal
 *   games won, including 0-0) means nobody "won" the match — no participant
 *   of a tied match is credited with a win, on either side. (Deliberately
 *   does NOT reuse `RoundsPlayedList`'s `team1Won = team1Games > team2Games` /
 *   `!team1Won` pair, which silently credits team2 with a win on a tie.)
 * - `win_rate` is on a 0-100 scale rounded to 2 decimals, not the 0-1
 *   fraction `aggregateScoreboard.ts` uses.
 *
 * Pure function: does not read from or write to the database. `games` should
 * be the set of `match_games` rows for the single match being previewed for
 * deletion, and `participants` the `match_participants` rows (as
 * `MatchHistoryEntry`) for that same match.
 */
export function computeMatchImpactPreview(
  participants: MatchHistoryEntry[],
  games: MatchGame[],
  statsByPlayerId: Map<string, PlayerStats>,
  playerNameById: Map<string, string>,
): MatchImpactPreviewEntry[] {
  const { team1Games, team2Games } = summarizeGamesWon(games)
  const winningTeam =
    team1Games > team2Games ? 1 : team2Games > team1Games ? 2 : null

  return participants.map((participant) => {
    const stats = statsByPlayerId.get(participant.player_id)
    const totalMatches = stats?.total_matches ?? 0
    const totalWins = stats?.total_wins ?? 0
    const beforeWinRate = stats?.win_rate ?? null

    const won = winningTeam !== null && participant.team === winningTeam

    const afterMatches = Math.max(0, totalMatches - 1)
    const afterWins = Math.max(0, totalWins - (won ? 1 : 0))
    const afterWinRate =
      afterMatches === 0 ? null : round2((afterWins / afterMatches) * 100)

    return {
      playerId: participant.player_id,
      playerName:
        playerNameById.get(participant.player_id) ?? participant.player_id,
      team: participant.team,
      won,
      beforeMatches: totalMatches,
      beforeWinRate,
      afterMatches,
      afterWinRate,
    }
  })
}
