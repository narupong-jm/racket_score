import { afterAll, describe, expect, it } from 'vitest'
import { supabase } from './supabaseClient'

describe('supabaseClient (real project, anon key)', () => {
  const testPlayerName = `Integration Test Player ${crypto.randomUUID()}`
  let insertedId: string | undefined

  it('inserts and reads a row, proving RLS permits anon access from the client', async () => {
    const { data: inserted, error: insertError } = await supabase
      .from('players')
      .insert({ name: testPlayerName, gender: 'male', self_selected_level: 'beginner' })
      .select()
      .single()

    expect(insertError).toBeNull()
    expect(inserted?.name).toBe(testPlayerName)
    insertedId = inserted?.id

    const { data: rows, error: selectError } = await supabase
      .from('players')
      .select('*')
      .eq('id', insertedId!)

    expect(selectError).toBeNull()
    expect(rows).toHaveLength(1)
    expect(rows?.[0].name).toBe(testPlayerName)
  })

  afterAll(async () => {
    if (insertedId) {
      await supabase.from('players').delete().eq('id', insertedId)
    }
  })
})
