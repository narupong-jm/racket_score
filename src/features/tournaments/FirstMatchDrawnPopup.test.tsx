import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FirstMatchDrawnPopup } from './FirstMatchDrawnPopup'
import type { GeneratedMatchParticipant } from '../matchmaking/generateNextMatch'

const playerNameById = new Map([
  ['p1', 'Alice'],
  ['p2', 'Bob'],
])

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
        playerNameById={playerNameById}
        onGoToManageTournament={() => {}}
      />,
    )

    expect(screen.getByText((_, element) => element?.textContent === 'First match: Alice vs Bob')).toBeInTheDocument()
    expect(screen.queryByText(/couldn't be drawn/i)).not.toBeInTheDocument()
  })

  it('shows the fallback message when no match could be drawn (defensive branch)', () => {
    render(
      <FirstMatchDrawnPopup
        open
        drawParticipants={null}
        playerNameById={playerNameById}
        onGoToManageTournament={() => {}}
      />,
    )

    expect(
      screen.getByText("The first match couldn't be drawn automatically -- draw it from Manage Tournament."),
    ).toBeInTheDocument()
  })

  it('calls onGoToManageTournament when the confirm button is clicked', async () => {
    const onGoToManageTournament = vi.fn()
    const user = userEvent.setup()
    render(
      <FirstMatchDrawnPopup
        open
        drawParticipants={drawParticipants}
        playerNameById={playerNameById}
        onGoToManageTournament={onGoToManageTournament}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Go to Manage Tournament' }))

    expect(onGoToManageTournament).toHaveBeenCalledTimes(1)
  })
})
