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

export async function createTournament(
  input: CreateTournamentInput,
  passphrase: string,
): Promise<Tournament> {
  const { data, error } = await supabase.rpc('create_tournament', {
    p_name: input.name,
    p_type: input.type,
    p_games_per_match: input.games_per_match,
    p_points_per_game: input.points_per_game,
    p_win_by: input.win_by,
    p_passphrase: passphrase,
  })
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
  passphrase: string,
): Promise<TournamentParticipant> {
  const { data, error } = await supabase.rpc('add_participant', {
    p_tournament_id: tournamentId,
    p_player_id: playerId,
    p_passphrase: passphrase,
  })
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

export async function endTournament(tournamentId: string, passphrase: string): Promise<Tournament> {
  const { data, error } = await supabase.rpc('end_tournament', {
    p_tournament_id: tournamentId,
    p_passphrase: passphrase,
  })
  if (error) throw error
  return data
}

export async function cancelTournament(
  tournamentId: string,
  passphrase: string,
): Promise<Tournament> {
  const { data, error } = await supabase.rpc('cancel_tournament', {
    p_tournament_id: tournamentId,
    p_passphrase: passphrase,
  })
  if (error) throw error
  return data
}
