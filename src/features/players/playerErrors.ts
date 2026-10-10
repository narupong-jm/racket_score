/**
 * Maps a failed per-sport Remove (the `remove_player_from_sport` RPC raises
 * bare codes as its message, or the passphrase prompt was dismissed) to the
 * locale key to show, or null when nothing should be shown (the user
 * cancelled the prompt themselves). Also detects a `name_taken` rejection
 * from `create_player`/`update_player` (raised directly, or surfaced as a
 * genuine Postgres unique_violation when the RPC's own pre-check loses a
 * race). Pure, like `startMatchError.ts` -- no react-i18next import here.
 */
export function removeMemberErrorKey(error: unknown): string | null {
  const message = error instanceof Error ? error.message : ''
  if (message === 'passphrase_cancelled') return null
  if (message.includes('player_has_matches')) {
    return 'member.removeFailedHasMatches'
  }
  if (message.includes('player_in_tournament')) {
    return 'member.removeFailedInTournament'
  }
  return 'member.removeFailed'
}

export function isNameTakenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('name_taken')) return true
  return (error as { code?: string } | undefined)?.code === '23505'
}
