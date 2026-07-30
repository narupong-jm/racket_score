import type { PairKey } from './types'

/** Builds a canonical, order-independent key identifying an unordered pair of player ids. */
export function canonicalPairKey(id1: string, id2: string): PairKey {
  return id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`
}
