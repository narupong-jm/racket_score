import { supabase } from '../../lib/supabaseClient'
import type { Tables, TablesInsert, TablesUpdate } from '../../lib/database.types'

export type Player = Tables<'players'>
export type PlayerStats = Tables<'player_stats'>

export async function listPlayers(): Promise<Player[]> {
  const { data, error } = await supabase.from('players').select('*').order('name')
  if (error) throw error
  return data
}

export async function createPlayer(input: TablesInsert<'players'>): Promise<Player> {
  const { data, error } = await supabase.from('players').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updatePlayer(
  id: string,
  updates: TablesUpdate<'players'>,
): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
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
