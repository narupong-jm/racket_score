import { supabase } from '../../lib/supabaseClient'
import type { Json, Tables } from '../../lib/database.types'
import type { Sport } from '../sport/sportTypes'

export type Match = Tables<'matches'>
export type TournamentStanding = Tables<'tournament_standings'>
export type MatchGame = Tables<'match_games'>

export interface MatchParticipantInput {
  player_id: string
  team: 1 | 2
}

export async function createMatch(
  tournamentId: string,
  sequenceNumber: number,
  participants: MatchParticipantInput[],
  passphrase: string,
  manuallyAdjusted = false,
): Promise<Match> {
  const { data, error } = await supabase.rpc('create_match', {
    p_tournament_id: tournamentId,
    p_sequence_number: sequenceNumber,
    p_participants: participants as unknown as Json,
    p_passphrase: passphrase,
    p_manually_adjusted: manuallyAdjusted,
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
  passphrase: string,
): Promise<Match> {
  const { data, error } = await supabase.rpc('record_match_result', {
    p_match_id: matchId,
    p_games: games as unknown as Json,
    p_passphrase: passphrase,
  })
  if (error) throw error
  return data
}

export interface MatchHistoryEntry {
  match_id: string
  player_id: string
  team: number
}

export async function getMatchHistory(
  tournamentId: string,
): Promise<MatchHistoryEntry[]> {
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

export async function getParticipantsForMatches(
  matchIds: string[],
): Promise<MatchHistoryEntry[]> {
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

export async function listGamesForMatches(
  matchIds: string[],
): Promise<MatchGame[]> {
  if (matchIds.length === 0) return []
  const { data, error } = await supabase
    .from('match_games')
    .select('*')
    .in('match_id', matchIds)
    .order('game_number', { ascending: true })
  if (error) throw error
  return data
}

export interface RecentCompletedMatch {
  match: Match
  tournamentName: string
  participants: MatchHistoryEntry[]
  games: MatchGame[]
}

export async function listRecentCompletedMatches(
  sport: Sport,
): Promise<RecentCompletedMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*, tournaments!inner(name, sport)')
    .eq('status', 'completed')
    .eq('tournaments.sport', sport)
    .order('completed_at', { ascending: false })
  if (error) throw error

  const matches = data ?? []
  const matchIds = matches.map((m) => m.id)
  const [participants, games] = await Promise.all([
    getParticipantsForMatches(matchIds),
    listGamesForMatches(matchIds),
  ])

  return matches.map(({ tournaments, ...match }) => ({
    match,
    tournamentName: tournaments?.name ?? '',
    participants: participants.filter((p) => p.match_id === match.id),
    games: games.filter((g) => g.match_id === match.id),
  }))
}
