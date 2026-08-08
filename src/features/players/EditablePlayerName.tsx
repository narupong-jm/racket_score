import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpdatePlayer } from './useUpdatePlayer'
import type { Player } from './playersApi'

interface EditablePlayerNameProps {
  player: Player
}

export function EditablePlayerName({ player }: EditablePlayerNameProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(player.name)
  const { mutate, isPending } = useUpdatePlayer()

  if (!isEditing) {
    return (
      <span>
        {player.name}{' '}
        <button
          type="button"
          aria-label={t('players.editableName.editAriaLabel', {
            name: player.name,
          })}
          onClick={() => {
            setName(player.name)
            setIsEditing(true)
          }}
        >
          {t('players.editableName.edit')}
        </button>
      </span>
    )
  }

  const trimmed = name.trim()

  return (
    <span>
      <input
        type="text"
        aria-label={t('players.editableName.inputAriaLabel', {
          name: player.name,
        })}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button
        type="button"
        disabled={isPending || trimmed === player.name || trimmed.length === 0}
        onClick={() =>
          mutate(
            { id: player.id, updates: { name: trimmed } },
            { onSuccess: () => setIsEditing(false) },
          )
        }
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
  )
}
