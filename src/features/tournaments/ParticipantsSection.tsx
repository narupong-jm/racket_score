import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlayers } from '../players/usePlayers'
import { GENDERS, PLAYER_LEVELS, type Gender, type PlayerLevel } from '../players/playerLevels'
import { useParticipants } from './useParticipants'
import { useAddParticipant } from './useAddParticipant'
import { useCreatePlayerAndAddParticipant } from './useCreatePlayerAndAddParticipant'

interface ParticipantsSectionProps {
  tournamentId: string
  isActive: boolean
}

export function ParticipantsSection({ tournamentId, isActive }: ParticipantsSectionProps) {
  const { t } = useTranslation()
  const { data: players } = usePlayers()
  const { data: participants } = useParticipants(tournamentId)
  const addParticipant = useAddParticipant(tournamentId)
  const createAndAdd = useCreatePlayerAndAddParticipant(tournamentId)

  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newGender, setNewGender] = useState<Gender>('male')
  const [newLevel, setNewLevel] = useState<PlayerLevel>('beginner')

  const participantIds = new Set((participants ?? []).map((p) => p.player_id))
  const playersById = new Map((players ?? []).map((p) => [p.id, p]))

  const searchTerm = search.trim().toLowerCase()
  const searchResults =
    searchTerm.length === 0
      ? []
      : (players ?? []).filter(
          (p) => !participantIds.has(p.id) && p.name.toLowerCase().includes(searchTerm),
        )

  const trimmedNewName = newName.trim()

  function handleCreateAndAdd(event: FormEvent) {
    event.preventDefault()
    if (!trimmedNewName) return

    createAndAdd.mutate(
      { name: trimmedNewName, gender: newGender, self_selected_level: newLevel },
      {
        onSuccess: () => {
          setNewName('')
          setNewGender('male')
          setNewLevel('beginner')
        },
      },
    )
  }

  return (
    <div>
      <h4>{t('tournaments.participants.currentHeading')}</h4>
      {!participants || participants.length === 0 ? (
        <p>{t('tournaments.participants.empty')}</p>
      ) : (
        <ul>
          {participants.map((p) => (
            <li key={p.player_id}>{playersById.get(p.player_id)?.name ?? p.player_id}</li>
          ))}
        </ul>
      )}

      <h4>{t('tournaments.participants.addExistingHeading')}</h4>
      <label>
        {t('tournaments.participants.searchLabel')}
        <input value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <ul>
        {searchResults.map((p) => (
          <li key={p.id}>
            {p.name}
            <button
              type="button"
              onClick={() => addParticipant.mutate(p.id)}
              disabled={addParticipant.isPending || !isActive}
            >
              {t('tournaments.participants.add')}
            </button>
          </li>
        ))}
      </ul>

      <h4>{t('tournaments.participants.createHeading')}</h4>
      <form onSubmit={handleCreateAndAdd}>
        <label>
          {t('tournaments.participants.newNameLabel')}
          <input value={newName} onChange={(event) => setNewName(event.target.value)} />
        </label>
        <label>
          {t('tournaments.participants.newGenderLabel')}
          <select
            value={newGender}
            onChange={(event) => setNewGender(event.target.value as Gender)}
          >
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {t(`gender.${g}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('tournaments.participants.newLevelLabel')}
          <select
            value={newLevel}
            onChange={(event) => setNewLevel(event.target.value as PlayerLevel)}
          >
            {PLAYER_LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`level.${l}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={!trimmedNewName || createAndAdd.isPending || !isActive}>
          {t('tournaments.participants.createAndAdd')}
        </button>
      </form>
    </div>
  )
}
