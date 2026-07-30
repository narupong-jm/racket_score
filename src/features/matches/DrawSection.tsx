import { useTranslation } from 'react-i18next'
import { useDrawNextMatch } from './useDrawNextMatch'
import { useMatchQueue, type QueuedMatch } from './useMatchQueue'
import { useDrawInputs } from './useDrawInputs'
import { ResultEntryForm } from './ResultEntryForm'
import { usePlayers } from '../players/usePlayers'
import { getNeededPlayerCount } from '../matchmaking/generateNextMatch'
import type { MatchType } from '../matchmaking/types'

interface DrawSectionProps {
  tournamentId: string
  matchType: MatchType
  isActive: boolean
  gamesPerMatch: number
  pointsPerGame: number
  winBy: number
  cap: number
}

const MAX_QUEUED_MATCHES = 2

export function DrawSection({
  tournamentId,
  matchType,
  isActive,
  gamesPerMatch,
  pointsPerGame,
  winBy,
  cap,
}: DrawSectionProps) {
  const { t } = useTranslation()
  const drawNextMatch = useDrawNextMatch(tournamentId, matchType)
  const { data: queue } = useMatchQueue(tournamentId)
  const { data: players } = usePlayers()
  const { data: drawInputs } = useDrawInputs(tournamentId)

  const playerNameById = new Map((players ?? []).map((p) => [p.id, p.name]))
  const queueLength = queue?.length ?? 0
  const courtFull = queueLength >= MAX_QUEUED_MATCHES

  const neededCount = getNeededPlayerCount(matchType)
  const participantCount = drawInputs?.candidates.length ?? 0
  const notEnoughPlayers = drawInputs !== undefined && participantCount < neededCount

  function describeMatch(queuedMatch: QueuedMatch): string {
    const nameOf = (playerId: string) => playerNameById.get(playerId) ?? playerId
    const team1 = queuedMatch.participants
      .filter((p) => p.team === 1)
      .map((p) => nameOf(p.player_id))
      .join(' & ')
    const team2 = queuedMatch.participants
      .filter((p) => p.team === 2)
      .map((p) => nameOf(p.player_id))
      .join(' & ')
    return t('matches.draw.matchup', { team1, team2 })
  }

  return (
    <div>
      <h4>{t('matches.draw.currentHeading')}</h4>
      {queue?.[0] ? (
        <>
          <p>{describeMatch(queue[0])}</p>
          {isActive && (
            <ResultEntryForm
              key={queue[0].match.id}
              tournamentId={tournamentId}
              matchId={queue[0].match.id}
              gamesPerMatch={gamesPerMatch}
              pointsPerGame={pointsPerGame}
              winBy={winBy}
              cap={cap}
            />
          )}
        </>
      ) : (
        <p>{t('matches.draw.noCurrentMatch')}</p>
      )}

      <h4>{t('matches.draw.queuedHeading')}</h4>
      {queue?.[1] ? <p>{describeMatch(queue[1])}</p> : <p>{t('matches.draw.noQueuedMatch')}</p>}

      <button
        type="button"
        onClick={() => drawNextMatch.mutate()}
        disabled={drawNextMatch.isPending || !isActive || courtFull || notEnoughPlayers}
      >
        {t('matches.draw.drawNext')}
      </button>
      {courtFull && <p>{t('matches.draw.courtFull')}</p>}
      {notEnoughPlayers && (
        <p>
          {t('matches.draw.notEnoughPlayersWithCount', {
            needed: neededCount,
            have: participantCount,
          })}
        </p>
      )}
      {drawNextMatch.data && !drawNextMatch.data.ok && <p>{t('matches.draw.notEnoughPlayers')}</p>}
      {drawNextMatch.isError && <p>{t('matches.draw.drawFailed')}</p>}
    </div>
  )
}
