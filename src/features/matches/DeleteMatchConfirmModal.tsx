import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import { useDeleteMatchResult } from './useDeleteMatchResult'
import { usePlayerStatsList } from '../players/usePlayerStatsList'
import { computeMatchImpactPreview } from './matchImpactPreview'
import type { RecentCompletedMatch } from './matchesApi'
import type { Sport } from '../sport/sportTypes'

function formatWinRate(rate: number | null): string {
  return rate === null ? '—' : `${rate}%`
}

interface DeleteMatchConfirmModalProps {
  row: RecentCompletedMatch | null
  sport: Sport
  playerNameById: Map<string, string>
  onClose: () => void
}

export function DeleteMatchConfirmModal({
  row,
  sport,
  playerNameById,
  onClose,
}: DeleteMatchConfirmModalProps) {
  const { t } = useTranslation()
  const [passphrase, setPassphrase] = useState('')
  const deleteMatchResult = useDeleteMatchResult()
  const { data: statsList } = usePlayerStatsList(sport)

  // While player stats are still loading there's nothing sensible to preview
  // yet -- rather than block the whole modal on it, just skip the impact
  // section for this render; it reappears once the query resolves.
  const statsByPlayerId = new Map(
    (statsList ?? []).map((s) => [s.player_id, s]),
  )
  const impact =
    row && statsList
      ? computeMatchImpactPreview(
          row.participants,
          row.games,
          statsByPlayerId,
          playerNameById,
        )
      : []

  function handleClose() {
    setPassphrase('')
    deleteMatchResult.reset()
    onClose()
  }

  function handleConfirm() {
    if (!row) return
    deleteMatchResult.mutate(
      { matchId: row.match.id, passphrase },
      {
        onSuccess: () => {
          setPassphrase('')
          onClose()
        },
      },
    )
  }

  return (
    <Modal open={row !== null} onClose={handleClose}>
      <h3>{t('matches.deleteConfirm.title')}</h3>
      <p>{t('matches.deleteConfirm.body')}</p>
      {impact.length > 0 && (
        <>
          <p>{t('matches.deleteConfirm.impactHeading')}</p>
          <ul className="review-list">
            {impact.map((entry) => (
              <li key={entry.playerId}>
                {t('matches.deleteConfirm.impactLine', {
                  playerName: entry.playerName,
                  beforeMatches: entry.beforeMatches,
                  beforeWinRate: formatWinRate(entry.beforeWinRate),
                  afterMatches: entry.afterMatches,
                  afterWinRate: formatWinRate(entry.afterWinRate),
                })}
              </li>
            ))}
          </ul>
        </>
      )}
      <label className="field">
        <span className="field-label">
          {t('matches.deleteConfirm.passphraseLabel')}
        </span>
        <input
          type="password"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          disabled={deleteMatchResult.isPending}
          autoFocus
        />
      </label>
      {deleteMatchResult.isError && (
        <p className="field-error">{t('matches.deleteConfirm.error')}</p>
      )}
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={handleClose}>
          {t('manage.cancel')}
        </button>
        <button
          type="button"
          className="danger"
          onClick={handleConfirm}
          disabled={deleteMatchResult.isPending || passphrase.length === 0}
        >
          {t('matches.deleteConfirm.confirmButton')}
        </button>
      </div>
    </Modal>
  )
}
