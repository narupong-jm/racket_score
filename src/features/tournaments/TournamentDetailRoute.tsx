import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTournaments } from './useTournaments'
import { TournamentDetail } from './TournamentDetail'

export function TournamentDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { data: tournaments } = useTournaments()

  if (!id) return <p>{t('tournaments.detail.notFound')}</p>

  const tournament = tournaments?.find((tour) => tour.id === id)
  if (tournament?.status === 'completed') {
    return <Navigate to={`/tournaments/${id}/scoreboard`} replace />
  }

  return <TournamentDetail tournamentId={id} onEnded={() => navigate(`/tournaments/${id}/scoreboard`)} />
}
