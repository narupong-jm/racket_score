import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useRecordMatchResult } from './useRecordMatchResult'
import { validateGameScore, type GameScoreRules } from './validateGameScore'
import { validateMatchGames, type GameScore } from './validateMatchGames'

interface ResultEntryFormProps {
  tournamentId: string
  matchId: string
  gamesPerMatch: number
  pointsPerGame: number
  winBy: number
  cap: number
}

interface RowState {
  team1: string
  team2: string
}

function emptyRows(count: number): RowState[] {
  return Array.from({ length: count }, () => ({ team1: '', team2: '' }))
}

export function ResultEntryForm({
  tournamentId,
  matchId,
  gamesPerMatch,
  pointsPerGame,
  winBy,
  cap,
}: ResultEntryFormProps) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<RowState[]>(() => emptyRows(gamesPerMatch))
  const recordResult = useRecordMatchResult(tournamentId)

  function updateRow(index: number, field: 'team1' | 'team2', value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const rules: GameScoreRules = { pointsPerGame, winBy, cap }
  const rowErrors: (string | null)[] = []
  const games: GameScore[] = []
  let seenEmpty = false

  for (let i = 0; i < gamesPerMatch; i++) {
    const row = rows[i]
    const t1Empty = row.team1.trim() === ''
    const t2Empty = row.team2.trim() === ''

    if (t1Empty && t2Empty) {
      rowErrors.push(null)
      seenEmpty = true
      continue
    }
    if (seenEmpty) {
      rowErrors.push(t('matches.result.gapError'))
      continue
    }
    if (t1Empty || t2Empty) {
      rowErrors.push(t('matches.result.missingScoreError'))
      continue
    }

    const team1_score = Number(row.team1)
    const team2_score = Number(row.team2)
    if (
      !Number.isInteger(team1_score) ||
      !Number.isInteger(team2_score) ||
      team1_score < 0 ||
      team2_score < 0
    ) {
      rowErrors.push(t('matches.result.invalidNumberError'))
      continue
    }

    if (!validateGameScore(team1_score, team2_score, rules)) {
      rowErrors.push(t('matches.result.ruleViolationError', { pointsPerGame, winBy, cap }))
      continue
    }

    rowErrors.push(null)
    games.push({ team1_score, team2_score })
  }

  const hasRowError = rowErrors.some((e) => e !== null)
  const matchLevelError =
    !hasRowError && games.length > 0 && !validateMatchGames(games, gamesPerMatch)
      ? t('matches.result.notDecidedError')
      : null

  const isValid = !hasRowError && games.length > 0 && matchLevelError === null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValid) return

    recordResult.mutate({
      matchId,
      games: games.map((g, i) => ({
        game_number: i + 1,
        team1_score: g.team1_score,
        team2_score: g.team2_score,
      })),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      {rows.map((row, i) => (
        <div key={i}>
          <label>
            {t('matches.result.gameTeam1Label', { n: i + 1 })}
            <input
              type="number"
              value={row.team1}
              onChange={(event) => updateRow(i, 'team1', event.target.value)}
            />
          </label>
          <label>
            {t('matches.result.gameTeam2Label', { n: i + 1 })}
            <input
              type="number"
              value={row.team2}
              onChange={(event) => updateRow(i, 'team2', event.target.value)}
            />
          </label>
          {rowErrors[i] && <p role="alert">{rowErrors[i]}</p>}
        </div>
      ))}
      {matchLevelError && <p role="alert">{matchLevelError}</p>}
      <button type="submit" disabled={!isValid || recordResult.isPending}>
        {t('matches.result.submit')}
      </button>
    </form>
  )
}
