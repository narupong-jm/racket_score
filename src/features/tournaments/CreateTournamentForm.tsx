import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateTournament } from './useCreateTournament'
import { computePointCap } from './computePointCap'
import { TOURNAMENT_TYPES, type TournamentType } from './tournamentType'
import { IconChoice } from '../../components/IconChoice'
import singlesIcon from '../../assets/icons/single_badminton.png'
import doublesIcon from '../../assets/icons/double_badminton.png'

const TOURNAMENT_TYPE_ICONS: Record<TournamentType, string> = {
  singles: singlesIcon,
  doubles: doublesIcon,
}

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
