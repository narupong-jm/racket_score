import { useTranslation } from 'react-i18next'
import { useStandings } from './useStandings'

interface StandingsTableProps {
  tournamentId: string
}

export function StandingsTable({ tournamentId }: StandingsTableProps) {
  const { t } = useTranslation()
  const { data: standings, isLoading, isError } = useStandings(tournamentId)

  if (isLoading) return <p>{t('matches.standings.loading')}</p>
  if (isError) return <p>{t('matches.standings.loadError')}</p>
  if (!standings || standings.length === 0) return <p>{t('matches.standings.empty')}</p>

  return (
    <table>
      <thead>
        <tr>
          <th>{t('matches.standings.columnPlayer')}</th>
          <th>{t('matches.standings.columnGamesWon')}</th>
          <th>{t('matches.standings.columnGamesPlayed')}</th>
          <th>{t('matches.standings.columnPointDiff')}</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s) => (
          <tr key={s.player_id}>
            <td>{s.name}</td>
            <td>{s.games_won}</td>
            <td>{s.games_played}</td>
            <td>{s.point_diff}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
