import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import {
  DrawSlotSelect,
  type RosterPlayer,
} from '../../components/DrawSlotSelect'
import { useDrawInputs } from '../matches/useDrawInputs'
import type { MatchQueueDrafts } from '../matches/useMatchQueueDrafts'
import { getNeededPlayerCount } from '../matchmaking/generateNextMatch'
import { isMixedDoublesRuleViolated } from '../matchmaking/isMixedDoublesRuleViolated'
import { drawMatches, type PlannedMatch } from '../matchmaking/plannedMatches'
import type { MatchType } from '../matchmaking/types'
import type { Sport } from '../sport/sportTypes'
import { queuedTeamNames } from './queuedMatchup'

interface QueueCardProps {
  tournamentId: string
  sport: Sport
  matchType: MatchType
  isActive: boolean
  /** courts + 1 */
  maxQueue: number
  drafts: MatchQueueDrafts
  /** Rosters of every match in progress on a court. */
  inProgressRosters: PlannedMatch[]
  rosterPlayers: RosterPlayer[]
  playerNameById: Map<string, string>
  /** A Start is in flight; its success shifts the queue head. */
  busy: boolean
}

/**
 * The tournament's shared queue of drawn-but-not-started matches (max
 * courts + 1): Randomize / Fill queue draw with in-progress and queued
 * matches counted as planned (SPEC §5); each entry can be edited or removed.
 */
export function QueueCard({
  tournamentId,
  sport,
  matchType,
  isActive,
  maxQueue,
  drafts,
  inProgressRosters,
  rosterPlayers,
  playerNameById,
  busy,
}: QueueCardProps) {
  const { t } = useTranslation()
  const { data: drawInputs } = useDrawInputs(tournamentId, sport)
  const { queue, add, remove, update } = drafts
  const [drawFailed, setDrawFailed] = useState(false)
  const [reusedPlayerIds, setReusedPlayerIds] = useState<string[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const neededCount = getNeededPlayerCount(matchType)
  const participantCount = drawInputs?.candidates.length ?? 0
  const notEnoughPlayers =
    drawInputs !== undefined && participantCount < neededCount
  const isFull = queue.length >= maxQueue
  const drawDisabled = !isActive || notEnoughPlayers || isFull || busy

  function handleDraw(count: number) {
    if (!drawInputs || count <= 0) return
    const result = drawMatches(
      matchType,
      drawInputs.candidates,
      drawInputs.pairingHistory,
      [...inProgressRosters, ...queue.map((m) => m.participants)],
      count,
    )
    for (const participants of result.matches) {
      add({ participants, manuallyAdjusted: false })
    }
    setDrawFailed(result.matches.length === 0)
    setReusedPlayerIds(result.reusedPlayerIds)
  }

  function handleRemove(index: number) {
    remove(index)
    setReusedPlayerIds([])
  }

  const editingEntry = editingIndex === null ? undefined : queue[editingIndex]

  function handleSwap(oldPlayerId: string, newPlayerId: string) {
    if (editingIndex === null || !editingEntry || oldPlayerId === newPlayerId)
      return
    update(editingIndex, {
      participants: editingEntry.participants.map((p) =>
        p.playerId === oldPlayerId ? { ...p, playerId: newPlayerId } : p,
      ),
      manuallyAdjusted: true,
    })
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

  const inProgressCountById = new Map<string, number>()
  for (const roster of inProgressRosters) {
    for (const { playerId } of roster) {
      inProgressCountById.set(
        playerId,
        (inProgressCountById.get(playerId) ?? 0) + 1,
      )
    }
  }
  const matchesPlayedById = new Map(
    (drawInputs?.candidates ?? []).map((c) => [
      c.id,
      c.matchesPlayedInTournament,
    ]),
  )
  const gamesPlayedRows = rosterPlayers
    .map((r) => ({
      id: r.id,
      name: r.name,
      gamesPlayed:
        (matchesPlayedById.get(r.id) ?? 0) +
        (inProgressCountById.get(r.id) ?? 0),
    }))
    .sort((a, b) => a.gamesPlayed - b.gamesPlayed)

  const reusedNames = reusedPlayerIds
    .map((id) => playerNameById.get(id) ?? id)
    .join(', ')

  return (
    <section className="card">
      <h3>
        {t('manage.queueHeading', { count: queue.length, max: maxQueue })}
      </h3>
      {queue.length === 0 ? (
        <p className="empty-state">{t('manage.queueEmpty')}</p>
      ) : (
        <ol className="queue-list">
          {queue.map((entry, index) => {
            const matchup = t('matches.draw.matchup', {
              team1: queuedTeamNames(entry.participants, 1, playerNameById),
              team2: queuedTeamNames(entry.participants, 2, playerNameById),
            })
            const rowLabel = `${index + 1}. ${matchup}`
            return (
              <li key={index} className="queue-row">
                <div className="queue-row-head">
                  <span className="queue-number">{index + 1}.</span>
                  <span className="queue-matchup">{matchup}</span>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`${t('manage.editDraw')} ${rowLabel}`}
                    onClick={() => setEditingIndex(index)}
                    disabled={!isActive || busy}
                  >
                    {t('manage.editDraw')}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`${t('manage.removeFromQueue')} ${rowLabel}`}
                    onClick={() => handleRemove(index)}
                    disabled={!isActive || busy}
                  >
                    {t('manage.removeFromQueue')}
                  </button>
                </div>
                {entry.manuallyAdjusted &&
                  violatesMixedDoubles(entry.participants) && (
                    <p className="field-warning">
                      {t('manage.mixedDoublesWarning')}
                    </p>
                  )}
              </li>
            )
          })}
        </ol>
      )}

      {editingEntry && (
        <Modal open onClose={() => setEditingIndex(null)}>
          <h3>{t('manage.editDrawPopupHeading')}</h3>
          <div className="draw-edit-teams">
            {([1, 2] as const).map((team) => (
              <Fragment key={team}>
                {team === 2 && <span className="round-vs">vs</span>}
                <div className="draw-edit-team">
                  {editingEntry.participants
                    .filter((p) => p.team === team)
                    .map((p, i) => (
                      <DrawSlotSelect
                        key={p.playerId}
                        participant={p}
                        index={i}
                        draw={editingEntry.participants}
                        rosterPlayers={rosterPlayers}
                        onSwap={handleSwap}
                      />
                    ))}
                </div>
              </Fragment>
            ))}
          </div>

          <h4>{t('manage.editDrawGamesTableHeading')}</h4>
          <div className="games-played-table-wrap">
            <table className="games-played-table">
              <thead>
                <tr>
                  <th>{t('manage.editDrawGamesTablePlayer')}</th>
                  <th>{t('manage.editDrawGamesTableGamesPlayed')}</th>
                </tr>
              </thead>
              <tbody>
                {gamesPlayedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.gamesPlayed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={() => setEditingIndex(null)}>
              {t('manage.doneEditingDraw')}
            </button>
          </div>
        </Modal>
      )}

      <div className="button-row">
        <button
          type="button"
          className="secondary"
          onClick={() => handleDraw(1)}
          disabled={drawDisabled}
        >
          {t('manage.randomize')}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => handleDraw(maxQueue - queue.length)}
          disabled={drawDisabled}
        >
          {t('manage.fillQueue')}
        </button>
      </div>

      {isActive && isFull && (
        <p className="field-hint">{t('manage.queueFull')}</p>
      )}
      {notEnoughPlayers && (
        <p className="field-error">
          {t('manage.notEnoughPlayersWithCount', {
            needed: neededCount,
            have: participantCount,
          })}
        </p>
      )}
      {drawFailed && (
        <p className="field-error">{t('matches.draw.notEnoughPlayers')}</p>
      )}
      {reusedPlayerIds.length > 0 && (
        <p className="field-warning">
          {t('manage.queueReusedWarning', { names: reusedNames })}
        </p>
      )}
    </section>
  )
}
