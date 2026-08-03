import { supabase } from '../../lib/supabaseClient'
import type { Tables } from '../../lib/database.types'
import type { TournamentType } from '../tournaments/tournamentType'

export type PlayerMatchHistoryRow = Tables<'player_match_history'>

export interface ListPlayerMatchHistoryFilters {
  since?: string
  tournamentType?: TournamentType
  tournamentId?: string
}

export async function listPlayerMatchHistory(
  filters: ListPlayerMatchHistoryFilters = {},
): Promise<PlayerMatchHistoryRow[]> {
  let query = supabase.from('player_match_history').select('*')
  if (filters.since) query = query.gte('completed_at', filters.since)
  if (filters.tournamentType) query = query.eq('tournament_type', filters.tournamentType)
  if (filters.tournamentId) query = query.eq('tournament_id', filters.tournamentId)
  const { data, error } = await query
  if (error) throw error
  return data
}
