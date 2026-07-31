import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../features/players/usePlayers'
import { usePlayerStatsList } from '../features/players/usePlayerStatsList'
import { useCreateTournamentWithFirstDraw } from '../features/tournaments/useCreateTournamentWithFirstDraw'
import { FirstMatchDrawnPopup } from '../features/tournaments/FirstMatchDrawnPopup'
import { computePointCap } from '../features/tournaments/computePointCap'
import { TOURNAMENT_TYPES, type TournamentType } from '../features/tournaments/tournamentType'
import { getNeededPlayerCount } from '../features/matchmaking/generateNextMatch'
import { IconChoice } from '../components/IconChoice'
import { Avatar } from '../components/Avatar'
import singlesIcon from '../assets/icons/single_badminton.png'
import doublesIcon from '../assets/icons/double_badminton.png'

const TOURNAMENT_TYPE_ICONS: Record<TournamentType, string> = {
  singles: singlesIcon,
  doubles: doublesIcon,
}

export function CreateTournamentPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [type, setType] = useState<TournamentType>('singles')
  const [gamesPerMatch, setGamesPerMatch] = useState(3)
  const [pointsPerGame, setPointsPerGame] = useState(21)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data: players } = usePlayers()
  const { data: statsList } = usePlayerStatsList()
  const { mutate, isPending, data: result } = useCreateTournamentWithFirstDraw()

  const statsByPlayerId = new Map((statsList ?? []).map((s) => [s.player_id, s]))
  const playerNameById = new Map((players ?? []).map((p) => [p.id, p.name]))

  const trimmedName = name.trim()
  const cap = computePointCap(pointsPerGame)
  const neededCount = getNeededPlayerCount(type)
  const notEnoughSelected = selectedIds.size < neededCount
  const isValid =
    trimmedName.length > 0 && gamesPerMatch > 0 && pointsPerGame > 0 && !notEnoughSelected

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
    if (!isValid) return

    mutate({
      tournament: {
        name: trimmedName,
        type,
        games_per_match: gamesPerMatch,
        points_per_game: pointsPerGame,
      },
      participantIds: [...selectedIds],
    })
  }

  return (
    <section className="page">
      <h1>{t('nav.create')}</h1>
      <form className="card form-card" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">{t('tournaments.form.nameLabel')}</span>
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
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
          <label className="field">
            <span className="field-label">{t('tournaments.form.gamesPerMatchLabel')}</span>
            <input
              type="number"
              min={1}
              value={gamesPerMatch}
              onChange={(event) => setGamesPerMatch(Number(event.target.value))}
            />
          </label>

          <label className="field">
            <span className="field-label">{t('tournaments.form.pointsPerGameLabel')}</span>
            <input
              type="number"
              min={1}
              value={pointsPerGame}
              onChange={(event) => setPointsPerGame(Number(event.target.value))}
            />
          </label>
        </div>

        <p className="meta-line">{t('tournaments.form.deuceCap', { cap })}</p>

        <fieldset className="participant-checklist">
          <legend>{t('tournaments.form.participantsLegend')}</legend>
          <ul className="avatar-list">
            {(players ?? []).map((player) => {
              const stats = statsByPlayerId.get(player.id)
              const level = stats?.effective_level ?? player.self_selected_level
              return (
                <li key={player.id} className="avatar-list-item">
                  <label className="checklist-row">
                    <input
                      type="checkbox"
                      aria-label={player.name}
                      checked={selectedIds.has(player.id)}
                      onChange={() => toggleParticipant(player.id)}
                    />
                    <Avatar name={player.name} size={32} />
                    <span className="checklist-name">{player.name}</span>
                    <span className="checklist-level">{t(`level.${level}`)}</span>
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
          drawParticipants={result.drawParticipants}
          playerNameById={playerNameById}
          onGoToManageTournament={() => navigate(`/tournaments/${result.tournament.id}`)}
        />
      )}
    </section>
  )
}
