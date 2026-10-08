import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FirstMatchDrawnPopup } from './FirstMatchDrawnPopup'
import type { RosterPlayer } from '../../components/DrawSlotSelect'
import type { PlannedMatch } from '../matchmaking/plannedMatches'

const rosterPlayers: RosterPlayer[] = [
  { id: 'p1', name: 'Alice', gender: 'female' },
  { id: 'p2', name: 'Bob', gender: 'male' },
  { id: 'p3', name: 'Carol', gender: 'female' },
  { id: 'p4', name: 'Dave', gender: 'male' },
  { id: 'p5', name: 'Eve', gender: 'female' },
]

const match1: PlannedMatch = [
  { playerId: 'p1', team: 1 },
  { playerId: 'p2', team: 2 },
]
const match2: PlannedMatch = [
  { playerId: 'p3', team: 1 },
  { playerId: 'p4', team: 2 },
]

function renderPopup(
  props: Partial<React.ComponentProps<typeof FirstMatchDrawnPopup>> = {},
) {
  return render(
    <FirstMatchDrawnPopup
      open
      matches={[match1, match2]}
      reusedPlayerIds={[]}
      matchType="singles"
      rosterPlayers={rosterPlayers}
      onConfirm={() => {}}
      onDismiss={() => {}}
      {...props}
    />,
  )
}

describe('FirstMatchDrawnPopup', () => {
  it('shows the count title and one numbered compact row per drawn match', () => {
    renderPopup()

    expect(
      screen.getByRole('heading', { name: 'First 2 matches drawn' }),
    ).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('1.Alice vs Bob')
    expect(rows[1]).toHaveTextContent('2.Carol vs Dave')
    expect(screen.getAllByRole('button', { name: /^Edit/ })).toHaveLength(2)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('uses the singular title for one match and the counted title otherwise', () => {
    const { unmount } = renderPopup({ matches: [match1] })
    expect(
      screen.getByRole('heading', { name: 'First match drawn' }),
    ).toBeInTheDocument()
    unmount()

    renderPopup({ matches: [match1, match2, match1] })
    expect(
      screen.getByRole('heading', { name: 'First 3 matches drawn' }),
    ).toBeInTheDocument()
  })

  it('gives each row Edit button a distinct accessible name', () => {
    renderPopup()
    expect(
      screen.getByRole('button', { name: 'Edit 1. Alice vs Bob' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Edit 2. Carol vs Dave' }),
    ).toBeInTheDocument()
  })

  it('shows the fallback message and calls onDismiss when no match could be drawn', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    renderPopup({ matches: [], onDismiss })

    expect(
      screen.getByText(
        "The first match couldn't be drawn automatically -- draw it from Manage Tournament.",
      ),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Go to Manage Tournament' }),
    )
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm with every match unedited and manuallyAdjusted=false', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    renderPopup({ onConfirm })

    await user.click(
      screen.getByRole('button', { name: 'Go to Manage Tournament' }),
    )

    expect(onConfirm).toHaveBeenCalledWith([
      { participants: match1, manuallyAdjusted: false },
      { participants: match2, manuallyAdjusted: false },
    ])
  })

  it('expands only the tapped row into pickers, and only one row at a time', async () => {
    const user = userEvent.setup()
    renderPopup()

    const edits = screen.getAllByRole('button', { name: /^Edit/ })
    await user.click(edits[0])
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
    expect(
      within(screen.getAllByRole('listitem')[0]).getAllByRole('combobox'),
    ).toHaveLength(2)

    // Opening row 2 collapses row 1.
    await user.click(screen.getByRole('button', { name: /^Edit/ }))
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
    expect(
      within(screen.getAllByRole('listitem')[1]).getAllByRole('combobox'),
    ).toHaveLength(2)
    expect(
      within(screen.getAllByRole('listitem')[0]).queryByRole('combobox'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Done/ }))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('editing one row changes and flags only that row', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    renderPopup({ onConfirm })

    await user.click(screen.getAllByRole('button', { name: /^Edit/ })[1])
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Team 1 player 1' }),
      'p5',
    )
    await user.click(screen.getByRole('button', { name: /^Done/ }))
    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent(
      '2.Eve vs Dave',
    )
    await user.click(
      screen.getByRole('button', { name: 'Go to Manage Tournament' }),
    )

    expect(onConfirm).toHaveBeenCalledWith([
      { participants: match1, manuallyAdjusted: false },
      {
        participants: [
          { playerId: 'p5', team: 1 },
          { playerId: 'p4', team: 2 },
        ],
        manuallyAdjusted: true,
      },
    ])
  })

  it('shows the reuse warning with names under the list only when players are reused', () => {
    const { unmount } = renderPopup()
    expect(screen.queryByText(/appear in more than one match/)).toBeNull()
    unmount()

    renderPopup({ reusedPlayerIds: ['p1', 'p2'] })
    expect(
      screen.getByText(
        'Alice, Bob appear in more than one match (not enough players)',
      ),
    ).toBeInTheDocument()
  })

  it('shows a non-blocking warning when an edit leaves a 2-2 doubles quartet split into same-gender teams', async () => {
    const doublesRoster: RosterPlayer[] = [
      { id: 'p1', name: 'Ann', gender: 'male' },
      { id: 'p2', name: 'Ben', gender: 'male' },
      { id: 'p3', name: 'Cid', gender: 'female' },
      { id: 'p4', name: 'Dee', gender: 'female' },
      { id: 'p5', name: 'Eve', gender: 'male' },
    ]
    const doublesDraw: PlannedMatch = [
      { playerId: 'p1', team: 1 },
      { playerId: 'p2', team: 1 },
      { playerId: 'p3', team: 2 },
      { playerId: 'p4', team: 2 },
    ]
    const warningText =
      "This lineup isn't gender-mixed, though a mixed pairing was possible."
    const user = userEvent.setup()
    renderPopup({
      matches: [doublesDraw],
      matchType: 'doubles',
      rosterPlayers: doublesRoster,
    })

    expect(screen.queryByText(warningText)).toBeNull()

    await user.click(screen.getByRole('button', { name: /^Edit/ }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Team 1 player 2' }),
      'p5',
    )

    expect(await screen.findByText(warningText)).toBeInTheDocument()
  })
})
