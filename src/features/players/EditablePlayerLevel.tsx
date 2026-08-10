import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpdatePlayer } from './useUpdatePlayer'
import { PLAYER_LEVELS, type PlayerLevel } from './playerLevels'
import type { PlayerStats } from './playersApi'
import type { Sport } from '../sport/sportTypes'

interface EditablePlayerLevelProps {
  playerId: string
  playerName: string
  stats: PlayerStats | undefined
  sport: Sport
}

export function EditablePlayerLevel({
  playerId,
  playerName,
  stats,
  sport,
}: EditablePlayerLevelProps) {
  const { t } = useTranslation()
  const currentLevel = stats?.self_selected_level as
    PlayerLevel | null | undefined
  const totalMatches = stats?.total_matches ?? 0
  const isNotSet = stats !== undefined && currentLevel == null
  const isEditable = totalMatches < 3
  const [level, setLevel] = useState<PlayerLevel>(
    currentLevel ?? PLAYER_LEVELS[0],
  )
  const { mutate, isPending } = useUpdatePlayer()

  if (stats === undefined) return null

  if (!isEditable) {
    return <span>{t(`level.${stats?.effective_level ?? currentLevel}`)}</span>
  }

  return (
    <span>
      {isNotSet && (
        <span className="field-hint">{t('member.levelNotSet')}</span>
      )}
      <select
        aria-label={t('players.editableLevel.ariaLabel', {
          name: playerName,
        })}
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
        disabled={isPending || (!isNotSet && level === currentLevel)}
        onClick={() =>
          mutate({
            id: playerId,
            updates: { sport, self_selected_level: level },
          })
        }
      >
        {t('players.editableLevel.save')}
      </button>
    </span>
  )
}
