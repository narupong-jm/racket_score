import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreatePlayer } from './useCreatePlayer'
import { usePlayers } from './usePlayers'
import { findNameConflict } from './playerMembership'
import { isNameTakenError } from './playerErrors'
import {
  GENDERS,
  PLAYER_LEVELS,
  type Gender,
  type PlayerLevel,
} from './playerLevels'
import { IconChoice } from '../../components/IconChoice'
import { useSport } from '../sport/useSport'
import maleIcon from '../../assets/icons/male.png'
import femaleIcon from '../../assets/icons/female.png'

const GENDER_ICONS: Record<Gender, string> = {
  male: maleIcon,
  female: femaleIcon,
}

export function CreatePlayerForm() {
  const { t } = useTranslation()
  const { sport } = useSport()
  const { data: players } = usePlayers()
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [level, setLevel] = useState<PlayerLevel>('beginner')
  const [serverNameTaken, setServerNameTaken] = useState(false)
  const { mutate, isPending } = useCreatePlayer()

  const trimmedName = name.trim()
  const isValid = trimmedName.length > 0
  // Pre-submit check: the passphrase prompt fires before the write, so
  // without this the organizer would type the passphrase only to have the
  // write rejected.
  const isDuplicate =
    isValid && findNameConflict(players ?? [], trimmedName) !== null
  const nameTaken = isDuplicate || serverNameTaken

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValid || !sport || isDuplicate) return

    mutate(
      { name: trimmedName, gender, sport, self_selected_level: level },
      {
        onSuccess: () => {
          setName('')
          setGender('male')
          setLevel('beginner')
          setServerNameTaken(false)
        },
        onError: (error) => {
          if (isNameTakenError(error)) setServerNameTaken(true)
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="field">
        <span className="field-label">{t('players.form.nameLabel')}</span>
        <input
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setServerNameTaken(false)
          }}
        />
      </label>
      {nameTaken && (
        <p className="field-error">{t('players.form.nameTaken')}</p>
      )}
      <IconChoice<Gender>
        legend={t('players.form.genderLabel')}
        name="gender"
        options={GENDERS.map((g) => ({
          value: g,
          label: t(`gender.${g}`),
          icon: GENDER_ICONS[g],
        }))}
        value={gender}
        onChange={setGender}
      />
      <label className="field">
        <span className="field-label">{t('players.form.levelLabel')}</span>
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
      <button type="submit" disabled={!isValid || isDuplicate || isPending}>
        {t('players.form.submit')}
      </button>
    </form>
  )
}
