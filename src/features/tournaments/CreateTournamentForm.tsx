import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateTournament } from './useCreateTournament'
import { computePointCap } from './computePointCap'

const TOURNAMENT_TYPES = ['singles', 'doubles'] as const
type TournamentType = (typeof TOURNAMENT_TYPES)[number]

export function CreateTournamentForm() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [type, setType] = useState<TournamentType>('singles')
  const [gamesPerMatch, setGamesPerMatch] = useState(3)
  const [pointsPerGame, setPointsPerGame] = useState(21)
  const { mutate, isPending } = useCreateTournament()

  const trimmedName = name.trim()
  const isValid = trimmedName.length > 0 && gamesPerMatch > 0 && pointsPerGame > 0
  const cap = computePointCap(pointsPerGame)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValid) return

    mutate(
      {
        name: trimmedName,
        type,
        games_per_match: gamesPerMatch,
        points_per_game: pointsPerGame,
      },
      {
        onSuccess: () => {
          setName('')
          setType('singles')
          setGamesPerMatch(3)
          setPointsPerGame(21)
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        {t('tournaments.form.nameLabel')}
        <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        {t('tournaments.form.typeLabel')}
        <select
          value={type}
          onChange={(event) => setType(event.target.value as TournamentType)}
        >
          {TOURNAMENT_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`tournamentType.${ty}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('tournaments.form.gamesPerMatchLabel')}
        <input
          type="number"
          min={1}
          value={gamesPerMatch}
          onChange={(event) => setGamesPerMatch(Number(event.target.value))}
        />
      </label>
      <label>
        {t('tournaments.form.pointsPerGameLabel')}
        <input
          type="number"
          min={1}
          value={pointsPerGame}
          onChange={(event) => setPointsPerGame(Number(event.target.value))}
        />
      </label>
      <p>{t('tournaments.form.deuceCap', { cap })}</p>
      <button type="submit" disabled={!isValid || isPending}>
        {t('tournaments.form.submit')}
      </button>
    </form>
  )
}
