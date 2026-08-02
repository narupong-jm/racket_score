import { supabase } from '../../lib/supabaseClient'

export async function verifyWritePassphrase(passphrase: string): Promise<void> {
  const { error } = await supabase.rpc('verify_write_passphrase', { p_passphrase: passphrase })
  if (error) throw error
}
