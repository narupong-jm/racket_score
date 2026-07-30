import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreatePlayer } from './useCreatePlayer'
import { GENDERS, PLAYER_LEVELS, type Gender, type PlayerLevel } from './playerLevels'

export function CreatePlayerForm() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [level, setLevel] = useState<PlayerLevel>('beginner')
  const { mutate, isPending } = useCreatePlayer()

  const trimmedName = name.trim()
  const isValid = trimmedName.length > 0

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValid) return

    mutate(
      { name: trimmedName, gender, self_selected_level: level },
      {
        onSuccess: () => {
          setName('')
          setGender('male')
          setLevel('beginner')
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        {t('players.form.nameLabel')}
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        {t('players.form.genderLabel')}
        <select
          value={gender}
          onChange={(event) => setGender(event.target.value as Gender)}
        >
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {t(`gender.${g}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('players.form.levelLabel')}
        <select
          value={level}
          onChange={(event) => setLevel(event.target.value as PlayerLevel)}
        >
          {PLAYER_LEVELS.map((l) => (
            <option key={l} value={l}>
              {t(`level.${l}`)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={!isValid || isPending}>
        {t('players.form.submit')}
      </button>
    </form>
  )
}
