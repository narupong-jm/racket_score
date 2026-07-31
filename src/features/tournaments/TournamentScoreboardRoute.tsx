import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getTournamentStandingsRanked } from './tournamentsApi'
import { sortScoreboard } from './sortScoreboard'
import { ScoreboardTable, type ScoreboardRow } from '../scoreboard/ScoreboardTable'

export function TournamentScoreboardRoute() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()

  const tournamentId = id ?? ''
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tournamentStandingsRanked', tournamentId],
    queryFn: () => getTournamentStandingsRanked(tournamentId),
    enabled: tournamentId !== '',
    select: sortScoreboard,
  })

  if (!id) return <p>{t('tournaments.detail.notFound')}</p>
  if (isLoading) return <p className="empty-state">{t('matches.standings.loading')}</p>
  if (isError) return <p className="field-error">{t('matches.standings.loadError')}</p>

  const rows: ScoreboardRow[] = (data ?? []).map((standing) => ({
    playerId: standing.player_id ?? '',
    name: standing.name ?? '',
    matchesPlayed: standing.matches_played ?? 0,
    matchesWon: standing.matches_won ?? 0,
    winRate: standing.win_rate,
    pointsValue: standing.point_diff ?? 0,
  }))

  return (
    <section className="page">
      <h1>{t('tournaments.detail.standingsHeading')}</h1>
      {rows.length === 0 ? (
        <p className="empty-state">{t('matches.standings.empty')}</p>
      ) : (
        <ScoreboardTable
          rows={rows}
          pointsColumn={{ label: t('matches.standings.columnPointDiff') }}
        />
      )}
    </section>
  )
}
