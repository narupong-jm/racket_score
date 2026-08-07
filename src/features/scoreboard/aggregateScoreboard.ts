import type { Player } from '../players/playersApi'
import type { PlayerMatchHistoryRow } from './scoreboardApi'

export interface PlayerScoreboardEntry {
  player_id: string
  name: string
  matches_played: number
  matches_won: number
  total_points: number
  win_rate: number | null
}

export function aggregateScoreboard(
  rows: PlayerMatchHistoryRow[],
  players: Player[],
): PlayerScoreboardEntry[] {
  const rowsByPlayer = new Map<string, PlayerMatchHistoryRow[]>()
  for (const row of rows) {
    if (!row.player_id) continue
    const existing = rowsByPlayer.get(row.player_id)
    if (existing) existing.push(row)
    else rowsByPlayer.set(row.player_id, [row])
  }

  return players.map((player) => {
    const playerRows = rowsByPlayer.get(player.id) ?? []
    const matchesPlayed = playerRows.length
    const matchesWon = playerRows.filter((row) => row.won).length
    const totalPoints = playerRows.reduce(
      (sum, row) => sum + (row.points_for ?? 0),
      0,
    )

    return {
      player_id: player.id,
      name: player.name,
      matches_played: matchesPlayed,
      matches_won: matchesWon,
      total_points: totalPoints,
      win_rate: matchesPlayed === 0 ? null : matchesWon / matchesPlayed,
    }
  })
}
