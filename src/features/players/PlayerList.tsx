import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlayers } from './usePlayers'
import { usePlayerStatsList } from './usePlayerStatsList'
import { useDeletePlayer } from './useDeletePlayer'
import { EditablePlayerLevel } from './EditablePlayerLevel'
import { EditablePlayerName } from './EditablePlayerName'
import { Avatar } from '../../components/Avatar'
import { Modal } from '../../components/Modal'
import { useSport } from '../sport/useSport'

export function PlayerList() {
  const { t } = useTranslation()
  const { sport } = useSport()
  const { data: players, isLoading, isError } = usePlayers()
  const { data: statsList } = usePlayerStatsList(sport!)
  const deletePlayer = useDeletePlayer()
  const [removingPlayer, setRemovingPlayer] = useState<{
    id: string
    name: string
  } | null>(null)

  if (isLoading) return <p className="empty-state">{t('players.loading')}</p>
  if (isError) return <p className="field-error">{t('players.loadError')}</p>
  if (!players || players.length === 0)
    return <p className="empty-state">{t('players.empty')}</p>

  const statsByPlayerId = new Map(
    (statsList ?? []).map((s) => [s.player_id, s]),
  )

  function handleConfirmRemove() {
    if (!removingPlayer) return
    deletePlayer.mutate(removingPlayer.id, {
      onSuccess: () => setRemovingPlayer(null),
    })
  }

  return (
    <div className="scoreboard-table-wrap card">
      <table className="scoreboard-table">
        <thead>
          <tr>
            <th className="avatar-col">{t('players.columnAvatar')}</th>
            <th>{t('players.columnName')}</th>
            <th>{t('players.columnLevel')}</th>
            <th>{t('players.columnActions')}</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const stats = statsByPlayerId.get(player.id) ?? undefined
            // Fast, imperfect pre-check: total_matches only counts completed
            // matches and says nothing about active-tournament-roster-only
            // entries -- the delete_player RPC's server-side check is the
            // real authority and is what actually blocks those cases.
            const hasHistory = (stats?.total_matches ?? 0) > 0
            return (
              <tr key={player.id}>
                <td className="avatar-col">
                  <Avatar name={player.name} size={32} />
                </td>
                <td>
                  <EditablePlayerName player={player} />
                </td>
                <td>
                  <EditablePlayerLevel
                    playerId={player.id}
                    playerName={player.name}
                    stats={stats}
                    sport={sport!}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="danger"
                    disabled={hasHistory}
                    title={
                      hasHistory ? t('member.removeDisabledHint') : undefined
                    }
                    onClick={() =>
                      setRemovingPlayer({ id: player.id, name: player.name })
                    }
                  >
                    {t('member.remove')}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <Modal
        open={removingPlayer !== null}
        onClose={() => setRemovingPlayer(null)}
      >
        <h3>
          {t('member.confirmRemoveTitle', { name: removingPlayer?.name ?? '' })}
        </h3>
        <p>{t('member.confirmRemoveBody')}</p>
        {deletePlayer.isError && (
          <p className="field-error">{t('member.removeFailed')}</p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => setRemovingPlayer(null)}
          >
            {t('manage.cancel')}
          </button>
          <button
            type="button"
            className="danger"
            onClick={handleConfirmRemove}
            disabled={deletePlayer.isPending}
          >
            {t('member.confirmRemoveButton')}
          </button>
        </div>
      </Modal>
    </div>
  )
}
