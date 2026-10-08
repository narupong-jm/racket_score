import type { TFunction } from 'i18next'
import type { MatchGame, MatchHistoryEntry } from './matchesApi'

/**
 * Label for a completed match on the Manage screen: "Match 3 · Court 2" on a
 * multi-court tournament, plain "Match 3" on a single-court one.
 */
export function formatMatchLabel(
  t: TFunction,
  match: { sequence_number: number; court_number: number | null },
  courtCount: number,
): string {
  if (courtCount > 1) {
    return t('manage.matchLabelCourt', {
      n: match.sequence_number,
      court: match.court_number ?? 1,
    })
  }
  return t('manage.matchLabel', { n: match.sequence_number })
}

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
