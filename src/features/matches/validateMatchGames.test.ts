import { describe, expect, it } from 'vitest'
import { validateMatchGames } from './validateMatchGames'

function game(team1_score: number, team2_score: number) {
  return { team1_score, team2_score }
}

describe('validateMatchGames', () => {
  it('accepts a match decided in the minimum number of games (2-0 sweep of a best-of-3)', () => {
    expect(validateMatchGames([game(21, 15), game(21, 18)], 3)).toBe(true)
  })

  it('accepts a match decided with the full game count (2-1 of a best-of-3)', () => {
    expect(validateMatchGames([game(21, 15), game(18, 21), game(21, 19)], 3)).toBe(true)
  })

  it('rejects an under-decided match (1-1 submitted as the whole match)', () => {
    expect(validateMatchGames([game(21, 15), game(18, 21)], 3)).toBe(false)
  })

  it('rejects extra games submitted after the match was already decided (2-0 then a 3rd game)', () => {
    expect(
      validateMatchGames([game(21, 15), game(21, 18), game(15, 21)], 3),
    ).toBe(false)
  })

  it('rejects more games than gamesPerMatch allows', () => {
    expect(
      validateMatchGames([game(21, 15), game(15, 21), game(21, 15), game(15, 21)], 3),
    ).toBe(false)
  })

  it('rejects an empty game list', () => {
    expect(validateMatchGames([], 3)).toBe(false)
  })

  it('rejects a tied game score', () => {
    expect(validateMatchGames([game(20, 20)], 1)).toBe(false)
  })

  it('handles best-of-1', () => {
    expect(validateMatchGames([game(21, 15)], 1)).toBe(true)
  })

  it('handles best-of-5', () => {
    expect(
      validateMatchGames(
        [game(21, 15), game(18, 21), game(21, 19), game(15, 21), game(21, 17)],
        5,
      ),
    ).toBe(true) // decided 3-2 on the 5th game
    expect(
      validateMatchGames([game(21, 15), game(18, 21), game(21, 19)], 5),
    ).toBe(false) // only 2-1, not yet decided within a best-of-5
  })
})
