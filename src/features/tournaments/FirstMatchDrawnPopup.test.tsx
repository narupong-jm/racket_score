import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FirstMatchDrawnPopup } from './FirstMatchDrawnPopup'
import type { RosterPlayer } from '../../components/DrawSlotSelect'
import type { GeneratedMatchParticipant } from '../matchmaking/generateNextMatch'

const rosterPlayers: RosterPlayer[] = [
  { id: 'p1', name: 'Alice', gender: 'female' },
  { id: 'p2', name: 'Bob', gender: 'male' },
  { id: 'p3', name: 'Carol', gender: 'female' },
]

const drawParticipants: GeneratedMatchParticipant[] = [
  { playerId: 'p1', team: 1 },
  { playerId: 'p2', team: 2 },
]

describe('FirstMatchDrawnPopup', () => {
  it('shows the drawn matchup when a first match was drawn', () => {
    render(
      <FirstMatchDrawnPopup
        open
        drawParticipants={drawParticipants}
        matchType="singles"
        rosterPlayers={rosterPlayers}
        onConfirm={() => {}}
        onDismiss={() => {}}
        isConfirming={false}
        confirmError={false}
      />,
    )

    expect(
      screen.getByText((_, element) => element?.textContent === 'First match: Alice vs Bob'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/couldn't be drawn/i)).not.toBeInTheDocument()
  })

  it('shows the fallback message and calls onDismiss when no match could be drawn (defensive branch)', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(
      <FirstMatchDrawnPopup
        open
        drawParticipants={null}
        matchType="singles"
        rosterPlayers={rosterPlayers}
        onConfirm={() => {}}
        onDismiss={onDismiss}
        isConfirming={false}
        confirmError={false}
      />,
    )

    expect(
      screen.getByText("The first match couldn't be drawn automatically -- draw it from Manage Tournament."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go to Manage Tournament' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm with the unedited draw and manuallyAdjusted=false when confirmed as-is', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <FirstMatchDrawnPopup
        open
        drawParticipants={drawParticipants}
        matchType="singles"
        rosterPlayers={rosterPlayers}
        onConfirm={onConfirm}
        onDismiss={() => {}}
        isConfirming={false}
        confirmError={false}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Go to Manage Tournament' }))

    expect(onConfirm).toHaveBeenCalledWith(drawParticipants, false)
  })

  it('allows editing the draw before confirming, passing manuallyAdjusted=true and the edited lineup', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <FirstMatchDrawnPopup
        open
        drawParticipants={drawParticipants}
        matchType="singles"
        rosterPlayers={rosterPlayers}
        onConfirm={onConfirm}
        onDismiss={() => {}}
        isConfirming={false}
        confirmError={false}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Team 1 player 1' }), 'p3')
    await user.click(screen.getByRole('button', { name: 'Go to Manage Tournament' }))

    expect(onConfirm).toHaveBeenCalledWith(
      [
        { playerId: 'p3', team: 1 },
        { playerId: 'p2', team: 2 },
      ],
      true,
    )
  })

  it('shows a non-blocking warning when an edit leaves a 2-2 doubles quartet split into same-gender teams', async () => {
    const doublesRoster: RosterPlayer[] = [
      { id: 'p1', name: 'Ann', gender: 'male' },
      { id: 'p2', name: 'Ben', gender: 'male' },
      { id: 'p3', name: 'Cid', gender: 'female' },
      { id: 'p4', name: 'Dee', gender: 'female' },
      { id: 'p5', name: 'Eve', gender: 'male' },
    ]
    const doublesDraw: GeneratedMatchParticipant[] = [
      { playerId: 'p1', team: 1 },
      { playerId: 'p2', team: 1 },
      { playerId: 'p3', team: 2 },
      { playerId: 'p4', team: 2 },
    ]
    const warningText = "This lineup isn't gender-mixed, though a mixed pairing was possible."
    const user = userEvent.setup()
    render(
      <FirstMatchDrawnPopup
        open
        drawParticipants={doublesDraw}
        matchType="doubles"
        rosterPlayers={doublesRoster}
        onConfirm={() => {}}
        onDismiss={() => {}}
        isConfirming={false}
        confirmError={false}
      />,
    )

    expect(screen.queryByText(warningText)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Team 1 player 2' }), 'p5')

    expect(await screen.findByText(warningText)).toBeInTheDocument()
  })

  it('disables Confirm while confirming and shows an error message on failure', () => {
    render(
      <FirstMatchDrawnPopup
        open
        drawParticipants={drawParticipants}
        matchType="singles"
        rosterPlayers={rosterPlayers}
        onConfirm={() => {}}
        onDismiss={() => {}}
        isConfirming
        confirmError
      />,
    )

    expect(screen.getByRole('button', { name: 'Go to Manage Tournament' })).toBeDisabled()
    expect(screen.getByText('Failed to draw a match.')).toBeInTheDocument()
  })
})
