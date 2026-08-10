import { supabase } from '../../lib/supabaseClient'
import type { Tables } from '../../lib/database.types'
import type { Sport } from '../sport/sportTypes'
import type { Gender, PlayerLevel } from './playerLevels'

export type Player = Tables<'players'>
export type PlayerStats = Tables<'player_stats'>

export interface CreatePlayerInput {
  name: string
  gender: Gender
  sport: Sport
  self_selected_level: PlayerLevel
}

export interface UpdatePlayerInput {
  name?: string
  gender?: Gender
  sport?: Sport
  self_selected_level?: PlayerLevel
}

export async function listPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function createPlayer(
  input: CreatePlayerInput,
  passphrase: string,
): Promise<Player> {
  const { data, error } = await supabase.rpc('create_player', {
    p_name: input.name,
    p_gender: input.gender,
    p_sport: input.sport,
    p_self_selected_level: input.self_selected_level,
    p_passphrase: passphrase,
  })
  if (error) throw error
  return data
}

export async function updatePlayer(
  id: string,
  updates: UpdatePlayerInput,
  passphrase: string,
): Promise<Player> {
  const { data, error } = await supabase.rpc('update_player', {
    p_id: id,
    p_passphrase: passphrase,
    p_name: updates.name,
    p_gender: updates.gender,
    p_sport: updates.sport,
    p_self_selected_level: updates.self_selected_level,
  })
  if (error) throw error
  return data
}

export async function deletePlayer(
  id: string,
  passphrase: string,
): Promise<void> {
  const { error } = await supabase.rpc('delete_player', {
    p_id: id,
    p_passphrase: passphrase,
  })
  if (error) throw error
}

export async function getPlayerStats(
  playerId: string,
  sport: Sport,
): Promise<PlayerStats | null> {
  const { data, error } = await supabase
    .from('player_stats')
    .select('*')
    .eq('player_id', playerId)
    .eq('sport', sport)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listPlayerStats(sport: Sport): Promise<PlayerStats[]> {
  const { data, error } = await supabase
    .from('player_stats')
    .select('*')
    .eq('sport', sport)
  if (error) throw error
  return data
}
