import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNonSportMembers } from './useSportMembers'
import { usePlayerStatsList } from './usePlayerStatsList'
import { useUpdatePlayer } from './useUpdatePlayer'
import { otherSport } from './playerMembership'
import { PLAYER_LEVELS, type PlayerLevel } from './playerLevels'
import { useSport } from '../sport/useSport'

export function AddExistingMemberForm() {
  const { t } = useTranslation()
  const { sport } = useSport()
  const other = otherSport(sport!)
  const { data: candidates } = useNonSportMembers(sport!)
  const { data: otherStats } = usePlayerStatsList(other)
  const [selectedId, setSelectedId] = useState('')
  const [level, setLevel] = useState<PlayerLevel>('beginner')
  const { mutate, isPending, isError } = useUpdatePlayer()

  if (!candidates || candidates.length === 0) {
    return <p className="empty-state">{t('member.addExistingEmpty')}</p>
  }

  const otherLevelByPlayerId = new Map(
    (otherStats ?? []).map((s) => [s.player_id, s.effective_level]),
  )

  function handleAdd() {
    if (!selectedId || !sport) return
    mutate(
      { id: selectedId, updates: { sport, self_selected_level: level } },
      {
        onSuccess: () => {
          setSelectedId('')
          setLevel('beginner')
        },
      },
    )
  }

  return (
    <div>
      <label className="field">
        <span className="field-label">
          {t('member.addExistingSelectLabel')}
        </span>
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">{t('member.addExistingPlaceholder')}</option>
          {candidates.map((player) => {
            const otherLevel = otherLevelByPlayerId.get(player.id)
            const label = otherLevel
              ? t('member.addExistingOption', {
                  name: player.name,
                  sport: t(`sport.${other}`),
                  level: t(`level.${otherLevel}`),
                })
              : t('member.addExistingOptionPlain', { name: player.name })
            return (
              <option key={player.id} value={player.id}>
                {label}
              </option>
            )
          })}
        </select>
      </label>
      <label className="field">
        <span className="field-label">
          {t('member.addExistingLevelLabel')}
        </span>
        <select
          value={level}
          onChange={(event) => setLevel(event.target.value as PlayerLevel)}
        >
          {PLAYER_LEVELS.map((l) => (
            <option key={l} value={l}>
              {t(`level.${l}`)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!selectedId || isPending}
        onClick={handleAdd}
      >
        {t('member.addExistingButton')}
      </button>
      {isError && (
        <p className="field-error">{t('member.addExistingFailed')}</p>
      )}
    </div>
  )
}
