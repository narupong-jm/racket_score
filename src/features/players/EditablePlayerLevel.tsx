import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpdatePlayer } from './useUpdatePlayer'
import { PLAYER_LEVELS, type PlayerLevel } from './playerLevels'
import type { Player, PlayerStats } from './playersApi'

interface EditablePlayerLevelProps {
  player: Player
  stats: PlayerStats | undefined
}

export function EditablePlayerLevel({ player, stats }: EditablePlayerLevelProps) {
  const { t } = useTranslation()
  const totalMatches = stats?.total_matches ?? 0
  const isEditable = totalMatches < 3
  const [level, setLevel] = useState<PlayerLevel>(player.self_selected_level as PlayerLevel)
  const { mutate, isPending } = useUpdatePlayer()

  if (!isEditable) {
    return <span>{t(`level.${stats?.effective_level ?? player.self_selected_level}`)}</span>
  }

  return (
    <span>
      <select
        aria-label={t('players.editableLevel.ariaLabel', { name: player.name })}
        value={level}
        onChange={(event) => setLevel(event.target.value as PlayerLevel)}
      >
        {PLAYER_LEVELS.map((l) => (
          <option key={l} value={l}>
            {t(`level.${l}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={isPending || level === player.self_selected_level}
        onClick={() => mutate({ id: player.id, updates: { self_selected_level: level } })}
      >
        {t('players.editableLevel.save')}
      </button>
    </span>
  )
}
