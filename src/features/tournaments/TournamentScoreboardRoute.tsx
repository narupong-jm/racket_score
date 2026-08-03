import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getTournamentStandingsRanked } from './tournamentsApi'
import { listPlayerMatchHistory } from '../scoreboard/scoreboardApi'
import { rankScoreboard } from '../scoreboard/rankScoreboard'
import { ScoreboardTable, type ScoreboardRow } from '../scoreboard/ScoreboardTable'

export function TournamentScoreboardRoute() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()

  const tournamentId = id ?? ''
  const enabled = tournamentId !== ''

  const standingsQuery = useQuery({
    queryKey: ['tournamentStandingsRanked', tournamentId],
    queryFn: () => getTournamentStandingsRanked(tournamentId),
    enabled,
  })
  const pointsQuery = useQuery({
    queryKey: ['tournamentTotalPoints', tournamentId],
    queryFn: () => listPlayerMatchHistory({ tournamentId }),
    enabled,
  })

  if (!id) return <p>{t('tournaments.detail.notFound')}</p>
  if (standingsQuery.isLoading || pointsQuery.isLoading) {
    return <p className="empty-state">{t('matches.standings.loading')}</p>
  }
  if (standingsQuery.isError || pointsQuery.isError) {
    return <p className="field-error">{t('matches.standings.loadError')}</p>
  }

  const totalPointsByPlayer = new Map<string, number>()
  for (const row of pointsQuery.data ?? []) {
    if (!row.player_id) continue
    totalPointsByPlayer.set(
      row.player_id,
      (totalPointsByPlayer.get(row.player_id) ?? 0) + (row.points_for ?? 0),
    )
  }

  const rows: ScoreboardRow[] = rankScoreboard(
    (standingsQuery.data ?? []).map((standing) => ({
      playerId: standing.player_id ?? '',
      name: standing.name ?? '',
      matchesPlayed: standing.matches_played ?? 0,
      matchesWon: standing.matches_won ?? 0,
      winRate: standing.win_rate,
      totalPoints: totalPointsByPlayer.get(standing.player_id ?? '') ?? 0,
    })),
  )

  return (
    <section className="page">
      <h1>{t('tournaments.detail.standingsHeading')}</h1>
      {rows.length === 0 ? (
        <p className="empty-state">{t('matches.standings.empty')}</p>
      ) : (
        <ScoreboardTable rows={rows} />
      )}
    </section>
  )
}
