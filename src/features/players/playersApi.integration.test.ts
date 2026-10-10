import { afterAll, describe, expect, it } from 'vitest'
import {
  createPlayer,
  getPlayerStats,
  listPlayers,
  updatePlayer,
} from './playersApi'
import { supabase } from '../../lib/supabaseClient'
import { testWritePassphrase } from '../../test/testPassphrase'

describe('playersApi (real project, anon key)', () => {
  const testPlayerName = `Players API Test ${crypto.randomUUID()}`
  let createdId: string | undefined
  let disposableId: string | undefined

  afterAll(async () => {
    if (createdId) {
      await supabase.from('players').delete().eq('id', createdId)
    }
    if (disposableId) {
      await supabase.from('players').delete().eq('id', disposableId)
    }
  })

  it('creates a player, sees it in the list, and its stats show a fresh player', async () => {
    const created = await createPlayer(
      {
        name: testPlayerName,
        gender: 'female',
        sport: 'badminton',
        self_selected_level: 'intermediate',
      },
      testWritePassphrase,
    )
    createdId = created.id
    expect(created.name).toBe(testPlayerName)

    const players = await listPlayers()
    expect(players.some((p) => p.id === createdId)).toBe(true)

    const stats = await getPlayerStats(createdId, 'badminton')
    expect(stats).not.toBeNull()
    expect(stats?.total_matches).toBe(0)
    expect(stats?.effective_level).toBe('intermediate')
  })

  it('updates a player', async () => {
    if (!createdId) throw new Error('createdId not set from previous test')

    const updated = await updatePlayer(
      createdId,
      { sport: 'badminton', self_selected_level: 'advanced' },
      testWritePassphrase,
    )
    expect(updated.badminton_self_selected_level).toBe('advanced')
  })

  it('rejects creating or renaming a player onto a name that collides case/whitespace-insensitively', async () => {
    if (!createdId) throw new Error('createdId not set from previous test')

    await expect(
      createPlayer(
        {
          name: `  ${testPlayerName.toUpperCase()}  `,
          gender: 'male',
          sport: 'badminton',
          self_selected_level: 'beginner',
        },
        testWritePassphrase,
      ),
    ).rejects.toThrow('name_taken')

    const disposableName = `Players API Test Disposable ${crypto.randomUUID()}`
    const disposable = await createPlayer(
      {
        name: disposableName,
        gender: 'female',
        sport: 'badminton',
        self_selected_level: 'beginner',
      },
      testWritePassphrase,
    )
    disposableId = disposable.id

    await expect(
      updatePlayer(createdId, { name: disposableName }, testWritePassphrase),
    ).rejects.toThrow('name_taken')
  })
})
