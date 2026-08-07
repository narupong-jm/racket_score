import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useOverallScoreboard,
  type ScoreboardPeriod,
  type ScoreboardTypeFilter,
} from '../features/scoreboard/useOverallScoreboard'
import {
  ScoreboardTable,
  type ScoreboardRow,
} from '../features/scoreboard/ScoreboardTable'
import type { PlayerScoreboardEntry } from '../features/scoreboard/aggregateScoreboard'
import { rankScoreboard } from '../features/scoreboard/rankScoreboard'

const PERIODS: ScoreboardPeriod[] = ['all', 'month']
const TYPES: ScoreboardTypeFilter[] = ['all', 'singles', 'doubles']

export function OverallScoreboardPage() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<ScoreboardPeriod>('all')
  const [type, setType] = useState<ScoreboardTypeFilter>('all')

  const { data, isLoading, isError } = useOverallScoreboard(period, type)
  const rows = toScoreboardRows(data ?? [])

  return (
    <section className="page">
      <h1>{t('nav.scoreboard')}</h1>

      <div
        className="filter-group"
        role="group"
        aria-label={t('scoreboard.periodGroupLabel')}
      >
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            className="filter-button"
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
          >
            {t(
              p === 'all'
                ? 'scoreboard.periodAllTime'
                : 'scoreboard.periodThisMonth',
            )}
          </button>
        ))}
      </div>

      <div
        className="filter-group"
        role="group"
        aria-label={t('scoreboard.typeGroupLabel')}
      >
        {TYPES.map((ty) => (
          <button
            key={ty}
            type="button"
            className="filter-button"
            aria-pressed={type === ty}
            onClick={() => setType(ty)}
          >
            {t(ty === 'all' ? 'scoreboard.typeAll' : `tournamentType.${ty}`)}
          </button>
        ))}
      </div>

      {isLoading && <p className="empty-state">{t('scoreboard.loading')}</p>}
      {isError && <p className="field-error">{t('scoreboard.loadError')}</p>}
      {!isLoading && !isError && rows.length === 0 && (
        <p className="empty-state">{t('scoreboard.empty')}</p>
      )}
      {!isLoading && !isError && rows.length > 0 && (
        <ScoreboardTable rows={rows} />
      )}
    </section>
  )
}

function toScoreboardRows(entries: PlayerScoreboardEntry[]): ScoreboardRow[] {
  return rankScoreboard(
    entries.map((entry) => ({
      playerId: entry.player_id,
      name: entry.name,
      matchesPlayed: entry.matches_played,
      matchesWon: entry.matches_won,
      winRate: entry.win_rate,
      totalPoints: entry.total_points,
    })),
  )
}
