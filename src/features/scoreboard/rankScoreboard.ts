export interface RankableEntry {
  playerId: string
  winRate: number | null
  totalPoints: number
}

/**
 * Sorts by win rate (desc, null treated as -1 so 0-match players sort
 * last), then total points scored (desc), with player id (asc) purely as a
 * stable, deterministic array order for otherwise-fully-tied entries -- it
 * does not affect the displayed rank. Displayed rank follows standard
 * competition ranking (1, 1, 3): tied entries share a rank number, and the
 * next distinct entry's rank equals its 1-based position, not a dense
 * count. Used identically by the per-tournament and Overall scoreboards.
 */
export function rankScoreboard<T extends RankableEntry>(entries: T[]): (T & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => {
    const rateDiff = (b.winRate ?? -1) - (a.winRate ?? -1)
    if (rateDiff !== 0) return rateDiff

    const pointsDiff = b.totalPoints - a.totalPoints
    if (pointsDiff !== 0) return pointsDiff

    return a.playerId.localeCompare(b.playerId)
  })

  const ranked: (T & { rank: number })[] = []
  sorted.forEach((entry, index) => {
    const previous = ranked[index - 1]
    const tiedWithPrevious =
      previous !== undefined &&
      (previous.winRate ?? -1) === (entry.winRate ?? -1) &&
      previous.totalPoints === entry.totalPoints
    ranked.push({ ...entry, rank: tiedWithPrevious ? previous.rank : index + 1 })
  })
  return ranked
}
