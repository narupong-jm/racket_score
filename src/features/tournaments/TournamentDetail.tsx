import { useTranslation } from 'react-i18next'
import { useTournaments } from './useTournaments'
import { ParticipantsSection } from './ParticipantsSection'
import { useEndTournament } from './useEndTournament'
import { DrawSection } from '../matches/DrawSection'
import { StandingsTable } from '../matches/StandingsTable'
import { computePointCap } from './computePointCap'
import { formatDate } from '../../i18n/formatDate'
import type { MatchType } from '../matchmaking/types'

interface TournamentDetailProps {
  tournamentId: string
}

export function TournamentDetail({ tournamentId }: TournamentDetailProps) {
  const { t, i18n } = useTranslation()
  const { data: tournaments } = useTournaments()
  const tournament = tournaments?.find((tour) => tour.id === tournamentId)
  const endTournament = useEndTournament()

  if (!tournament) return <p>{t('tournaments.detail.notFound')}</p>

  const isActive = tournament.status === 'active'

  return (
    <section>
      <h2>{tournament.name}</h2>
      <p>
        {t('tournaments.detail.summary', {
          type: t(`tournamentType.${tournament.type}`),
          status: t(`tournamentStatus.${tournament.status}`),
        })}
      </p>
      <p>
        {t('tournaments.detail.createdAt', {
          date: formatDate(tournament.created_at, i18n.language),
        })}
      </p>
      {tournament.ended_at && (
        <p>
          {t('tournaments.detail.endedAt', {
            date: formatDate(tournament.ended_at, i18n.language),
          })}
        </p>
      )}
      {isActive && (
        <button
          type="button"
          onClick={() => endTournament.mutate(tournament.id)}
          disabled={endTournament.isPending}
        >
          {t('tournaments.detail.endTournament')}
        </button>
      )}

      <section>
        <h3>{t('tournaments.detail.participantsHeading')}</h3>
        <ParticipantsSection tournamentId={tournament.id} isActive={isActive} />
      </section>

      <section>
        <h3>{t('tournaments.detail.drawHeading')}</h3>
        <DrawSection
          tournamentId={tournament.id}
          matchType={tournament.type as MatchType}
          isActive={isActive}
          gamesPerMatch={tournament.games_per_match}
          pointsPerGame={tournament.points_per_game}
          winBy={tournament.win_by}
          cap={tournament.point_cap ?? computePointCap(tournament.points_per_game)}
        />
      </section>

      <section>
        <h3>{t('tournaments.detail.standingsHeading')}</h3>
        <StandingsTable tournamentId={tournament.id} />
      </section>
    </section>
  )
}
