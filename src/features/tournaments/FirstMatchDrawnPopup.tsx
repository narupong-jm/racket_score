import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import type { GeneratedMatchParticipant } from '../matchmaking/generateNextMatch'

interface FirstMatchDrawnPopupProps {
  open: boolean
  drawParticipants: GeneratedMatchParticipant[] | null
  playerNameById: Map<string, string>
  onGoToManageTournament: () => void
}

export function FirstMatchDrawnPopup({
  open,
  drawParticipants,
  playerNameById,
  onGoToManageTournament,
}: FirstMatchDrawnPopupProps) {
  const { t } = useTranslation()

  return (
    <Modal open={open} onClose={onGoToManageTournament}>
      <h2>{t('tournaments.firstMatchPopup.heading')}</h2>
      {drawParticipants ? (
        <p>
          {t('tournaments.firstMatchPopup.body')}{' '}
          {t('matches.draw.matchup', {
            team1: teamNames(drawParticipants, 1, playerNameById),
            team2: teamNames(drawParticipants, 2, playerNameById),
          })}
        </p>
      ) : (
        <p>{t('tournaments.firstMatchPopup.notDrawn')}</p>
      )}
      <div className="modal-actions">
        <button type="button" onClick={onGoToManageTournament}>
          {t('tournaments.firstMatchPopup.confirm')}
        </button>
      </div>
    </Modal>
  )
}

function teamNames(
  participants: GeneratedMatchParticipant[],
  team: 1 | 2,
  playerNameById: Map<string, string>,
): string {
  return participants
    .filter((p) => p.team === team)
    .map((p) => playerNameById.get(p.playerId) ?? p.playerId)
    .join(' & ')
}
