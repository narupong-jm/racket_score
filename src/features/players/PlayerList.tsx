import { useTranslation } from 'react-i18next'
import { usePlayers } from './usePlayers'
import { usePlayerStatsList } from './usePlayerStatsList'
import { EditablePlayerLevel } from './EditablePlayerLevel'
import { Avatar } from '../../components/Avatar'

export function PlayerList() {
  const { t } = useTranslation()
  const { data: players, isLoading, isError } = usePlayers()
  const { data: statsList } = usePlayerStatsList()

  if (isLoading) return <p className="empty-state">{t('players.loading')}</p>
  if (isError) return <p className="field-error">{t('players.loadError')}</p>
  if (!players || players.length === 0) return <p className="empty-state">{t('players.empty')}</p>

  const statsByPlayerId = new Map((statsList ?? []).map((s) => [s.player_id, s]))

  return (
    <div className="scoreboard-table-wrap card">
      <table className="scoreboard-table">
        <thead>
          <tr>
            <th className="avatar-col">{t('players.columnAvatar')}</th>
            <th>{t('players.columnName')}</th>
            <th>{t('players.columnLevel')}</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <td className="avatar-col">
                <Avatar name={player.name} size={32} />
              </td>
              <td>{player.name}</td>
              <td>
                <EditablePlayerLevel
                  player={player}
                  stats={statsByPlayerId.get(player.id) ?? undefined}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
