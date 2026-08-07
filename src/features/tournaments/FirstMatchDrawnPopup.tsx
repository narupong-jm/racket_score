import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import {
  DrawSlotSelect,
  type RosterPlayer,
} from '../../components/DrawSlotSelect'
import { isMixedDoublesRuleViolated } from '../matchmaking/isMixedDoublesRuleViolated'
import type { GeneratedMatchParticipant } from '../matchmaking/generateNextMatch'
import type { MatchType } from '../matchmaking/types'

interface FirstMatchDrawnPopupProps {
  open: boolean
  drawParticipants: GeneratedMatchParticipant[] | null
  matchType: MatchType
  rosterPlayers: RosterPlayer[]
  onConfirm: (
    participants: GeneratedMatchParticipant[],
    manuallyAdjusted: boolean,
  ) => void
  onDismiss: () => void
  isConfirming: boolean
  confirmError: boolean
}

export function FirstMatchDrawnPopup({
  open,
  drawParticipants,
  matchType,
  rosterPlayers,
  onConfirm,
  onDismiss,
  isConfirming,
  confirmError,
}: FirstMatchDrawnPopupProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(drawParticipants)
  const [editing, setEditing] = useState(false)
  const [manuallyAdjusted, setManuallyAdjusted] = useState(false)

  const playerNameById = new Map(rosterPlayers.map((r) => [r.id, r.name]))

  function handleSwap(oldPlayerId: string, newPlayerId: string) {
    if (!draft || oldPlayerId === newPlayerId) return
    setDraft(
      draft.map((p) =>
        p.playerId === oldPlayerId ? { ...p, playerId: newPlayerId } : p,
      ),
    )
    setManuallyAdjusted(true)
  }

  function handleConfirmClick() {
    if (!draft) {
      onDismiss()
      return
    }
    onConfirm(draft, manuallyAdjusted)
  }

  const mixedDoublesViolation =
    matchType === 'doubles' && draft
      ? isMixedDoublesRuleViolated(
          draft.map((p) => {
            const roster = rosterPlayers.find((r) => r.id === p.playerId)
            return {
              id: p.playerId,
              gender: roster?.gender ?? 'male',
              skillValue: 0,
              matchesPlayedInTournament: 0,
            }
          }),
          draft.filter((p) => p.team === 1).map((p) => p.playerId),
        )
      : false

  return (
    <Modal open={open} onClose={onDismiss}>
      <h2>{t('tournaments.firstMatchPopup.heading')}</h2>
      {draft ? (
        <>
          {!editing && (
            <p>
              {t('tournaments.firstMatchPopup.body')}{' '}
              {t('matches.draw.matchup', {
                team1: teamNames(draft, 1, playerNameById),
                team2: teamNames(draft, 2, playerNameById),
              })}
            </p>
          )}
          {editing && (
            <div className="draw-edit-teams">
              <div className="draw-edit-team">
                {draft
                  .filter((p) => p.team === 1)
                  .map((p, i) => (
                    <DrawSlotSelect
                      key={p.playerId}
                      participant={p}
                      index={i}
                      draw={draft}
                      rosterPlayers={rosterPlayers}
                      onSwap={handleSwap}
                    />
                  ))}
              </div>
              <span className="round-vs">vs</span>
              <div className="draw-edit-team">
                {draft
                  .filter((p) => p.team === 2)
                  .map((p, i) => (
                    <DrawSlotSelect
                      key={p.playerId}
                      participant={p}
                      index={i}
                      draw={draft}
                      rosterPlayers={rosterPlayers}
                      onSwap={handleSwap}
                    />
                  ))}
              </div>
            </div>
          )}
          {manuallyAdjusted && mixedDoublesViolation && (
            <p className="field-warning">{t('manage.mixedDoublesWarning')}</p>
          )}
          {confirmError && (
            <p className="field-error">{t('manage.drawFailed')}</p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? t('manage.doneEditingDraw') : t('manage.editDraw')}
            </button>
            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={isConfirming}
            >
              {t('tournaments.firstMatchPopup.confirm')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>{t('tournaments.firstMatchPopup.notDrawn')}</p>
          <div className="modal-actions">
            <button type="button" onClick={onDismiss}>
              {t('tournaments.firstMatchPopup.confirm')}
            </button>
          </div>
        </>
      )}
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
