import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpdatePlayer } from './useUpdatePlayer'
import { usePlayers } from './usePlayers'
import { findNameConflict } from './playerMembership'
import { isNameTakenError } from './playerErrors'
import type { Player } from './playersApi'

interface EditablePlayerNameProps {
  player: Player
}

export function EditablePlayerName({ player }: EditablePlayerNameProps) {
  const { t } = useTranslation()
  const { data: players } = usePlayers()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(player.name)
  const [serverNameTaken, setServerNameTaken] = useState(false)
  const { mutate, isPending } = useUpdatePlayer()

  if (!isEditing) {
    return (
      <span className="editable-name">
        <span className="editable-name-text">{player.name}</span>
        <button
          type="button"
          aria-label={t('players.editableName.editAriaLabel', {
            name: player.name,
          })}
          onClick={() => {
            setName(player.name)
            setServerNameTaken(false)
            setIsEditing(true)
          }}
        >
          {t('players.editableName.edit')}
        </button>
      </span>
    )
  }

  const trimmed = name.trim()
  // Pre-submit check, same reasoning as CreatePlayerForm: the passphrase
  // prompt fires before the write, so without this the organizer would type
  // the passphrase only to have the write rejected. Excludes this player's
  // own id so renaming to a case/padding variant of their current name is
  // never flagged as a conflict with themselves.
  const isDuplicate =
    trimmed.length > 0 &&
    findNameConflict(players ?? [], trimmed, player.id) !== null
  const nameTaken = isDuplicate || serverNameTaken

  function handleSave() {
    if (trimmed.length === 0 || isDuplicate) return
    mutate(
      { id: player.id, updates: { name: trimmed } },
      {
        onSuccess: () => setIsEditing(false),
        onError: (error) => {
          if (isNameTakenError(error)) setServerNameTaken(true)
        },
      },
    )
  }

  return (
    <>
      <span className="editable-name">
        <input
          type="text"
          className="editable-name-text"
          aria-label={t('players.editableName.inputAriaLabel', {
            name: player.name,
          })}
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setServerNameTaken(false)
          }}
        />
        <button
          type="button"
          disabled={
            isPending ||
            isDuplicate ||
            trimmed === player.name ||
            trimmed.length === 0
          }
          onClick={handleSave}
        >
          {t('players.editableName.save')}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setIsEditing(false)}
        >
          {t('manage.cancel')}
        </button>
      </span>
      {nameTaken && (
        <p className="field-error">{t('players.editableName.nameTaken')}</p>
      )}
    </>
  )
}
