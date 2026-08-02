import { afterAll, describe, expect, it } from 'vitest'
import { createPlayer, getPlayerStats, listPlayers, updatePlayer } from './playersApi'
import { supabase } from '../../lib/supabaseClient'
import { testWritePassphrase } from '../../test/testPassphrase'

describe('playersApi (real project, anon key)', () => {
  const testPlayerName = `Players API Test ${crypto.randomUUID()}`
  let createdId: string | undefined

  afterAll(async () => {
    if (createdId) {
      await supabase.from('players').delete().eq('id', createdId)
    }
  })

  it('creates a player, sees it in the list, and its stats show a fresh player', async () => {
    const created = await createPlayer(
      {
        name: testPlayerName,
        gender: 'female',
        self_selected_level: 'intermediate',
      },
      testWritePassphrase,
    )
    createdId = created.id
    expect(created.name).toBe(testPlayerName)

    const players = await listPlayers()
    expect(players.some((p) => p.id === createdId)).toBe(true)

    const stats = await getPlayerStats(createdId)
    expect(stats).not.toBeNull()
    expect(stats?.total_matches).toBe(0)
    expect(stats?.effective_level).toBe('intermediate')
  })

  it('updates a player', async () => {
    if (!createdId) throw new Error('createdId not set from previous test')

    const updated = await updatePlayer(
      createdId,
      { self_selected_level: 'advanced' },
      testWritePassphrase,
    )
    expect(updated.self_selected_level).toBe('advanced')
  })
})
