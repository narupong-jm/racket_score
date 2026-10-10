import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTournaments } from './useTournaments'
import { useEndTournament } from './useEndTournament'
import { useCancelTournament } from './useCancelTournament'
import { useParticipants } from './useParticipants'
import { useLeaveParticipant } from './useLeaveParticipant'
import { useAddParticipant } from './useAddParticipant'
import type { TournamentParticipant } from './tournamentsApi'
import { computePointCap } from './computePointCap'
import { formatDate } from '../../i18n/formatDate'
import { Modal } from '../../components/Modal'
import { Avatar } from '../../components/Avatar'
import { usePlayers } from '../players/usePlayers'
import { useSportMembers } from '../players/useSportMembers'
import type { Sport } from '../sport/sportTypes'
import {
  useTournamentMatches,
  useStartMatchOnCourt,
} from '../matches/useMatchQueue'
import { useMatchQueueDrafts } from '../matches/useMatchQueueDrafts'
import {
  formatMatchLabel,
  teamNames,
  summarizeGamesWon,
} from '../matches/matchFormatting'
import type { PlannedMatch } from '../matchmaking/plannedMatches'
import type { RosterPlayer } from '../../components/DrawSlotSelect'
import type { MatchType } from '../matchmaking/types'
import type {
  Match,
  MatchGame,
  MatchHistoryEntry,
  RecentCompletedMatch,
} from '../matches/matchesApi'
import { DeleteMatchConfirmModal } from '../matches/DeleteMatchConfirmModal'
import { TournamentScoreboardSection } from './TournamentScoreboardSection'
import { CourtCard } from './CourtCard'
import { startMatchErrorKey } from './startMatchError'
import { QueueCard } from './QueueCard'

interface TournamentDetailProps {
  tournamentId: string
  onEnded?: () => void
  onCancelled?: () => void
}

export function TournamentDetail({
  tournamentId,
  onEnded,
  onCancelled,
}: TournamentDetailProps) {
  const { t, i18n } = useTranslation()
  const { data: tournaments } = useTournaments()
  const tournament = tournaments?.find((tour) => tour.id === tournamentId)

  const { data: players } = usePlayers()
  const { data: tournamentMatches } = useTournamentMatches(tournamentId)
  const { data: participants } = useParticipants(tournamentId)
  const endTournament = useEndTournament()
  const [endModalOpen, setEndModalOpen] = useState(false)
  const cancelTournament = useCancelTournament()
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const queueDrafts = useMatchQueueDrafts(tournamentId)
  const startMatch = useStartMatchOnCourt(tournamentId)

  // The queue lives in this browser only, so a participant can leave from
  // another device (or after this screen unmounted mid-Leave) while still
  // sitting in a queued match here. Never let such an entry be started.
  const { queue: storedQueue, removeContaining } = queueDrafts
  useEffect(() => {
    for (const participant of participants ?? []) {
      if (
        participant.status === 'left' &&
        storedQueue.some((m) =>
          m.participants.some((p) => p.playerId === participant.player_id),
        )
      ) {
        removeContaining(participant.player_id)
      }
    }
  }, [participants, storedQueue, removeContaining])

  if (!tournament) return <p>{t('tournaments.detail.notFound')}</p>

  const isActive = tournament.status === 'active'
  const matchType = tournament.type as MatchType
  const sport = tournament.sport as Sport
  const cap =
    tournament.point_cap ?? computePointCap(tournament.points_per_game)
  const courtCount = tournament.court_count
  const maxQueue = courtCount + 1

  const playerNameById = new Map((players ?? []).map((p) => [p.id, p.name]))
  const rosterPlayers: RosterPlayer[] = (participants ?? []).flatMap(
    (participant) => {
      if (participant.status !== 'active') return []
      const player = players?.find((p) => p.id === participant.player_id)
      if (!player || (player.gender !== 'male' && player.gender !== 'female'))
        return []
      return [{ id: player.id, name: player.name, gender: player.gender }]
    },
  )
  const matches = tournamentMatches?.matches ?? []
  const matchParticipants = tournamentMatches?.participants ?? []
  const games = tournamentMatches?.games ?? []

  const inProgress = matches.filter((m) => m.status === 'queued')
  const completedMatches = matches
    .filter((m) => m.status === 'completed')
    .sort(
      (a, b) =>
        (b.completed_at ?? '').localeCompare(a.completed_at ?? '') ||
        b.sequence_number - a.sequence_number,
    )
  const hasConfirmedResult = completedMatches.length > 0
  const inProgressRosters: PlannedMatch[] = inProgress.map((m) =>
    participantsFor(m.id).map((p) => ({
      playerId: p.player_id,
      team: p.team as 1 | 2,
    })),
  )
  const completedMatchIds = new Set(completedMatches.map((m) => m.id))
  const completedCountById = new Map<string, number>()
  for (const p of matchParticipants) {
    if (completedMatchIds.has(p.match_id)) {
      completedCountById.set(
        p.player_id,
        (completedCountById.get(p.player_id) ?? 0) + 1,
      )
    }
  }
  const inProgressPlayerIds = new Set(
    inProgressRosters.flatMap((roster) => roster.map((p) => p.playerId)),
  )

  const queue = queueDrafts.queue
  const queueHead = queue[0]
  const headBlockedNames = (queueHead?.participants ?? [])
    .filter((p) => inProgressPlayerIds.has(p.playerId))
    .map((p) => playerNameById.get(p.playerId) ?? p.playerId)
  const courtNumbers = Array.from({ length: courtCount }, (_, i) => i + 1)

  function participantsFor(matchId: string): MatchHistoryEntry[] {
    return matchParticipants.filter((p) => p.match_id === matchId)
  }

  function gamesFor(matchId: string): MatchGame[] {
    return games.filter((g) => g.match_id === matchId)
  }

  function handleStart(courtNumber: number) {
    if (!queueHead) return
    startMatch.mutate({
      participants: queueHead.participants.map((p) => ({
        player_id: p.playerId,
        team: p.team,
      })),
      manuallyAdjusted: queueHead.manuallyAdjusted,
      courtNumber,
    })
  }

  function handleConfirmEnd() {
    if (!tournament) return
    endTournament.mutate(tournament.id, {
      onSuccess: () => {
        setEndModalOpen(false)
        onEnded?.()
      },
    })
  }

  function handleConfirmCancel() {
    if (!tournament) return
    cancelTournament.mutate(tournament.id, {
      onSuccess: () => {
        setCancelModalOpen(false)
        onCancelled?.()
      },
    })
  }

  return (
    <section className="page manage-page">
      <header className="page-header">
        <h2>{tournament.name}</h2>
        <p className="page-subtitle">
          {t('tournaments.detail.summary', {
            type: t(`tournamentType.${tournament.type}`),
            status: t(`tournamentStatus.${tournament.status}`),
          })}
        </p>
        <p className="meta-line">
          {t('tournaments.detail.createdAt', {
            date: formatDate(tournament.created_at, i18n.language),
          })}
        </p>
        {tournament.ended_at && (
          <p className="meta-line">
            {t('tournaments.detail.endedAt', {
              date: formatDate(tournament.ended_at, i18n.language),
            })}
          </p>
        )}
      </header>

      <ol className="court-list" aria-label={t('manage.courtsHeading')}>
        {courtNumbers.map((courtNumber) => {
          const match =
            inProgress.find((m) => (m.court_number ?? 1) === courtNumber) ??
            null
          return (
            <CourtCard
              key={courtNumber}
              tournamentId={tournamentId}
              courtNumber={courtNumber}
              match={match}
              matchParticipants={match ? participantsFor(match.id) : []}
              playerNameById={playerNameById}
              isActive={isActive}
              scoring={{
                gamesPerMatch: tournament.games_per_match,
                pointsPerGame: tournament.points_per_game,
                winBy: tournament.win_by,
                cap,
              }}
              queueHead={queueHead}
              blockedNames={headBlockedNames}
              startPending={startMatch.isPending}
              startErrorKey={
                startMatch.isError &&
                startMatch.variables?.courtNumber === courtNumber
                  ? startMatchErrorKey(startMatch.error)
                  : null
              }
              onStart={() => handleStart(courtNumber)}
            />
          )
        })}
      </ol>

      <QueueCard
        tournamentId={tournamentId}
        sport={sport}
        matchType={matchType}
        isActive={isActive}
        maxQueue={maxQueue}
        drafts={queueDrafts}
        inProgress={inProgress.map((m, i) => ({
          courtNumber: m.court_number ?? 1,
          roster: inProgressRosters[i],
        }))}
        rosterPlayers={rosterPlayers}
        playerNameById={playerNameById}
        completedCountById={completedCountById}
        busy={startMatch.isPending}
      />

      <RoundsPlayedList
        matches={completedMatches}
        courtCount={courtCount}
        participantsFor={participantsFor}
        gamesFor={gamesFor}
        playerNameById={playerNameById}
        sport={sport}
        tournamentName={tournament.name}
      />

      <ParticipantsCard
        tournamentId={tournamentId}
        sport={sport}
        participants={participants}
        playerNameById={playerNameById}
        isActive={isActive}
        inProgressPlayerIds={inProgressPlayerIds}
        onParticipantLeft={queueDrafts.removeContaining}
      />

      <section className="card">
        <h3>{t('tournaments.detail.standingsHeading')}</h3>
        <TournamentScoreboardSection tournamentId={tournamentId} />
      </section>

      {isActive && hasConfirmedResult && (
        <div className="danger-zone">
          <button
            type="button"
            className="danger"
            onClick={() => setEndModalOpen(true)}
            disabled={endTournament.isPending}
          >
            {t('manage.endTournament')}
          </button>
          <Modal open={endModalOpen} onClose={() => setEndModalOpen(false)}>
            <h3>{t('manage.confirmEndTitle')}</h3>
            <p>{t('manage.confirmEndBody')}</p>
            {inProgress.length > 0 && (
              <p className="field-warning">
                {t('manage.confirmEndInProgress', {
                  courts: inProgress
                    .map((m) => m.court_number ?? 1)
                    .sort((a, b) => a - b)
                    .map((n) => t('manage.nowCourt', { n }))
                    .join(', '),
                  count: inProgress.length,
                })}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setEndModalOpen(false)}
              >
                {t('manage.cancel')}
              </button>
              <button
                type="button"
                className="danger"
                onClick={handleConfirmEnd}
                disabled={endTournament.isPending}
              >
                {t('manage.confirmEndButton')}
              </button>
            </div>
          </Modal>
        </div>
      )}

      {isActive && !hasConfirmedResult && (
        <div className="danger-zone">
          <button
            type="button"
            className="danger"
            onClick={() => setCancelModalOpen(true)}
            disabled={cancelTournament.isPending}
          >
            {t('manage.cancelTournament')}
          </button>
          <Modal
            open={cancelModalOpen}
            onClose={() => setCancelModalOpen(false)}
          >
            <h3>{t('manage.confirmCancelTitle')}</h3>
            <p>{t('manage.confirmCancelBodyMulti')}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setCancelModalOpen(false)}
              >
                {t('manage.cancel')}
              </button>
              <button
                type="button"
                className="danger"
                onClick={handleConfirmCancel}
                disabled={cancelTournament.isPending}
              >
                {t('manage.confirmCancelButton')}
              </button>
            </div>
          </Modal>
        </div>
      )}
    </section>
  )
}

interface ParticipantsCardProps {
  tournamentId: string
  sport: Sport
  participants: TournamentParticipant[] | undefined
  playerNameById: Map<string, string>
  isActive: boolean
  /** Players in an in-progress match on any court (can't Leave). */
  inProgressPlayerIds: Set<string>
  /** Drops queued matches containing the player who just left. */
  onParticipantLeft: (playerId: string) => void
}

function ParticipantsCard({
  tournamentId,
  sport,
  participants,
  playerNameById,
  isActive,
  inProgressPlayerIds,
  onParticipantLeft,
}: ParticipantsCardProps) {
  const { t } = useTranslation()
  // `sport` is the tournament's own sport, which may differ from the active
  // workspace -- the Add-participant picker must stay scoped to the
  // tournament's sport regardless of which workspace is open.
  const { data: members } = useSportMembers(sport)
  const leaveParticipant = useLeaveParticipant(tournamentId)
  const addParticipant = useAddParticipant(tournamentId)
  const [leavingParticipant, setLeavingParticipant] = useState<{
    playerId: string
    name: string
  } | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState('')

  function handleConfirmLeave() {
    if (!leavingParticipant) return
    const { playerId } = leavingParticipant
    leaveParticipant.mutate(playerId, {
      onSuccess: () => {
        setLeavingParticipant(null)
        onParticipantLeft(playerId)
      },
    })
  }

  function handleAddParticipant() {
    if (!selectedPlayerId) return
    addParticipant.mutate(selectedPlayerId, {
      onSuccess: () => setSelectedPlayerId(''),
    })
  }

  const activeParticipantIds = new Set(
    (participants ?? [])
      .filter((p) => p.status === 'active')
      .map((p) => p.player_id),
  )
  const availablePlayers = (members ?? []).filter(
    (player) => !activeParticipantIds.has(player.id),
  )

  return (
    <section className="card">
      <h3>{t('tournaments.detail.participantsHeading')}</h3>
      {isActive &&
        (availablePlayers.length === 0 ? (
          <p className="empty-state">{t('manage.noPlayersToAdd')}</p>
        ) : (
          <div className="field-row">
            <label className="field">
              <span className="field-label">{t('manage.addParticipant')}</span>
              <select
                value={selectedPlayerId}
                onChange={(event) => setSelectedPlayerId(event.target.value)}
              >
                <option value="" disabled>
                  {t('manage.addParticipantPlaceholder')}
                </option>
                {availablePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary"
              onClick={handleAddParticipant}
              disabled={!selectedPlayerId || addParticipant.isPending}
            >
              {t('manage.addParticipantButton')}
            </button>
          </div>
        ))}
      {addParticipant.isError && (
        <p className="field-error">{t('manage.addParticipantFailed')}</p>
      )}

      {!participants || participants.length === 0 ? (
        <p className="empty-state">{t('tournaments.participants.empty')}</p>
      ) : (
        <ul className="avatar-list">
          {participants.map((participant) => {
            const name =
              playerNameById.get(participant.player_id) ?? participant.player_id
            const isLeft = participant.status === 'left'
            return (
              <li
                key={participant.player_id}
                className={
                  isLeft
                    ? 'avatar-list-item participant-left'
                    : 'avatar-list-item'
                }
              >
                <Avatar name={name} size={32} />
                <span>{name}</span>
                {isLeft ? (
                  <span className="badge">{t('manage.leftBadge')}</span>
                ) : (
                  isActive && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setLeavingParticipant({
                          playerId: participant.player_id,
                          name,
                        })
                      }
                      disabled={
                        inProgressPlayerIds.has(participant.player_id) ||
                        leaveParticipant.isPending
                      }
                    >
                      {t('manage.leave')}
                    </button>
                  )
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={leavingParticipant !== null}
        onClose={() => setLeavingParticipant(null)}
      >
        <h3>
          {t('manage.confirmLeaveTitle', {
            name: leavingParticipant?.name ?? '',
          })}
        </h3>
        <p>{t('manage.confirmLeaveBody')}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => setLeavingParticipant(null)}
          >
            {t('manage.cancel')}
          </button>
          <button
            type="button"
            className="danger"
            onClick={handleConfirmLeave}
            disabled={leaveParticipant.isPending}
          >
            {t('manage.confirmLeaveButton')}
          </button>
        </div>
      </Modal>
    </section>
  )
}

interface RoundsPlayedListProps {
  matches: Match[]
  courtCount: number
  participantsFor: (matchId: string) => MatchHistoryEntry[]
  gamesFor: (matchId: string) => MatchGame[]
  playerNameById: Map<string, string>
  sport: Sport
  tournamentName: string
}

function RoundsPlayedList({
  matches,
  courtCount,
  participantsFor,
  gamesFor,
  playerNameById,
  sport,
  tournamentName,
}: RoundsPlayedListProps) {
  const { t } = useTranslation()
  const [deletingRow, setDeletingRow] = useState<RecentCompletedMatch | null>(
    null,
  )

  return (
    <section className="card">
      <h3>{t('manage.matchesPlayedHeading')}</h3>
      {matches.length === 0 ? (
        <p className="empty-state">{t('manage.noMatchesPlayed')}</p>
      ) : (
        <ul className="round-list">
          {matches.map((match, index) => {
            const participants = participantsFor(match.id)
            const matchGames = gamesFor(match.id)
            const team1Name = teamNames(participants, 1, playerNameById)
            const team2Name = teamNames(participants, 2, playerNameById)
            const { team1Games, team2Games } = summarizeGamesWon(matchGames)
            const team1Won = team1Games > team2Games

            return (
              <li key={match.id} className="round-row">
                <span className="round-label">
                  {formatMatchLabel(t, match, courtCount)}
                </span>
                <span className="round-matchup">
                  <span className={team1Won ? 'round-winner' : undefined}>
                    {team1Name}
                  </span>{' '}
                  <span className="round-vs">vs</span>{' '}
                  <span className={!team1Won ? 'round-winner' : undefined}>
                    {team2Name}
                  </span>
                </span>
                <span className="round-score">
                  {t('manage.finalScore', { team1Games, team2Games })}
                </span>
                {index === 0 && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      setDeletingRow({
                        match,
                        tournamentName,
                        courtCount,
                        participants,
                        games: matchGames,
                      })
                    }
                  >
                    {t('manage.deleteLastMatchButton')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <DeleteMatchConfirmModal
        row={deletingRow}
        sport={sport}
        playerNameById={playerNameById}
        onClose={() => setDeletingRow(null)}
      />
    </section>
  )
}
