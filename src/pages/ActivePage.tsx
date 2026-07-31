import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTournaments } from '../features/tournaments/useTournaments'
import { listMatches } from '../features/matches/matchesApi'
import type { Tournament } from '../features/tournaments/tournamentsApi'

export function ActivePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: tournaments, isLoading, isError } = useTournaments()

  if (isLoading) return <p className="empty-state">{t('active.loading')}</p>
  if (isError) return <p className="field-error">{t('active.loadError')}</p>

  const active = (tournaments ?? []).filter((tournament) => tournament.status === 'active')

  return (
    <section className="page">
      <h1>{t('nav.active')}</h1>
      {active.length === 0 ? (
        <p className="empty-state">{t('active.empty')}</p>
      ) : (
        <ul className="card-list">
          {active.map((tournament) => (
            <li key={tournament.id}>
              <ActiveTournamentCard
                tournament={tournament}
                onSelect={() => navigate(`/tournaments/${tournament.id}`)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface ActiveTournamentCardProps {
  tournament: Tournament
  onSelect: () => void
}

function ActiveTournamentCard({ tournament, onSelect }: ActiveTournamentCardProps) {
  const { t } = useTranslation()
  const { data: matches } = useQuery({
    queryKey: ['matches', tournament.id],
    queryFn: () => listMatches(tournament.id),
  })

  return (
    <button type="button" className="tournament-card" onClick={onSelect}>
      <span className="tournament-card-name">{tournament.name}</span>
      <span className="tournament-card-type">{t(`tournamentType.${tournament.type}`)}</span>
      <span className="tournament-card-round">
        {t('active.roundLabel', { n: matches?.length ?? 0 })}
      </span>
    </button>
  )
}
