import { useTranslation } from 'react-i18next'
import { usePlayers } from './usePlayers'
import { usePlayerStatsList } from './usePlayerStatsList'
import { EditablePlayerLevel } from './EditablePlayerLevel'

export function PlayerList() {
  const { t } = useTranslation()
  const { data: players, isLoading, isError } = usePlayers()
  const { data: statsList } = usePlayerStatsList()

  if (isLoading) return <p>{t('players.loading')}</p>
  if (isError) return <p>{t('players.loadError')}</p>
  if (!players || players.length === 0) return <p>{t('players.empty')}</p>

  const statsByPlayerId = new Map((statsList ?? []).map((s) => [s.player_id, s]))

  return (
    <table>
      <thead>
        <tr>
          <th>{t('players.columnName')}</th>
          <th>{t('players.columnGender')}</th>
          <th>{t('players.columnLevel')}</th>
        </tr>
      </thead>
      <tbody>
        {players.map((player) => (
          <tr key={player.id}>
            <td>{player.name}</td>
            <td>{t(`gender.${player.gender}`)}</td>
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
  )
}
