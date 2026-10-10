import { describe, expect, it } from 'vitest'
import { PLAYER_LEVELS } from './playerLevels'
import type { Player } from './playersApi'
import {
  LEVEL_COLUMN,
  findNameConflict,
  isMemberOfSport,
  membershipSports,
  normalizePlayerName,
  otherSport,
  otherSportMembership,
  sportLevel,
} from './playerMembership'

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Nim',
    gender: 'female',
    badminton_self_selected_level: null,
    tennis_self_selected_level: null,
    ...overrides,
  } as Player
}

const badmintonOnly = makePlayer({ badminton_self_selected_level: 'advanced' })
const tennisOnly = makePlayer({ tennis_self_selected_level: 'beginner' })
const both = makePlayer({
  badminton_self_selected_level: 'pro',
  tennis_self_selected_level: 'intermediate',
})
const neither = makePlayer()

describe('LEVEL_COLUMN', () => {
  it('maps each sport to its level column', () => {
    expect(LEVEL_COLUMN.badminton).toBe('badminton_self_selected_level')
    expect(LEVEL_COLUMN.tennis).toBe('tennis_self_selected_level')
  })
})

describe('sportLevel', () => {
  it('returns the level for the requested sport', () => {
    expect(sportLevel(both, 'badminton')).toBe('pro')
    expect(sportLevel(both, 'tennis')).toBe('intermediate')
  })
  it('returns null for a sport the player is not in', () => {
    expect(sportLevel(badmintonOnly, 'tennis')).toBeNull()
    expect(sportLevel(tennisOnly, 'badminton')).toBeNull()
    expect(sportLevel(neither, 'badminton')).toBeNull()
  })
})

describe('isMemberOfSport', () => {
  it('is false for a null level', () => {
    expect(isMemberOfSport(neither, 'badminton')).toBe(false)
    expect(isMemberOfSport(neither, 'tennis')).toBe(false)
  })
  it.each(PLAYER_LEVELS)('is true for level %s', (level) => {
    expect(
      isMemberOfSport(
        makePlayer({ badminton_self_selected_level: level }),
        'badminton',
      ),
    ).toBe(true)
    expect(
      isMemberOfSport(
        makePlayer({ tennis_self_selected_level: level }),
        'tennis',
      ),
    ).toBe(true)
  })
  it('is per sport', () => {
    expect(isMemberOfSport(badmintonOnly, 'badminton')).toBe(true)
    expect(isMemberOfSport(badmintonOnly, 'tennis')).toBe(false)
    expect(isMemberOfSport(tennisOnly, 'tennis')).toBe(true)
    expect(isMemberOfSport(tennisOnly, 'badminton')).toBe(false)
    expect(isMemberOfSport(both, 'badminton')).toBe(true)
    expect(isMemberOfSport(both, 'tennis')).toBe(true)
  })
})

describe('otherSport', () => {
  it('flips in both directions', () => {
    expect(otherSport('badminton')).toBe('tennis')
    expect(otherSport('tennis')).toBe('badminton')
  })
})

describe('membershipSports', () => {
  it('lists sports the player is in, in SPORTS order', () => {
    expect(membershipSports(badmintonOnly)).toEqual(['badminton'])
    expect(membershipSports(tennisOnly)).toEqual(['tennis'])
    expect(membershipSports(both)).toEqual(['badminton', 'tennis'])
  })
  it('returns [] for a player in neither sport', () => {
    expect(membershipSports(neither)).toEqual([])
  })
})

describe('otherSportMembership', () => {
  it("returns the other sport's level", () => {
    expect(otherSportMembership(both, 'badminton')).toEqual({
      sport: 'tennis',
      level: 'intermediate',
    })
    expect(otherSportMembership(both, 'tennis')).toEqual({
      sport: 'badminton',
      level: 'pro',
    })
    expect(otherSportMembership(tennisOnly, 'badminton')).toEqual({
      sport: 'tennis',
      level: 'beginner',
    })
  })
  it('returns null when the player is not in the other sport', () => {
    expect(otherSportMembership(badmintonOnly, 'badminton')).toBeNull()
    expect(otherSportMembership(tennisOnly, 'tennis')).toBeNull()
    expect(otherSportMembership(neither, 'badminton')).toBeNull()
  })
})

describe('normalizePlayerName', () => {
  it('trims and lowercases', () => {
    expect(normalizePlayerName('  NiM \t')).toBe('nim')
  })
  it('does not collapse internal whitespace', () => {
    expect(normalizePlayerName('Ann  Lee')).toBe('ann  lee')
  })
})

describe('findNameConflict', () => {
  const nim = makePlayer({ id: 'a', name: 'Nim' })
  const bob = makePlayer({ id: 'b', name: 'Bob' })
  const players = [nim, bob]

  it('matches case-insensitively and ignoring surrounding whitespace', () => {
    expect(findNameConflict(players, '  nIM ')).toBe(nim)
    expect(findNameConflict(players, 'BOB')).toBe(bob)
  })
  it('returns null for a free name', () => {
    expect(findNameConflict(players, 'Cat')).toBeNull()
    expect(findNameConflict([], 'Nim')).toBeNull()
  })
  it('skips the excluded id', () => {
    expect(findNameConflict(players, 'nim', 'a')).toBeNull()
    expect(findNameConflict(players, 'nim', 'b')).toBe(nim)
  })
  it('returns the first conflicting player', () => {
    const dup = makePlayer({ id: 'c', name: 'NIM' })
    expect(findNameConflict([nim, dup], 'nim')).toBe(nim)
    expect(findNameConflict([nim, dup], 'nim', 'a')).toBe(dup)
  })
})
