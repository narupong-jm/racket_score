import { supabase } from '../../lib/supabaseClient'
import type { Json, Tables } from '../../lib/database.types'

export type Match = Tables<'matches'>
export type TournamentStanding = Tables<'tournament_standings'>

export interface MatchParticipantInput {
  player_id: string
  team: 1 | 2
}

export async function createMatch(
  tournamentId: string,
  sequenceNumber: number,
  participants: MatchParticipantInput[],
): Promise<Match> {
  const { data, error } = await supabase.rpc('create_match', {
    p_tournament_id: tournamentId,
    p_sequence_number: sequenceNumber,
    p_participants: participants as unknown as Json,
  })
  if (error) throw error
  return data
}

export interface GameResultInput {
  game_number: number
  team1_score: number
  team2_score: number
}

export async function recordMatchResult(
  matchId: string,
  games: GameResultInput[],
): Promise<Match> {
  const { data, error } = await supabase.rpc('record_match_result', {
    p_match_id: matchId,
    p_games: games as unknown as Json,
  })
  if (error) throw error
  return data
}

export interface MatchHistoryEntry {
  match_id: string
  player_id: string
  team: number
}

export async function getMatchHistory(tournamentId: string): Promise<MatchHistoryEntry[]> {
  const { data, error } = await supabase
    .from('match_participants')
    .select('match_id, player_id, team, matches!inner(tournament_id, status)')
    .eq('matches.tournament_id', tournamentId)
    .eq('matches.status', 'completed')
  if (error) throw error
  return (data ?? []).map((row) => ({
    match_id: row.match_id,
    player_id: row.player_id,
    team: row.team,
  }))
}

export async function getParticipantsForMatches(matchIds: string[]): Promise<MatchHistoryEntry[]> {
  if (matchIds.length === 0) return []
  const { data, error } = await supabase
    .from('match_participants')
    .select('match_id, player_id, team')
    .in('match_id', matchIds)
  if (error) throw error
  return data
}

export async function listMatches(tournamentId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sequence_number', { ascending: true })
  if (error) throw error
  return data
}

export async function getStandings(tournamentId: string): Promise<TournamentStanding[]> {
  const { data, error } = await supabase
    .from('tournament_standings')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('games_won', { ascending: false })
    .order('point_diff', { ascending: false })
    .order('player_id', { ascending: true }) // stable tiebreak for fully-tied players
  if (error) throw error
  return data
}
