import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSportMembers } from './useSportMembers'
import { usePlayerStatsList } from './usePlayerStatsList'
import { useRemovePlayerFromSport } from './useRemovePlayerFromSport'
import { membershipSports, otherSport } from './playerMembership'
import { removeMemberErrorKey } from './playerErrors'
import { EditablePlayerLevel } from './EditablePlayerLevel'
import { EditablePlayerName } from './EditablePlayerName'
import { Avatar } from '../../components/Avatar'
import { Modal } from '../../components/Modal'
import { useSport } from '../sport/useSport'
import type { Player } from './playersApi'

export function PlayerList() {
  const { t } = useTranslation()
  const { sport } = useSport()
  const { data: players, isLoading, isError } = useSportMembers(sport!)
  const { data: statsList } = usePlayerStatsList(sport!)
  const removeMember = useRemovePlayerFromSport()
  const [removingPlayer, setRemovingPlayer] = useState<Player | null>(null)

  if (isLoading) return <p className="empty-state">{t('players.loading')}</p>
  if (isError) return <p className="field-error">{t('players.loadError')}</p>
  if (!players || players.length === 0)
    return <p className="empty-state">{t('players.empty')}</p>

  const statsByPlayerId = new Map(
    (statsList ?? []).map((s) => [s.player_id, s]),
  )

  function handleConfirmRemove() {
    if (!removingPlayer) return
    removeMember.mutate(
      { id: removingPlayer.id, sport: sport! },
      { onSuccess: () => setRemovingPlayer(null) },
    )
  }

  const isLastSport = removingPlayer
    ? membershipSports(removingPlayer).length === 1
    : false
  const removeErrorKey = removeMember.isError
    ? removeMemberErrorKey(removeMember.error)
    : null

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
            // entries -- the remove_player_from_sport RPC's server-side check
            // is the real authority and is what actually blocks those cases.
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
                    onClick={() => setRemovingPlayer(player)}
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
          {t('member.confirmRemoveTitle', {
            name: removingPlayer?.name ?? '',
            sport: t(`sport.${sport}`),
          })}
        </h3>
        {removingPlayer && (
          <p>
            {isLastSport
              ? t('member.confirmRemoveBodyLast', {
                  sport: t(`sport.${sport}`),
                })
              : t('member.confirmRemoveBodySport', {
                  otherSport: t(`sport.${otherSport(sport!)}`),
                })}
          </p>
        )}
        {removeErrorKey && (
          <p className="field-error">{t(removeErrorKey)}</p>
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
            disabled={removeMember.isPending}
          >
            {t('member.confirmRemoveButton')}
          </button>
        </div>
      </Modal>
    </div>
  )
}
