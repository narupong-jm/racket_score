import { useTranslation } from 'react-i18next'
import { useTournaments } from './useTournaments'
import type { Tournament } from './tournamentsApi'

interface TournamentListProps {
  selectedId: string | null
  onSelect: (id: string) => void
}

function TournamentGroup({
  title,
  tournaments,
  selectedId,
  onSelect,
}: {
  title: string
  tournaments: Tournament[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()

  return (
    <section>
      <h3>{title}</h3>
      {tournaments.length === 0 ? (
        <p>{t('tournaments.list.groupEmpty')}</p>
      ) : (
        <ul>
          {tournaments.map((tournament) => (
            <li key={tournament.id}>
              <button
                type="button"
                aria-current={tournament.id === selectedId}
                onClick={() => onSelect(tournament.id)}
              >
                {t('tournaments.list.itemLabel', {
                  name: tournament.name,
                  type: t(`tournamentType.${tournament.type}`),
                })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function TournamentList({ selectedId, onSelect }: TournamentListProps) {
  const { t } = useTranslation()
  const { data: tournaments, isLoading, isError } = useTournaments()

  if (isLoading) return <p>{t('tournaments.list.loading')}</p>
  if (isError) return <p>{t('tournaments.list.loadError')}</p>
  if (!tournaments || tournaments.length === 0)
    return <p>{t('tournaments.list.empty')}</p>

  const active = tournaments.filter(
    (tournament) => tournament.status === 'active',
  )
  const completed = tournaments.filter(
    (tournament) => tournament.status === 'completed',
  )

  return (
    <div>
      <TournamentGroup
        title={t('tournaments.list.activeGroup')}
        tournaments={active}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      <TournamentGroup
        title={t('tournaments.list.completedGroup')}
        tournaments={completed}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  )
}
