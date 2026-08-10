import { describe, expect, it } from 'vitest'
import { supabase } from './supabaseClient'

describe('supabaseClient (real project, anon key)', () => {
  it('reads rows, proving RLS permits anon read access from the client', async () => {
    const { data: rows, error } = await supabase
      .from('players')
      .select('id')
      .limit(1)

    expect(error).toBeNull()
    expect(Array.isArray(rows)).toBe(true)
  })

  // As of Phase 16, direct table writes are no longer permitted for anon --
  // every write goes through a passphrase-gated RPC instead (see
  // docs/PLAN.md Phase 16 step 4). This replaces the pre-Phase-16 version of
  // this test, which asserted the opposite (that a direct anon insert
  // succeeded) -- that assertion is now false by design, not a regression.
  it('rejects a direct insert, proving the anon table grant was revoked', async () => {
    const { error } = await supabase
      .from('players')
      .insert({
        name: 'Should Not Be Insertable',
        gender: 'male',
        badminton_self_selected_level: 'beginner',
      })
      .select()
      .single()

    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501') // Postgres: permission denied
  })
})
