import { useTranslation } from 'react-i18next'
import { Avatar } from '../../components/Avatar'
import medal1 from '../../assets/icons/scoreboard_winner1.png'
import medal2 from '../../assets/icons/scoreboard_winner2.png'
import medal3 from '../../assets/icons/scoreboard_winner3.png'

const MEDAL_ICONS = [medal1, medal2, medal3]

export interface ScoreboardRow {
  playerId: string
  name: string
  matchesPlayed: number
  matchesWon: number
  winRate: number | null
  pointsValue: number
}

export interface ScoreboardPointsColumn {
  label: string
}

interface ScoreboardTableProps {
  rows: ScoreboardRow[]
  pointsColumn: ScoreboardPointsColumn
}

export function ScoreboardTable({ rows, pointsColumn }: ScoreboardTableProps) {
  const { t } = useTranslation()

  return (
    <div className="scoreboard-table-wrap card">
      <table className="scoreboard-table">
        <thead>
          <tr>
            <th className="rank-col">{t('scoreboard.columnRank')}</th>
            <th className="avatar-col">{t('scoreboard.columnAvatar')}</th>
            <th>{t('scoreboard.columnName')}</th>
            <th>{t('scoreboard.columnMatchesPlayed')}</th>
            <th>{t('scoreboard.columnMatchesWon')}</th>
            <th>{pointsColumn.label}</th>
            <th>{t('scoreboard.columnWinRate')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const medal = MEDAL_ICONS[index]
            return (
              <tr key={row.playerId} className={index < 3 ? 'scoreboard-medal-row' : undefined}>
                <td className="rank-col">
                  {medal ? (
                    <img
                      className="medal-icon"
                      src={medal}
                      alt={t('scoreboard.rankLabel', { rank: index + 1 })}
                    />
                  ) : (
                    index + 1
                  )}
                </td>
                <td className="avatar-col">
                  <Avatar name={row.name} size={32} />
                </td>
                <td>{row.name}</td>
                <td>{row.matchesPlayed}</td>
                <td>{row.matchesWon}</td>
                <td>{row.pointsValue}</td>
                <td>
                  {row.winRate === null
                    ? t('scoreboard.noWinRate')
                    : t('scoreboard.winRateValue', {
                        percent: Math.round(row.winRate * 1000) / 10,
                      })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
