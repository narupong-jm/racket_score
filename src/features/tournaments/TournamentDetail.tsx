import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useTournaments } from './useTournaments'
import { useEndTournament } from './useEndTournament'
import { useParticipants } from './useParticipants'
import { computePointCap } from './computePointCap'
import { formatDate } from '../../i18n/formatDate'
import { Modal } from '../../components/Modal'
import { Avatar } from '../../components/Avatar'
import { usePlayers } from '../players/usePlayers'
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
import type { MatchType } from '../matchmaking/types'
import type { Match, MatchGame, MatchHistoryEntry } from '../matches/matchesApi'

interface TournamentDetailProps {
  tournamentId: string
  onEnded?: () => void
}

export function TournamentDetail({ tournamentId, onEnded }: TournamentDetailProps) {
  const { t, i18n } = useTranslation()
  const { data: tournaments } = useTournaments()
  const tournament = tournaments?.find((tour) => tour.id === tournamentId)

  const { data: players } = usePlayers()
  const { data: tournamentMatches } = useTournamentMatches(tournamentId)
  const { data: participants } = useParticipants(tournamentId)
  const endTournament = useEndTournament()
  const [endModalOpen, setEndModalOpen] = useState(false)

  if (!tournament) return <p>{t('tournaments.detail.notFound')}</p>

  const isActive = tournament.status === 'active'
  const matchType = tournament.type as MatchType
  const cap = tournament.point_cap ?? computePointCap(tournament.points_per_game)

  const playerNameById = new Map((players ?? []).map((p) => [p.id, p.name]))
  const matches = tournamentMatches?.matches ?? []
  const matchParticipants = tournamentMatches?.participants ?? []
  const games = tournamentMatches?.games ?? []

  const currentMatch = matches.find((m) => m.status === 'queued') ?? null
  const completedMatches = matches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => b.sequence_number - a.sequence_number)

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
      />

      <NextMatchCard
        tournamentId={tournamentId}
        matchType={matchType}
        isActive={isActive}
        hasCurrentMatch={currentMatch !== null}
        playerNameById={playerNameById}
      />

      <RoundsPlayedList
        matches={completedMatches}
        participantsFor={participantsFor}
        gamesFor={gamesFor}
        playerNameById={playerNameById}
      />

      <section className="card">
        <h3>{t('tournaments.detail.participantsHeading')}</h3>
        {!participants || participants.length === 0 ? (
          <p className="empty-state">{t('tournaments.participants.empty')}</p>
        ) : (
          <ul className="avatar-list">
            {participants.map((participant) => {
              const name = playerNameById.get(participant.player_id) ?? participant.player_id
              return (
                <li key={participant.player_id} className="avatar-list-item">
                  <Avatar name={name} size={32} />
                  <span>{name}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {isActive && (
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
}: CurrentMatchFormProps) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<RowState[]>(() => emptyRows(gamesPerMatch))
  const [confirmOpen, setConfirmOpen] = useState(false)
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

  function handleSaveResultClick(event: FormEvent) {
    event.preventDefault()
    if (!isValid) return
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
      <button type="submit" disabled={!isValid}>
        {t('manage.saveResult')}
      </button>

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
  playerNameById: Map<string, string>
}

function NextMatchCard({
  tournamentId,
  matchType,
  isActive,
  hasCurrentMatch,
  playerNameById,
}: NextMatchCardProps) {
  const { t } = useTranslation()
  const { data: drawInputs } = useDrawInputs(tournamentId)
  const startNextMatch = useStartNextMatch(tournamentId)
  const [nextDraw, setNextDraw] = useState<GeneratedMatchParticipant[] | null>(null)
  const [drawFailed, setDrawFailed] = useState(false)

  const neededCount = getNeededPlayerCount(matchType)
  const participantCount = drawInputs?.candidates.length ?? 0
  const notEnoughPlayers = drawInputs !== undefined && participantCount < neededCount

  function handleRandomize() {
    if (!drawInputs) return
    const result = generateNextMatch(matchType, drawInputs.candidates, drawInputs.pairingHistory)
    if (result.ok) {
      setNextDraw(result.participants)
      setDrawFailed(false)
    } else {
      setNextDraw(null)
      setDrawFailed(true)
    }
  }

  function handleStartMatch() {
    if (!nextDraw) return
    startNextMatch.mutate(
      nextDraw.map((p) => ({ player_id: p.playerId, team: p.team })),
      { onSuccess: () => setNextDraw(null) },
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

  return (
    <section className="card">
      <h3>{t('manage.nextMatchHeading')}</h3>
      {nextDraw ? (
        <p className="matchup-line">{t('matches.draw.matchup', { team1, team2 })}</p>
      ) : (
        <p className="empty-state">{t('manage.notPickedYet')}</p>
      )}

      <div className="button-row">
        <button type="button" className="secondary" onClick={handleRandomize} disabled={!isActive || notEnoughPlayers}>
          {t('manage.randomize')}
        </button>
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
