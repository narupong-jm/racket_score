import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreboardTable, type ScoreboardRow } from './ScoreboardTable'

const rows: ScoreboardRow[] = [
  { playerId: 'p1', name: 'Alice', matchesPlayed: 5, matchesWon: 4, winRate: 0.8, totalPoints: 120, rank: 1 },
  { playerId: 'p2', name: 'Bob', matchesPlayed: 5, matchesWon: 3, winRate: 0.6, totalPoints: 100, rank: 2 },
  { playerId: 'p3', name: 'Cara', matchesPlayed: 5, matchesWon: 2, winRate: 0.4, totalPoints: 90, rank: 3 },
  { playerId: 'p4', name: 'Dee', matchesPlayed: 5, matchesWon: 1, winRate: 0.2, totalPoints: 80, rank: 4 },
]

describe('ScoreboardTable', () => {
  it('renders rows in the order given, with medal icons on the top 3 ranks only', () => {
    render(<ScoreboardTable rows={rows} />)

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

  it('shows the "Total Points" column values', () => {
    render(<ScoreboardTable rows={rows} />)

    expect(screen.getByRole('columnheader', { name: 'Total Points' })).toBeInTheDocument()
    const aliceRow = screen.getByText('Alice').closest('tr')
    expect(aliceRow).not.toBeNull()
    expect(aliceRow?.textContent).toContain('120')
    expect(aliceRow?.textContent).toContain('80%')
  })

  it('renders a placeholder for a null win rate', () => {
    const zeroRows: ScoreboardRow[] = [
      { playerId: 'p1', name: 'Alice', matchesPlayed: 0, matchesWon: 0, winRate: null, totalPoints: 0, rank: 1 },
    ]
    render(<ScoreboardTable rows={zeroRows} />)

    const aliceRow = screen.getByText('Alice').closest('tr')
    expect(aliceRow?.textContent).toContain('–')
  })

  it('gives tied ranks the same medal and highlight, per standard competition ranking (1, 1, 3, 4)', () => {
    const tiedRows: ScoreboardRow[] = [
      { playerId: 'p1', name: 'Alice', matchesPlayed: 3, matchesWon: 2, winRate: 2 / 3, totalPoints: 15, rank: 1 },
      { playerId: 'p2', name: 'Bob', matchesPlayed: 3, matchesWon: 2, winRate: 2 / 3, totalPoints: 15, rank: 1 },
      { playerId: 'p3', name: 'Cara', matchesPlayed: 3, matchesWon: 1, winRate: 1 / 3, totalPoints: 10, rank: 3 },
      { playerId: 'p4', name: 'Dee', matchesPlayed: 3, matchesWon: 0, winRate: 0, totalPoints: 5, rank: 4 },
    ]
    render(<ScoreboardTable rows={tiedRows} />)

    // Both rank-1 rows get the gold medal; rank 2 is skipped entirely
    // (standard competition ranking), so rank 3 gets bronze and rank 4
    // gets a plain number with no medal/highlight.
    expect(screen.getAllByRole('img', { name: 'Rank 1' })).toHaveLength(2)
    expect(screen.queryByRole('img', { name: 'Rank 2' })).toBeNull()
    expect(screen.getByRole('img', { name: 'Rank 3' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Rank 4' })).toBeNull()

    expect(screen.getByText('Bob').closest('tr')).toHaveClass('scoreboard-medal-row')
    expect(screen.getByText('Cara').closest('tr')).toHaveClass('scoreboard-medal-row')
    const deeRow = screen.getByText('Dee').closest('tr')
    expect(deeRow).not.toHaveClass('scoreboard-medal-row')
    expect(deeRow?.textContent).toContain('4')
  })
})
