import { supabase } from '../../lib/supabaseClient'
import type { Tables, TablesInsert, TablesUpdate } from '../../lib/database.types'

export type Player = Tables<'players'>
export type PlayerStats = Tables<'player_stats'>

export async function listPlayers(): Promise<Player[]> {
  const { data, error } = await supabase.from('players').select('*').order('name')
  if (error) throw error
  return data
}

export async function createPlayer(
  input: TablesInsert<'players'>,
  passphrase: string,
): Promise<Player> {
  const { data, error } = await supabase.rpc('create_player', {
    p_name: input.name,
    p_gender: input.gender,
    p_self_selected_level: input.self_selected_level,
    p_passphrase: passphrase,
  })
  if (error) throw error
  return data
}

export async function updatePlayer(
  id: string,
  updates: TablesUpdate<'players'>,
  passphrase: string,
): Promise<Player> {
  const { data, error } = await supabase.rpc('update_player', {
    p_id: id,
    p_passphrase: passphrase,
    p_name: updates.name,
    p_gender: updates.gender,
    p_self_selected_level: updates.self_selected_level,
  })
  if (error) throw error
  return data
}

export async function getPlayerStats(playerId: string): Promise<PlayerStats | null> {
  const { data, error } = await supabase
    .from('player_stats')
    .select('*')
    .eq('player_id', playerId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listPlayerStats(): Promise<PlayerStats[]> {
  const { data, error } = await supabase.from('player_stats').select('*')
  if (error) throw error
  return data
}
