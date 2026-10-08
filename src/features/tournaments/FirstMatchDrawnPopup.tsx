import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import {
  DrawSlotSelect,
  type RosterPlayer,
} from '../../components/DrawSlotSelect'
import { isMixedDoublesRuleViolated } from '../matchmaking/isMixedDoublesRuleViolated'
import type { GeneratedMatchParticipant } from '../matchmaking/generateNextMatch'
import type { PlannedMatch } from '../matchmaking/plannedMatches'
import type { QueuedMatch } from '../../lib/matchQueueStore'
import type { MatchType } from '../matchmaking/types'

interface FirstMatchDrawnPopupProps {
  open: boolean
  /** The drawn matches in queue order; empty when nothing could be drawn. */
  matches: PlannedMatch[]
  /** Players appearing in more than one drawn match (roster too small). */
  reusedPlayerIds: string[]
  matchType: MatchType
  rosterPlayers: RosterPlayer[]
  onConfirm: (matches: QueuedMatch[]) => void
  onDismiss: () => void
}

export function FirstMatchDrawnPopup({
  open,
  matches,
  reusedPlayerIds,
  matchType,
  rosterPlayers,
  onConfirm,
  onDismiss,
}: FirstMatchDrawnPopupProps) {
  const { t } = useTranslation()
  const [drafts, setDrafts] = useState<QueuedMatch[]>(() =>
    matches.map((participants) => ({ participants, manuallyAdjusted: false })),
  )
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const playerNameById = new Map(rosterPlayers.map((r) => [r.id, r.name]))

  function handleSwap(index: number, oldPlayerId: string, newPlayerId: string) {
    if (oldPlayerId === newPlayerId) return
    setDrafts((prev) =>
      prev.map((m, i) =>
        i === index
          ? {
              participants: m.participants.map((p) =>
                p.playerId === oldPlayerId
                  ? { ...p, playerId: newPlayerId }
                  : p,
              ),
              manuallyAdjusted: true,
            }
          : m,
      ),
    )
  }

  function violatesMixedDoubles(participants: PlannedMatch): boolean {
    if (matchType !== 'doubles') return false
    return isMixedDoublesRuleViolated(
      participants.map((p) => {
        const roster = rosterPlayers.find((r) => r.id === p.playerId)
        return {
          id: p.playerId,
          gender: roster?.gender ?? 'male',
          skillValue: 0,
          matchesPlayedInTournament: 0,
        }
      }),
      participants.filter((p) => p.team === 1).map((p) => p.playerId),
    )
  }

  const reusedNames = reusedPlayerIds
    .map((id) => playerNameById.get(id) ?? id)
    .join(', ')

  if (drafts.length === 0) {
    return (
      <Modal open={open} onClose={onDismiss}>
        <h2>{t('tournaments.firstMatchPopup.heading')}</h2>
        <p>{t('tournaments.firstMatchPopup.notDrawn')}</p>
        <div className="modal-actions">
          <button type="button" onClick={onDismiss}>
            {t('tournaments.firstMatchPopup.confirm')}
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onDismiss}>
      <h2>
        {t('tournaments.firstMatchPopup.titleMulti', { count: drafts.length })}
      </h2>
      <ol className="first-match-list">
        {drafts.map((draft, index) => {
          const isEditing = editingIndex === index
          return (
            <li key={index} className="first-match-row">
              <div className="first-match-row-head">
                <span className="first-match-number">{index + 1}.</span>
                <span className="first-match-matchup">
                  {t('matches.draw.matchup', {
                    team1: teamNames(draft.participants, 1, playerNameById),
                    team2: teamNames(draft.participants, 2, playerNameById),
                  })}
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditingIndex(isEditing ? null : index)}
                >
                  {isEditing
                    ? t('tournaments.firstMatchPopup.rowDone')
                    : t('tournaments.firstMatchPopup.rowEdit')}
                </button>
              </div>
              {isEditing && (
                <div className="draw-edit-teams">
                  {([1, 2] as const).map((team) => (
                    <Fragment key={team}>
                      {team === 2 && <span className="round-vs">vs</span>}
                      <div className="draw-edit-team">
                        {draft.participants
                          .filter((p) => p.team === team)
                          .map((p, i) => (
                            <DrawSlotSelect
                              key={p.playerId}
                              participant={p}
                              index={i}
                              draw={draft.participants}
                              rosterPlayers={rosterPlayers}
                              onSwap={(oldId, newId) =>
                                handleSwap(index, oldId, newId)
                              }
                            />
                          ))}
                      </div>
                    </Fragment>
                  ))}
                </div>
              )}
              {draft.manuallyAdjusted &&
                violatesMixedDoubles(draft.participants) && (
                  <p className="field-warning">
                    {t('manage.mixedDoublesWarning')}
                  </p>
                )}
            </li>
          )
        })}
      </ol>
      {reusedPlayerIds.length > 0 && (
        <p className="field-warning">
          {t('tournaments.firstMatchPopup.reusedWarning', {
            names: reusedNames,
          })}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" onClick={() => onConfirm(drafts)}>
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
