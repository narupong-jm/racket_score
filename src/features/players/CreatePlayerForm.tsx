import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreatePlayer } from './useCreatePlayer'
import { GENDERS, PLAYER_LEVELS, type Gender, type PlayerLevel } from './playerLevels'
import { IconChoice } from '../../components/IconChoice'
import maleIcon from '../../assets/icons/male.png'
import femaleIcon from '../../assets/icons/female.png'

const GENDER_ICONS: Record<Gender, string> = {
  male: maleIcon,
  female: femaleIcon,
}

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
      <label className="field">
        <span className="field-label">{t('players.form.nameLabel')}</span>
        <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <IconChoice<Gender>
        legend={t('players.form.genderLabel')}
        name="gender"
        options={GENDERS.map((g) => ({ value: g, label: t(`gender.${g}`), icon: GENDER_ICONS[g] }))}
        value={gender}
        onChange={setGender}
      />
      <label className="field">
        <span className="field-label">{t('players.form.levelLabel')}</span>
        <select value={level} onChange={(event) => setLevel(event.target.value as PlayerLevel)}>
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
