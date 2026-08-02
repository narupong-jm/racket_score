import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { usePlayers } from '../features/players/usePlayers'
import { useTournaments } from '../features/tournaments/useTournaments'
import { useRecentCompletedMatches } from '../features/matches/useRecentCompletedMatches'
import { teamNames, summarizeGamesWon } from '../features/matches/matchFormatting'

function SectionToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  return (
    <button type="button" className="section-toggle-button" onClick={onToggle}>
      {collapsed ? t('history.showMore') : t('history.showLess')}
    </button>
  )
}

export function HistoryPage() {
  const { t } = useTranslation()
  const { data: players } = usePlayers()
  const playerNameById = new Map((players ?? []).map((p) => [p.id, p.name]))

  return (
    <section className="page">
      <h1>{t('nav.history')}</h1>
      <ByMatchSection playerNameById={playerNameById} />
      <ByTournamentSection />
    </section>
  )
}

function ByMatchSection({ playerNameById }: { playerNameById: Map<string, string> }) {
  const { t } = useTranslation()
  const { data: matches, isLoading, isError } = useRecentCompletedMatches()
  const [collapsed, setCollapsed] = useState(true)

  return (
    <section className="card">
      <div className="section-heading-row">
        <h2>{t('history.byMatchHeading')}</h2>
        <SectionToggle collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>
      {!collapsed && (
        <>
          {isLoading && <p className="empty-state">{t('history.loadingMatches')}</p>}
          {isError && <p className="field-error">{t('history.loadMatchesError')}</p>}
          {!isLoading && !isError && (!matches || matches.length === 0) && (
            <p className="empty-state">{t('history.noRecentMatches')}</p>
          )}
          {!isLoading && !isError && matches && matches.length > 0 && (
            <ul className="round-list">
              {matches.map(({ match, tournamentName, participants, games }) => {
                const team1Name = teamNames(participants, 1, playerNameById)
                const team2Name = teamNames(participants, 2, playerNameById)
                const { team1Games, team2Games } = summarizeGamesWon(games)
                const team1Won = team1Games > team2Games

                return (
                  <li key={match.id} className="round-row">
                    <span className="round-label">
                      <span className="round-tournament">{tournamentName}</span>{' '}
                      <span>{t('manage.roundLabel', { n: match.sequence_number })}</span>
                      {match.manually_adjusted && (
                        <span className="badge">{t('history.manuallyAdjustedBadge')}</span>
                      )}
                    </span>
                    <span className="round-matchup">
                      <span className={team1Won ? 'round-winner' : undefined}>{team1Name}</span>{' '}
                      <span className="round-vs">vs</span>{' '}
                      <span className={!team1Won ? 'round-winner' : undefined}>{team2Name}</span>
                    </span>
                    <span className="round-score">
                      {t('manage.finalScore', { team1Games, team2Games })}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function ByTournamentSection() {
  const { t } = useTranslation()
  const { data: tournaments, isLoading, isError } = useTournaments()
  const [collapsed, setCollapsed] = useState(true)

  return (
    <section className="card">
      <div className="section-heading-row">
        <h2>{t('history.byTournamentHeading')}</h2>
        <SectionToggle collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>
      {!collapsed && (
        <>
          {isLoading && <p className="empty-state">{t('history.loadingTournaments')}</p>}
          {isError && <p className="field-error">{t('history.loadTournamentsError')}</p>}
          {!isLoading && !isError && (!tournaments || tournaments.length === 0) && (
            <p className="empty-state">{t('history.noTournaments')}</p>
          )}
          {!isLoading && !isError && tournaments && tournaments.length > 0 && (
            <ul className="link-list">
              {tournaments.map((tournament) =>
                tournament.status === 'cancelled' ? (
                  <li key={tournament.id}>
                    <span className="link-list-row">
                      <span>{tournament.name}</span>
                      <span className="badge">{t('tournamentStatus.cancelled')}</span>
                    </span>
                  </li>
                ) : (
                  <li key={tournament.id}>
                    <Link
                      className="link-list-row"
                      to={`/tournaments/${tournament.id}/scoreboard`}
                    >
                      <span>{tournament.name}</span>
                      <span className="link-list-meta">
                        {t(`tournamentType.${tournament.type}`)}
                      </span>
                    </Link>
                  </li>
                ),
              )}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
