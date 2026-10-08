import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import { useRecordMatchResult } from '../matches/useRecordMatchResult'
import {
  validateGameScore,
  type GameScoreRules,
} from '../matches/validateGameScore'
import {
  validateMatchGames,
  type GameScore,
} from '../matches/validateMatchGames'

export interface ScoringRules {
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

interface CourtMatchFormProps {
  tournamentId: string
  matchId: string
  team1Name: string
  team2Name: string
  scoring: ScoringRules
  /** Save result needs a queued match ready for the freed court (SPEC §6). */
  queueHasMatch: boolean
}

/**
 * One in-progress court's score entry: per-game inputs, validation, the
 * "Is last match" bypass and the confirm-before-save dialog. Key it by match
 * id so a newly started match gets fresh inputs.
 */
export function CourtMatchForm({
  tournamentId,
  matchId,
  team1Name,
  team2Name,
  scoring,
  queueHasMatch,
}: CourtMatchFormProps) {
  const { t } = useTranslation()
  const { gamesPerMatch, pointsPerGame, winBy, cap } = scoring
  const [rows, setRows] = useState<RowState[]>(() => emptyRows(gamesPerMatch))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isLastMatch, setIsLastMatch] = useState(false)
  const recordResult = useRecordMatchResult(tournamentId)

  function updateRow(index: number, field: 'team1' | 'team2', value: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    )
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
      rowErrors.push(
        t('matches.result.ruleViolationError', { pointsPerGame, winBy, cap }),
      )
      continue
    }

    rowErrors.push(null)
    games.push({ team1_score, team2_score })
  }

  const hasRowError = rowErrors.some((e) => e !== null)
  const matchLevelError =
    !hasRowError &&
    games.length > 0 &&
    !validateMatchGames(games, gamesPerMatch)
      ? t('matches.result.notDecidedError')
      : null

  const isValid = !hasRowError && games.length > 0 && matchLevelError === null
  const canSave = isValid && (queueHasMatch || isLastMatch)

  function handleSaveResultClick(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    setConfirmOpen(true)
  }

  function handleConfirm() {
    recordResult.mutate(
      {
        matchId,
        games: games.map((g, i) => ({
          game_number: i + 1,
          team1_score: g.team1_score,
          team2_score: g.team2_score,
        })),
      },
      { onSuccess: () => setConfirmOpen(false) },
    )
  }

  return (
    <form className="score-form" onSubmit={handleSaveResultClick}>
      {rows.map((row, i) => (
        <div key={i} className="score-row">
          <label className="score-field">
            <span className="score-field-name">{team1Name}</span>
            <input
              type="number"
              className="score-input"
              aria-label={t('manage.gameTeamLabel', {
                team: team1Name,
                n: i + 1,
              })}
              value={row.team1}
              onChange={(event) => updateRow(i, 'team1', event.target.value)}
            />
          </label>
          <label className="score-field">
            <span className="score-field-name">{team2Name}</span>
            <input
              type="number"
              className="score-input"
              aria-label={t('manage.gameTeamLabel', {
                team: team2Name,
                n: i + 1,
              })}
              value={row.team2}
              onChange={(event) => updateRow(i, 'team2', event.target.value)}
            />
          </label>
          {rowErrors[i] && (
            <p className="field-error" role="alert">
              {rowErrors[i]}
            </p>
          )}
        </div>
      ))}
      {matchLevelError && (
        <p className="field-error" role="alert">
          {matchLevelError}
        </p>
      )}
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={isLastMatch}
          onChange={(event) => setIsLastMatch(event.target.checked)}
        />
        {t('manage.isLastMatch')}
      </label>
      <button type="submit" disabled={!canSave}>
        {t('manage.saveResult')}
      </button>
      {isValid && !queueHasMatch && !isLastMatch && (
        <p className="field-hint">{t('manage.saveResultNeedsQueue')}</p>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <h3>{t('manage.confirmResultTitle')}</h3>
        <p>{t('manage.confirmResultBody')}</p>
        <ul className="review-list">
          {games.map((g, i) => (
            <li key={i}>
              {t('manage.gameScoreLine', {
                n: i + 1,
                team1: team1Name,
                team1Score: g.team1_score,
                team2: team2Name,
                team2Score: g.team2_score,
              })}
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => setConfirmOpen(false)}
          >
            {t('manage.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={recordResult.isPending}
          >
            {t('manage.confirmResultButton')}
          </button>
        </div>
      </Modal>
    </form>
  )
}
