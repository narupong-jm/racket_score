export type Gender = 'male' | 'female'

export type MatchType = 'singles' | 'doubles'

export interface CandidatePlayer {
  id: string
  gender: Gender
  /** Skill estimate on a 0-100 scale (real win rate, or self-selected-category midpoint). */
  skillValue: number
  matchesPlayedInTournament: number
}

/** Canonical "smaller-id|larger-id" key identifying an unordered pair of player ids. */
export type PairKey = string

export interface PairingHistory {
  opponentPairs: Set<PairKey>
  teammatePairs: Set<PairKey>
}
