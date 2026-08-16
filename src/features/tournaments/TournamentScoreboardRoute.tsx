import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TournamentScoreboardSection } from './TournamentScoreboardSection'

export function TournamentScoreboardRoute() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()

  if (!id) return <p>{t('tournaments.detail.notFound')}</p>

  return (
    <section className="page">
      <h1>{t('tournaments.detail.standingsHeading')}</h1>
      <TournamentScoreboardSection tournamentId={id} />
    </section>
  )
}
