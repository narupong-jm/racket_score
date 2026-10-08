import type { GeneratedMatchParticipant } from '../features/matchmaking/generateNextMatch'

export interface QueuedMatch {
  participants: GeneratedMatchParticipant[]
  manuallyAdjusted: boolean
}

const EMPTY_QUEUE: QueuedMatch[] = Object.freeze([]) as unknown as QueuedMatch[]

function storageKey(tournamentId: string): string {
  return `racket-score.matchQueue.${tournamentId}`
}

// Pre-Phase-24 single "next draw" key; migrated lazily by getQueue.
function legacyKey(tournamentId: string): string {
  return `racket-score.nextDraw.${tournamentId}`
}

interface CacheEntry {
  raw: string | null
  value: QueuedMatch[]
  // true when the last write to localStorage failed, so `value` is the only
  // copy and must win over whatever (stale) storage returns.
  unsaved: boolean
}

const cache = new Map<string, CacheEntry>()
const listeners = new Map<string, Set<() => void>>()

function isParticipant(p: unknown): p is GeneratedMatchParticipant {
  if (typeof p !== 'object' || p === null) return false
  const o = p as Record<string, unknown>
  return typeof o.playerId === 'string' && (o.team === 1 || o.team === 2)
}

function isParticipantList(v: unknown): v is GeneratedMatchParticipant[] {
  return Array.isArray(v) && v.every(isParticipant)
}

function isQueue(v: unknown): v is QueuedMatch[] {
  return (
    Array.isArray(v) &&
    v.every((m) => {
      if (typeof m !== 'object' || m === null) return false
      const o = m as Record<string, unknown>
      return (
        isParticipantList(o.participants) &&
        typeof o.manuallyAdjusted === 'boolean'
      )
    })
  )
}

function parseQueue(raw: string): QueuedMatch[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return isQueue(parsed) && parsed.length > 0 ? parsed : EMPTY_QUEUE
  } catch {
    return EMPTY_QUEUE
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // storage unavailable (private mode etc.)
  }
}

// Returns false when the write failed.
function persist(tournamentId: string, raw: string | null): boolean {
  try {
    if (raw === null) localStorage.removeItem(storageKey(tournamentId))
    else localStorage.setItem(storageKey(tournamentId), raw)
    return true
  } catch {
    return false
  }
}

function migrateLegacy(tournamentId: string): QueuedMatch[] | null {
  let legacyRaw: string | null
  try {
    legacyRaw = localStorage.getItem(legacyKey(tournamentId))
  } catch {
    return null
  }
  if (legacyRaw === null) return null
  safeRemove(legacyKey(tournamentId))
  try {
    const parsed: unknown = JSON.parse(legacyRaw)
    if (!isParticipantList(parsed) || parsed.length === 0) return null
    const queue: QueuedMatch[] = [
      { participants: parsed, manuallyAdjusted: false },
    ]
    const raw = JSON.stringify(queue)
    const saved = persist(tournamentId, raw)
    cache.set(tournamentId, { raw, value: queue, unsaved: !saved })
    return queue
  } catch {
    return null
  }
}

export function getQueue(tournamentId: string): QueuedMatch[] {
  const entry = cache.get(tournamentId)
  if (entry?.unsaved) return entry.value

  let raw: string | null
  try {
    raw = localStorage.getItem(storageKey(tournamentId))
  } catch {
    return entry ? entry.value : EMPTY_QUEUE
  }

  if (raw === null) {
    const migrated = migrateLegacy(tournamentId)
    if (migrated) return migrated
    if (entry && entry.raw === null) return entry.value
    cache.set(tournamentId, { raw: null, value: EMPTY_QUEUE, unsaved: false })
    return EMPTY_QUEUE
  }

  if (entry && entry.raw === raw) return entry.value
  const value = parseQueue(raw)
  cache.set(tournamentId, { raw, value, unsaved: false })
  return value
}

function notify(tournamentId: string): void {
  listeners.get(tournamentId)?.forEach((l) => l())
}

export function setQueue(tournamentId: string, queue: QueuedMatch[]): void {
  const empty = queue.length === 0
  const raw = empty ? null : JSON.stringify(queue)
  const saved = persist(tournamentId, raw)
  cache.set(tournamentId, {
    raw,
    value: empty ? EMPTY_QUEUE : queue,
    unsaved: !saved,
  })
  notify(tournamentId)
}

export function shiftQueue(tournamentId: string): QueuedMatch | undefined {
  const current = getQueue(tournamentId)
  if (current.length === 0) return undefined
  const [head, ...rest] = current
  setQueue(tournamentId, rest)
  return head
}

export function clearQueue(tournamentId: string): void {
  setQueue(tournamentId, [])
}

export function subscribeQueue(
  tournamentId: string,
  listener: () => void,
): () => void {
  let set = listeners.get(tournamentId)
  if (!set) {
    set = new Set()
    listeners.set(tournamentId, set)
  }
  set.add(listener)

  const key = storageKey(tournamentId)
  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) listener()
  }
  window.addEventListener('storage', onStorage)

  return () => {
    set.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
