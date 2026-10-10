/**
 * Maps a failed Start (the `create_match` RPC raises bare codes as its message,
 * or the passphrase prompt was dismissed) to the locale key to show, or null
 * when nothing should be shown (the user cancelled the prompt themselves).
 */
export function startMatchErrorKey(error: unknown): string | null {
  const message = error instanceof Error ? error.message : ''
  if (message === 'passphrase_cancelled') return null
  if (message.includes('court_occupied')) return 'manage.startFailedOccupied'
  if (message.includes('participant_on_court')) {
    return 'manage.startFailedPlayerBusy'
  }
  if (message.includes('tournament_not_active')) {
    return 'manage.startFailedInactive'
  }
  return 'manage.startFailed'
}
