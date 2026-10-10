import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../features/players/usePlayers'
import { usePlayerStatsList } from '../features/players/usePlayerStatsList'
import { useCreateTournamentWithFirstDraw } from '../features/tournaments/useCreateTournamentWithFirstDraw'
import { FirstMatchDrawnPopup } from '../features/tournaments/FirstMatchDrawnPopup'
import { computePointCap } from '../features/tournaments/computePointCap'
import {
  TOURNAMENT_TYPES,
  type TournamentType,
} from '../features/tournaments/tournamentType'
import { getNeededPlayerCount } from '../features/matchmaking/generateNextMatch'
import { setQueue, type QueuedMatch } from '../lib/matchQueueStore'
import { IconChoice } from '../components/IconChoice'
import { NumberStepper } from '../components/NumberStepper'
import { Avatar } from '../components/Avatar'
import type { RosterPlayer } from '../components/DrawSlotSelect'
import { useSport } from '../features/sport/useSport'
import singlesIcon from '../assets/icons/single_badminton.png'
import doublesIcon from '../assets/icons/double_badminton.png'

const TOURNAMENT_TYPE_ICONS: Record<TournamentType, string> = {
  singles: singlesIcon,
  doubles: doublesIcon,
}

const TENNIS_POINTS_PER_GAME = 4
const MIN_COURTS = 1
const MAX_COURTS = 8

export function CreateTournamentPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { sport } = useSport()

  const [name, setName] = useState('')
  const [type, setType] = useState<TournamentType>('singles')
  const [gamesPerMatch, setGamesPerMatch] = useState<number | ''>('')
  const [pointsPerGame, setPointsPerGame] = useState<number | ''>('')
  const [courtCount, setCourtCount] = useState<number | ''>(MIN_COURTS)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [submittedType, setSubmittedType] = useState<TournamentType>('singles')
  const [submittedParticipantIds, setSubmittedParticipantIds] = useState<
    string[]
  >([])

  const { data: players } = usePlayers()
  const { data: statsList } = usePlayerStatsList(sport!)
  const { mutate, isPending, data: result } = useCreateTournamentWithFirstDraw()

  const statsByPlayerId = new Map(
    (statsList ?? []).map((s) => [s.player_id, s]),
  )
  const rosterPlayers: RosterPlayer[] = submittedParticipantIds.flatMap(
    (id) => {
      const player = players?.find((p) => p.id === id)
      if (!player || (player.gender !== 'male' && player.gender !== 'female'))
        return []
      return [{ id: player.id, name: player.name, gender: player.gender }]
    },
  )

  const isTennis = sport === 'tennis'
  const effectivePointsPerGame = isTennis
    ? TENNIS_POINTS_PER_GAME
    : pointsPerGame

  const trimmedName = name.trim()
  const cap =
    effectivePointsPerGame === ''
      ? null
      : computePointCap(effectivePointsPerGame)
  const neededCount = getNeededPlayerCount(type)
  const notEnoughSelected = selectedIds.size < neededCount
  const isValid =
    trimmedName.length > 0 &&
    gamesPerMatch !== '' &&
    Number.isInteger(gamesPerMatch) &&
    gamesPerMatch > 0 &&
    effectivePointsPerGame !== '' &&
    Number.isInteger(effectivePointsPerGame) &&
    effectivePointsPerGame > 0 &&
    courtCount !== '' &&
    Number.isInteger(courtCount) &&
    courtCount >= MIN_COURTS &&
    !notEnoughSelected

  function toggleParticipant(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValid || !sport) return

    setSubmittedType(type)
    setSubmittedParticipantIds([...selectedIds])
    mutate({
      tournament: {
        name: trimmedName,
        type,
        games_per_match: gamesPerMatch,
        points_per_game: effectivePointsPerGame,
        sport,
        court_count: courtCount,
      },
      participantIds: [...selectedIds],
    })
  }

  function handleConfirmFirstMatches(matches: QueuedMatch[]) {
    if (!result) return
    setQueue(result.tournament.id, matches)
    navigate(`/tournaments/${result.tournament.id}`)
  }

  function handleDismissPopup(matches: QueuedMatch[]) {
    if (!result) return
    // The tournament already exists, so closing the popup must not throw the
    // drawn (and possibly hand-edited) matches away.
    if (matches.length > 0) setQueue(result.tournament.id, matches)
    navigate(`/tournaments/${result.tournament.id}`)
  }

  return (
    <section className="page">
      <h1>{t('nav.create')}</h1>
      <form className="card form-card" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">{t('tournaments.form.nameLabel')}</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <IconChoice<TournamentType>
          legend={t('tournaments.form.typeLabel')}
          name="type"
          options={TOURNAMENT_TYPES.map((ty) => ({
            value: ty,
            label: t(`tournamentType.${ty}`),
            icon: TOURNAMENT_TYPE_ICONS[ty],
          }))}
          value={type}
          onChange={setType}
        />

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="games-per-match">
              {t('tournaments.form.gamesPerMatchLabel')}
            </label>
            <NumberStepper
              id="games-per-match"
              value={gamesPerMatch}
              onChange={setGamesPerMatch}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="points-per-game">
              {t('tournaments.form.pointsPerGameLabel')}
            </label>
            <NumberStepper
              id="points-per-game"
              value={effectivePointsPerGame}
              onChange={setPointsPerGame}
              disabled={isTennis}
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="court-count">
            {t('tournaments.form.courtsLabel')}
          </label>
          <NumberStepper
            id="court-count"
            value={courtCount}
            onChange={setCourtCount}
            min={MIN_COURTS}
            max={MAX_COURTS}
          />
        </div>

        {cap != null && (
          <p className="meta-line">{t('tournaments.form.deuceCap', { cap })}</p>
        )}

        <fieldset className="participant-checklist">
          <legend>{t('tournaments.form.participantsLegend')}</legend>
          <ul className="avatar-list">
            {(players ?? []).map((player) => {
              const stats = statsByPlayerId.get(player.id)
              const level = stats?.effective_level ?? stats?.self_selected_level
              const hasLevel = statsList === undefined || level != null
              return (
                <li key={player.id} className="avatar-list-item">
                  <label
                    className="checklist-row"
                    title={
                      hasLevel
                        ? undefined
                        : t('tournaments.form.participantMissingLevel')
                    }
                  >
                    <input
                      type="checkbox"
                      aria-label={player.name}
                      checked={selectedIds.has(player.id)}
                      disabled={!hasLevel}
                      onChange={() => toggleParticipant(player.id)}
                    />
                    <Avatar name={player.name} size={32} />
                    <span className="checklist-name">{player.name}</span>
                    <span className="checklist-level">
                      {level ? t(`level.${level}`) : t('member.levelNotSet')}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>

        {notEnoughSelected && (
          <p className="field-error">
            {t('tournaments.form.notEnoughSelected', {
              needed: neededCount,
              selected: selectedIds.size,
            })}
          </p>
        )}

        <button type="submit" disabled={!isValid || isPending}>
          {t('tournaments.form.submit')}
        </button>
      </form>

      {result && (
        <FirstMatchDrawnPopup
          open
          matches={result.drawnMatches}
          matchType={submittedType}
          rosterPlayers={rosterPlayers}
          onConfirm={handleConfirmFirstMatches}
          onDismiss={handleDismissPopup}
        />
      )}
    </section>
  )
}
