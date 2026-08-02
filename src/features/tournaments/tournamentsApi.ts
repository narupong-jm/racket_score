import { supabase } from '../../lib/supabaseClient'
import type { Tables } from '../../lib/database.types'
import type { TournamentStanding } from '../matches/matchesApi'

export type Tournament = Tables<'tournaments'>
export type TournamentParticipant = Tables<'tournament_participants'>

export interface CreateTournamentInput {
  name: string
  type: 'singles' | 'doubles'
  games_per_match: number
  points_per_game: number
  win_by?: number
}

export async function createTournament(input: CreateTournamentInput): Promise<Tournament> {
  const { data, error } = await supabase.from('tournaments').insert(input).select().single()
  if (error) throw error
  return data
}

export async function listTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addParticipant(
  tournamentId: string,
  playerId: string,
): Promise<TournamentParticipant> {
  const { data, error } = await supabase
    .from('tournament_participants')
    .insert({ tournament_id: tournamentId, player_id: playerId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
  const { data, error } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('tournament_id', tournamentId)
  if (error) throw error
  return data
}

export async function getTournamentStandingsRanked(
  tournamentId: string,
): Promise<TournamentStanding[]> {
  const { data, error } = await supabase
    .from('tournament_standings')
    .select('*')
    .eq('tournament_id', tournamentId)
  if (error) throw error
  return data
}

export async function endTournament(tournamentId: string): Promise<Tournament> {
  const { data, error } = await supabase
    .from('tournaments')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', tournamentId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function cancelTournament(tournamentId: string): Promise<Tournament> {
  const { data, error } = await supabase.rpc('cancel_tournament', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return data
}
