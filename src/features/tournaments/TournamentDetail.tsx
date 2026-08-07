import { useState, type FormEvent } from 'react'
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
import type { Player } from '../players/playersApi'
import { useDrawInputs } from '../matches/useDrawInputs'
import { useTournamentMatches, useStartNextMatch } from '../matches/useMatchQueue'
import { useRecordMatchResult } from '../matches/useRecordMatchResult'
import { validateGameScore, type GameScoreRules } from '../matches/validateGameScore'
import { validateMatchGames, type GameScore } from '../matches/validateMatchGames'
import { teamNames, summarizeGamesWon } from '../matches/matchFormatting'
import {
  generateNextMatch,
  getNeededPlayerCount,
  type GeneratedMatchParticipant,
} from '../matchmaking/generateNextMatch'
import { isMixedDoublesRuleViolated } from '../matchmaking/isMixedDoublesRuleViolated'
import { DrawSlotSelect, type RosterPlayer } from '../../components/DrawSlotSelect'
import type { MatchType } from '../matchmaking/types'
import type { Match, MatchGame, MatchHistoryEntry } from '../matches/matchesApi'

interface TournamentDetailProps {
  tournamentId: string
  onEnded?: () => void
  onCancelled?: () => void
}

export function TournamentDetail({ tournamentId, onEnded, onCancelled }: TournamentDetailProps) {
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
  const [nextDraw, setNextDraw] = useState<GeneratedMatchParticipant[] | null>(null)

  if (!tournament) return <p>{t('tournaments.detail.notFound')}</p>

  const isActive = tournament.status === 'active'
  const matchType = tournament.type as MatchType
  const cap = tournament.point_cap ?? computePointCap(tournament.points_per_game)

  const playerNameById = new Map((players ?? []).map((p) => [p.id, p.name]))
  const rosterPlayers: RosterPlayer[] = (participants ?? []).flatMap((participant) => {
    const player = players?.find((p) => p.id === participant.player_id)
    if (!player || (player.gender !== 'male' && player.gender !== 'female')) return []
    return [{ id: player.id, name: player.name, gender: player.gender }]
  })
  const matches = tournamentMatches?.matches ?? []
  const matchParticipants = tournamentMatches?.participants ?? []
  const games = tournamentMatches?.games ?? []

  const currentMatch = matches.find((m) => m.status === 'queued') ?? null
  const completedMatches = matches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => b.sequence_number - a.sequence_number)
  const hasConfirmedResult = completedMatches.length > 0
  const currentMatchParticipantIds = currentMatch
    ? participantsFor(currentMatch.id).map((p) => p.player_id)
    : []

  function participantsFor(matchId: string): MatchHistoryEntry[] {
    return matchParticipants.filter((p) => p.match_id === matchId)
  }

  function gamesFor(matchId: string): MatchGame[] {
    return games.filter((g) => g.match_id === matchId)
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

      <CurrentMatchCard
        tournamentId={tournamentId}
        currentMatch={currentMatch}
        participants={currentMatch ? participantsFor(currentMatch.id) : []}
        playerNameById={playerNameById}
        gamesPerMatch={tournament.games_per_match}
        pointsPerGame={tournament.points_per_game}
        winBy={tournament.win_by}
        cap={cap}
        isActive={isActive}
        hasNextMatchDrawn={nextDraw !== null}
      />

      <NextMatchCard
        tournamentId={tournamentId}
        matchType={matchType}
        isActive={isActive}
        hasCurrentMatch={currentMatch !== null}
        currentMatchParticipantIds={currentMatchParticipantIds}
        rosterPlayers={rosterPlayers}
        playerNameById={playerNameById}
        nextDraw={nextDraw}
        onNextDrawChange={setNextDraw}
      />

      <RoundsPlayedList
        matches={completedMatches}
        participantsFor={participantsFor}
        gamesFor={gamesFor}
        playerNameById={playerNameById}
      />

      <ParticipantsCard
        tournamentId={tournamentId}
        participants={participants}
        players={players}
        playerNameById={playerNameById}
        isActive={isActive}
        currentMatchParticipantIds={currentMatchParticipantIds}
        nextDraw={nextDraw}
        onNextDrawChange={setNextDraw}
      />

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
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setEndModalOpen(false)}>
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
          <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)}>
            <h3>{t('manage.confirmCancelTitle')}</h3>
            <p>{t('manage.confirmCancelBody')}</p>
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
  participants: TournamentParticipant[] | undefined
  players: Player[] | undefined
  playerNameById: Map<string, string>
  isActive: boolean
  currentMatchParticipantIds: string[]
  nextDraw: GeneratedMatchParticipant[] | null
  onNextDrawChange: (draw: GeneratedMatchParticipant[] | null) => void
}

function ParticipantsCard({
  tournamentId,
  participants,
  players,
  playerNameById,
  isActive,
  currentMatchParticipantIds,
  nextDraw,
  onNextDrawChange,
}: ParticipantsCardProps) {
  const { t } = useTranslation()
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
        if (nextDraw?.some((p) => p.playerId === playerId)) onNextDrawChange(null)
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
    (participants ?? []).filter((p) => p.status === 'active').map((p) => p.player_id),
  )
  const availablePlayers = (players ?? []).filter((player) => !activeParticipantIds.has(player.id))

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
            const name = playerNameById.get(participant.player_id) ?? participant.player_id
            const isLeft = participant.status === 'left'
            return (
              <li
                key={participant.player_id}
                className={isLeft ? 'avatar-list-item participant-left' : 'avatar-list-item'}
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
                        setLeavingParticipant({ playerId: participant.player_id, name })
                      }
                      disabled={
                        currentMatchParticipantIds.includes(participant.player_id) ||
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

      <Modal open={leavingParticipant !== null} onClose={() => setLeavingParticipant(null)}>
        <h3>{t('manage.confirmLeaveTitle', { name: leavingParticipant?.name ?? '' })}</h3>
        <p>{t('manage.confirmLeaveBody')}</p>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={() => setLeavingParticipant(null)}>
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

interface CurrentMatchCardProps {
  tournamentId: string
  currentMatch: Match | null
  participants: MatchHistoryEntry[]
  playerNameById: Map<string, string>
  gamesPerMatch: number
  pointsPerGame: number
  winBy: number
  cap: number
  isActive: boolean
  hasNextMatchDrawn: boolean
}

function CurrentMatchCard({
  tournamentId,
  currentMatch,
  participants,
  playerNameById,
  gamesPerMatch,
  pointsPerGame,
  winBy,
  cap,
  isActive,
  hasNextMatchDrawn,
}: CurrentMatchCardProps) {
  const { t } = useTranslation()

  return (
    <section className="card">
      <h3>{t('manage.currentMatchHeading')}</h3>
      {!currentMatch ? (
        <p className="empty-state">{t('manage.noCurrentMatch')}</p>
      ) : (
        <>
          <p className="matchup-line">
            {t('matches.draw.matchup', {
              team1: teamNames(participants, 1, playerNameById),
              team2: teamNames(participants, 2, playerNameById),
            })}
          </p>
          {isActive && (
            <CurrentMatchForm
              key={currentMatch.id}
              tournamentId={tournamentId}
              matchId={currentMatch.id}
              team1Name={teamNames(participants, 1, playerNameById)}
              team2Name={teamNames(participants, 2, playerNameById)}
              gamesPerMatch={gamesPerMatch}
              pointsPerGame={pointsPerGame}
              winBy={winBy}
              cap={cap}
              hasNextMatchDrawn={hasNextMatchDrawn}
            />
          )}
        </>
      )}
    </section>
  )
}

interface RowState {
  team1: string
  team2: string
}

function emptyRows(count: number): RowState[] {
  return Array.from({ length: count }, () => ({ team1: '', team2: '' }))
}

interface CurrentMatchFormProps {
  tournamentId: string
  matchId: string
  team1Name: string
  team2Name: string
  gamesPerMatch: number
  pointsPerGame: number
  winBy: number
  cap: number
  hasNextMatchDrawn: boolean
}

function CurrentMatchForm({
  tournamentId,
  matchId,
  team1Name,
  team2Name,
  gamesPerMatch,
  pointsPerGame,
  winBy,
  cap,
  hasNextMatchDrawn,
}: CurrentMatchFormProps) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<RowState[]>(() => emptyRows(gamesPerMatch))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isLastMatch, setIsLastMatch] = useState(false)
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
  const canSave = isValid && (hasNextMatchDrawn || isLastMatch)

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
              aria-label={t('manage.gameTeamLabel', { team: team1Name, n: i + 1 })}
              value={row.team1}
              onChange={(event) => updateRow(i, 'team1', event.target.value)}
            />
          </label>
          <label className="score-field">
            <span className="score-field-name">{team2Name}</span>
            <input
              type="number"
              className="score-input"
              aria-label={t('manage.gameTeamLabel', { team: team2Name, n: i + 1 })}
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
      {isValid && !hasNextMatchDrawn && !isLastMatch && (
        <p className="field-hint">{t('manage.saveResultLockedHint')}</p>
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
          <button type="button" className="secondary" onClick={() => setConfirmOpen(false)}>
            {t('manage.cancel')}
          </button>
          <button type="button" onClick={handleConfirm} disabled={recordResult.isPending}>
            {t('manage.confirmResultButton')}
          </button>
        </div>
      </Modal>
    </form>
  )
}

interface NextMatchCardProps {
  tournamentId: string
  matchType: MatchType
  isActive: boolean
  hasCurrentMatch: boolean
  currentMatchParticipantIds: string[]
  rosterPlayers: RosterPlayer[]
  playerNameById: Map<string, string>
  nextDraw: GeneratedMatchParticipant[] | null
  onNextDrawChange: (draw: GeneratedMatchParticipant[] | null) => void
}

function NextMatchCard({
  tournamentId,
  matchType,
  isActive,
  hasCurrentMatch,
  currentMatchParticipantIds,
  rosterPlayers,
  playerNameById,
  nextDraw,
  onNextDrawChange,
}: NextMatchCardProps) {
  const { t } = useTranslation()
  const { data: drawInputs } = useDrawInputs(tournamentId)
  const startNextMatch = useStartNextMatch(tournamentId)
  const [drawFailed, setDrawFailed] = useState(false)
  const [usedCurrentMatchFallback, setUsedCurrentMatchFallback] = useState(false)
  const [editing, setEditing] = useState(false)
  const [manuallyAdjusted, setManuallyAdjusted] = useState(false)

  const neededCount = getNeededPlayerCount(matchType)
  const participantCount = drawInputs?.candidates.length ?? 0
  const notEnoughPlayers = drawInputs !== undefined && participantCount < neededCount

  function handleRandomize() {
    if (!drawInputs) return
    const excludingCurrent = drawInputs.candidates.filter(
      (c) => !currentMatchParticipantIds.includes(c.id),
    )
    const usedFallback = excludingCurrent.length < neededCount
    const candidates = usedFallback ? drawInputs.candidates : excludingCurrent

    const result = generateNextMatch(matchType, candidates, drawInputs.pairingHistory)
    if (result.ok) {
      onNextDrawChange(result.participants)
      setDrawFailed(false)
      setUsedCurrentMatchFallback(usedFallback)
    } else {
      onNextDrawChange(null)
      setDrawFailed(true)
      setUsedCurrentMatchFallback(false)
    }
    setEditing(false)
    setManuallyAdjusted(false)
  }

  function handleSwap(oldPlayerId: string, newPlayerId: string) {
    if (!nextDraw || oldPlayerId === newPlayerId) return
    onNextDrawChange(
      nextDraw.map((p) => (p.playerId === oldPlayerId ? { ...p, playerId: newPlayerId } : p)),
    )
    setManuallyAdjusted(true)
  }

  function handleStartMatch() {
    if (!nextDraw) return
    startNextMatch.mutate(
      {
        participants: nextDraw.map((p) => ({ player_id: p.playerId, team: p.team })),
        manuallyAdjusted,
      },
      {
        onSuccess: () => {
          onNextDrawChange(null)
          setEditing(false)
          setManuallyAdjusted(false)
        },
      },
    )
  }

  const team1 = nextDraw
    ? nextDraw
        .filter((p) => p.team === 1)
        .map((p) => playerNameById.get(p.playerId) ?? p.playerId)
        .join(' & ')
    : ''
  const team2 = nextDraw
    ? nextDraw
        .filter((p) => p.team === 2)
        .map((p) => playerNameById.get(p.playerId) ?? p.playerId)
        .join(' & ')
    : ''

  const mixedDoublesViolation =
    matchType === 'doubles' && nextDraw
      ? isMixedDoublesRuleViolated(
          nextDraw.map((p) => {
            const roster = rosterPlayers.find((r) => r.id === p.playerId)
            return {
              id: p.playerId,
              gender: roster?.gender ?? 'male',
              skillValue: 0,
              matchesPlayedInTournament: 0,
            }
          }),
          nextDraw.filter((p) => p.team === 1).map((p) => p.playerId),
        )
      : false

  return (
    <section className="card">
      <h3>{t('manage.nextMatchHeading')}</h3>
      {!nextDraw && <p className="empty-state">{t('manage.notPickedYet')}</p>}
      {nextDraw && !editing && (
        <p className="matchup-line">{t('matches.draw.matchup', { team1, team2 })}</p>
      )}
      {nextDraw && editing && (
        <div className="draw-edit-teams">
          <div className="draw-edit-team">
            {nextDraw
              .filter((p) => p.team === 1)
              .map((p, i) => (
                <DrawSlotSelect
                  key={p.playerId}
                  participant={p}
                  index={i}
                  draw={nextDraw}
                  rosterPlayers={rosterPlayers}
                  onSwap={handleSwap}
                />
              ))}
          </div>
          <span className="round-vs">vs</span>
          <div className="draw-edit-team">
            {nextDraw
              .filter((p) => p.team === 2)
              .map((p, i) => (
                <DrawSlotSelect
                  key={p.playerId}
                  participant={p}
                  index={i}
                  draw={nextDraw}
                  rosterPlayers={rosterPlayers}
                  onSwap={handleSwap}
                />
              ))}
          </div>
        </div>
      )}

      <div className="button-row">
        <button
          type="button"
          className="secondary"
          onClick={handleRandomize}
          disabled={!isActive || notEnoughPlayers || startNextMatch.isPending}
        >
          {t('manage.randomize')}
        </button>
        {nextDraw && (
          <button
            type="button"
            className="secondary"
            onClick={() => setEditing((e) => !e)}
            disabled={!isActive}
          >
            {editing ? t('manage.doneEditingDraw') : t('manage.editDraw')}
          </button>
        )}
        {nextDraw && (
          <button
            type="button"
            onClick={handleStartMatch}
            disabled={!isActive || hasCurrentMatch || startNextMatch.isPending}
          >
            {t('manage.startMatch')}
          </button>
        )}
      </div>

      {notEnoughPlayers && (
        <p className="field-error">
          {t('manage.notEnoughPlayersWithCount', {
            needed: neededCount,
            have: participantCount,
          })}
        </p>
      )}
      {drawFailed && <p className="field-error">{t('matches.draw.notEnoughPlayers')}</p>}
      {startNextMatch.isError && <p className="field-error">{t('manage.drawFailed')}</p>}
      {nextDraw && usedCurrentMatchFallback && (
        <p className="field-warning">{t('manage.currentMatchReusedWarning')}</p>
      )}
      {nextDraw && manuallyAdjusted && mixedDoublesViolation && (
        <p className="field-warning">{t('manage.mixedDoublesWarning')}</p>
      )}
    </section>
  )
}

interface RoundsPlayedListProps {
  matches: Match[]
  participantsFor: (matchId: string) => MatchHistoryEntry[]
  gamesFor: (matchId: string) => MatchGame[]
  playerNameById: Map<string, string>
}

function RoundsPlayedList({
  matches,
  participantsFor,
  gamesFor,
  playerNameById,
}: RoundsPlayedListProps) {
  const { t } = useTranslation()

  return (
    <section className="card">
      <h3>{t('manage.roundsPlayedHeading')}</h3>
      {matches.length === 0 ? (
        <p className="empty-state">{t('manage.noRoundsPlayed')}</p>
      ) : (
        <ul className="round-list">
          {matches.map((match) => {
            const participants = participantsFor(match.id)
            const matchGames = gamesFor(match.id)
            const team1Name = teamNames(participants, 1, playerNameById)
            const team2Name = teamNames(participants, 2, playerNameById)
            const { team1Games, team2Games } = summarizeGamesWon(matchGames)
            const team1Won = team1Games > team2Games

            return (
              <li key={match.id} className="round-row">
                <span className="round-label">
                  {t('manage.roundLabel', { n: match.sequence_number })}
                </span>
                <span className="round-matchup">
                  <span className={team1Won ? 'round-winner' : undefined}>{team1Name}</span>{' '}
                  <span className="round-vs">vs</span>{' '}
                  <span className={!team1Won ? 'round-winner' : undefined}>{team2Name}</span>
                </span>
                <span className="round-score">
                  {t('manage.finalScore', { team1Games, team2Games })}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
