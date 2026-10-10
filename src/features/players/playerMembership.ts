/**
 * Per-sport club membership (Phase 25). A non-null level in a sport IS
 * membership of that sport: a person is a member of Badminton iff
 * `badminton_self_selected_level` is set, and of Tennis iff
 * `tennis_self_selected_level` is set. Pure and framework/DB-free.
 */
import { SPORTS, type Sport } from '../sport/sportTypes'
import type { PlayerLevel } from './playerLevels'
import type { Player } from './playersApi'

export const LEVEL_COLUMN = {
  badminton: 'badminton_self_selected_level',
  tennis: 'tennis_self_selected_level',
} as const satisfies Record<
  Sport,
  'badminton_self_selected_level' | 'tennis_self_selected_level'
>

export function sportLevel(player: Player, sport: Sport): PlayerLevel | null {
  // The DB CHECK constraints guarantee the column holds a PlayerLevel or null.
  return player[LEVEL_COLUMN[sport]] as PlayerLevel | null
}

export function isMemberOfSport(player: Player, sport: Sport): boolean {
  return sportLevel(player, sport) !== null
}

export function otherSport(sport: Sport): Sport {
  return sport === 'badminton' ? 'tennis' : 'badminton'
}

export function membershipSports(player: Player): Sport[] {
  return SPORTS.filter((sport) => isMemberOfSport(player, sport))
}

export function otherSportMembership(
  player: Player,
  activeSport: Sport,
): { sport: Sport; level: PlayerLevel } | null {
  const sport = otherSport(activeSport)
  const level = sportLevel(player, sport)
  return level === null ? null : { sport, level }
}

export function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase()
}

export function findNameConflict(
  players: Player[],
  name: string,
  excludeId?: string,
): Player | null {
  const target = normalizePlayerName(name)
  return (
    players.find(
      (p) => p.id !== excludeId && normalizePlayerName(p.name) === target,
    ) ?? null
  )
}
