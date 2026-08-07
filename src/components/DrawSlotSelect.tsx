import { useTranslation } from 'react-i18next'
import type { GeneratedMatchParticipant } from '../features/matchmaking/generateNextMatch'

export interface RosterPlayer {
  id: string
  name: string
  gender: 'male' | 'female'
}

interface DrawSlotSelectProps {
  participant: GeneratedMatchParticipant
  index: number
  draw: GeneratedMatchParticipant[]
  rosterPlayers: RosterPlayer[]
  onSwap: (oldPlayerId: string, newPlayerId: string) => void
}

/**
 * A single drawn player's inline edit control: a <select> offering every
 * roster player not already occupying another slot in this draw (plus the
 * slot's own current player). Used for editing a drawn-but-not-yet-started
 * match, both in the Manage Tournament screen's Next match card and the
 * tournament-creation first-match popup.
 */
export function DrawSlotSelect({
  participant,
  index,
  draw,
  rosterPlayers,
  onSwap,
}: DrawSlotSelectProps) {
  const { t } = useTranslation()
  const usedElsewhere = new Set(
    draw
      .filter((p) => p.playerId !== participant.playerId)
      .map((p) => p.playerId),
  )
  const options = rosterPlayers.filter(
    (r) => r.id === participant.playerId || !usedElsewhere.has(r.id),
  )

  return (
    <select
      value={participant.playerId}
      aria-label={t('manage.editDrawSlotLabel', {
        team: participant.team,
        n: index + 1,
      })}
      onChange={(event) => onSwap(participant.playerId, event.target.value)}
    >
      {options.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  )
}
