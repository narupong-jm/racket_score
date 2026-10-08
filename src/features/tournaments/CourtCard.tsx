import { useTranslation } from 'react-i18next'
import { teamNames } from '../matches/matchFormatting'
import type { Match, MatchHistoryEntry } from '../matches/matchesApi'
import type { QueuedMatch } from '../../lib/matchQueueStore'
import { CourtMatchForm, type ScoringRules } from './CourtMatchForm'
import { queuedTeamNames } from './queuedMatchup'

interface CourtCardProps {
  tournamentId: string
  courtNumber: number
  /** The match in progress on this court, or null when the court is free. */
  match: Match | null
  matchParticipants: MatchHistoryEntry[]
  playerNameById: Map<string, string>
  isActive: boolean
  scoring: ScoringRules
  queueHead: QueuedMatch | undefined
  /** Names of queue-head players already playing on another court. */
  blockedNames: string[]
  startPending: boolean
  startFailed: boolean
  onStart: () => void
}

/**
 * One entry of the Manage screen's court list: a full card with score entry
 * while a match is in progress, otherwise a one-line "free" strip whose
 * Start button puts the queue head onto this court.
 */
export function CourtCard({
  tournamentId,
  courtNumber,
  match,
  matchParticipants,
  playerNameById,
  isActive,
  scoring,
  queueHead,
  blockedNames,
  startPending,
  startFailed,
  onStart,
}: CourtCardProps) {
  const { t } = useTranslation()

  if (match) {
    const team1 = teamNames(matchParticipants, 1, playerNameById)
    const team2 = teamNames(matchParticipants, 2, playerNameById)
    return (
      <li className="card court-card">
        <h3>
          {t('manage.courtMatchHeading', {
            n: courtNumber,
            match: match.sequence_number,
          })}
        </h3>
        <p className="matchup-line">
          {t('matches.draw.matchup', { team1, team2 })}
        </p>
        {isActive && (
          <CourtMatchForm
            key={match.id}
            tournamentId={tournamentId}
            matchId={match.id}
            team1Name={team1}
            team2Name={team2}
            scoring={scoring}
            queueHasMatch={queueHead !== undefined}
          />
        )}
      </li>
    )
  }

  const blocked = blockedNames.length > 0
  return (
    <li className="court-strip">
      <div className="court-strip-row">
        <span className="court-strip-label">
          {t('manage.courtFree', { n: courtNumber })}
        </span>
        <button
          type="button"
          onClick={onStart}
          disabled={!isActive || !queueHead || blocked || startPending}
        >
          {queueHead
            ? t('manage.startOnCourtWith', {
                matchup: t('matches.draw.matchup', {
                  team1: queuedTeamNames(
                    queueHead.participants,
                    1,
                    playerNameById,
                  ),
                  team2: queuedTeamNames(
                    queueHead.participants,
                    2,
                    playerNameById,
                  ),
                }),
              })
            : t('manage.startOnCourt')}
        </button>
      </div>
      {isActive && !queueHead && (
        <p className="field-hint">{t('manage.startNeedsQueue')}</p>
      )}
      {isActive && blocked && (
        <p className="field-warning">
          {t('manage.startBlocked', { names: blockedNames.join(', ') })}
        </p>
      )}
      {startFailed && <p className="field-error">{t('manage.drawFailed')}</p>}
    </li>
  )
}
