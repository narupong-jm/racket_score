import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreboardTable, type ScoreboardRow } from './ScoreboardTable'

const rows: ScoreboardRow[] = [
  { playerId: 'p1', name: 'Alice', matchesPlayed: 5, matchesWon: 4, winRate: 0.8, pointsValue: 120 },
  { playerId: 'p2', name: 'Bob', matchesPlayed: 5, matchesWon: 3, winRate: 0.6, pointsValue: 100 },
  { playerId: 'p3', name: 'Cara', matchesPlayed: 5, matchesWon: 2, winRate: 0.4, pointsValue: 90 },
  { playerId: 'p4', name: 'Dee', matchesPlayed: 5, matchesWon: 1, winRate: 0.2, pointsValue: 80 },
]

describe('ScoreboardTable', () => {
  it('renders rows in the order given, with medal icons on the top 3 only', () => {
    render(<ScoreboardTable rows={rows} pointsColumn={{ label: 'Total Points' }} />)

    const dataRows = screen.getAllByRole('row').slice(1)
    expect(dataRows).toHaveLength(4)
    expect(dataRows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Alice'),
      expect.stringContaining('Bob'),
      expect.stringContaining('Cara'),
      expect.stringContaining('Dee'),
    ])

    expect(screen.getByRole('img', { name: 'Rank 1' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Rank 2' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Rank 3' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Rank 4' })).toBeNull()
    expect(dataRows[3].textContent).toContain('4')
  })

  it('shows the configured "total points" column values', () => {
    render(<ScoreboardTable rows={rows} pointsColumn={{ label: 'Total Points' }} />)

    expect(screen.getByRole('columnheader', { name: 'Total Points' })).toBeInTheDocument()
    const aliceRow = screen.getByText('Alice').closest('tr')
    expect(aliceRow).not.toBeNull()
    expect(aliceRow?.textContent).toContain('120')
    expect(aliceRow?.textContent).toContain('80%')
  })

  it('shows the configured "point diff" column values', () => {
    const diffRows: ScoreboardRow[] = [
      { playerId: 'p1', name: 'Alice', matchesPlayed: 3, matchesWon: 2, winRate: 2 / 3, pointsValue: 15 },
      { playerId: 'p2', name: 'Bob', matchesPlayed: 3, matchesWon: 1, winRate: 1 / 3, pointsValue: -15 },
    ]
    render(<ScoreboardTable rows={diffRows} pointsColumn={{ label: 'Point Diff' }} />)

    expect(screen.getByRole('columnheader', { name: 'Point Diff' })).toBeInTheDocument()
    const bobRow = screen.getByText('Bob').closest('tr')
    expect(bobRow?.textContent).toContain('-15')
  })

  it('renders a placeholder for a null win rate', () => {
    const zeroRows: ScoreboardRow[] = [
      { playerId: 'p1', name: 'Alice', matchesPlayed: 0, matchesWon: 0, winRate: null, pointsValue: 0 },
    ]
    render(<ScoreboardTable rows={zeroRows} pointsColumn={{ label: 'Total Points' }} />)

    const aliceRow = screen.getByText('Alice').closest('tr')
    expect(aliceRow?.textContent).toContain('–')
  })
})
