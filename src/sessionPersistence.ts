import {
  exportSerializedGameSession,
  parseSerializedGameSession,
  type SerializedGameSession,
} from './session'
import { getGameDefinition } from './games/registry'
import { useGameStore } from './store'

let hasBootstrappedSession = false
let autosaveUnsubscribe: (() => void) | null = null
let lastSavedSnapshot = ''

function getSessionStorageKey(gameId: string, gameVersion: number) {
  const game = getGameDefinition(gameId)
  return `${game.session.storageKeyPrefix}-v${gameVersion}`
}

function readStoredSession(): SerializedGameSession | null {
  if (typeof window === 'undefined') {
    return null
  }

  let latestSession: SerializedGameSession | null = null
  let latestSavedAt = Number.NEGATIVE_INFINITY

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key || !key.includes('-session-v')) continue
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) continue

    try {
      const parsedSession = parseSerializedGameSession(JSON.parse(rawValue))
      const savedAt = Date.parse(parsedSession.savedAt)
      const sortValue = Number.isNaN(savedAt) ? 0 : savedAt
      if (!latestSession || sortValue > latestSavedAt) {
        latestSession = parsedSession
        latestSavedAt = sortValue
      }
    } catch {
      window.localStorage.removeItem(key)
    }
  }

  return latestSession
}

function writeStoredSession(session: SerializedGameSession) {
  if (typeof window === 'undefined') {
    return
  }

  const serialized = JSON.stringify(session)
  lastSavedSnapshot = serialized
  window.localStorage.setItem(getSessionStorageKey(session.state.gameId, session.state.gameVersion), serialized)
}

export function bootstrapStoredGameSession() {
  if (hasBootstrappedSession || typeof window === 'undefined') {
    return
  }

  hasBootstrappedSession = true

  const storedSession = readStoredSession()
  if (storedSession) {
    useGameStore.getState().importGameSession(storedSession)
    lastSavedSnapshot = JSON.stringify(storedSession)
  }
}

export function startGameSessionAutosave() {
  if (typeof window === 'undefined' || autosaveUnsubscribe) {
    return autosaveUnsubscribe ?? (() => {})
  }

  autosaveUnsubscribe = useGameStore.subscribe((state) => {
    const serializedSession = exportSerializedGameSession(state)
    const nextSnapshot = JSON.stringify(serializedSession)
    if (nextSnapshot === lastSavedSnapshot) {
      return
    }

    lastSavedSnapshot = nextSnapshot
    window.localStorage.setItem(getSessionStorageKey(serializedSession.state.gameId, serializedSession.state.gameVersion), nextSnapshot)
  })

  return () => {
    autosaveUnsubscribe?.()
    autosaveUnsubscribe = null
  }
}

export function persistImportedGameSession(session: SerializedGameSession) {
  writeStoredSession(session)
}

export function clearStoredGameSession() {
  if (typeof window === 'undefined') {
    return
  }

  lastSavedSnapshot = ''
  const state = useGameStore.getState()
  window.localStorage.removeItem(getSessionStorageKey(state.activeGameId, state.activeGameVersion))
}

export function parseGameSessionFileContent(content: string): SerializedGameSession {
  return parseSerializedGameSession(JSON.parse(content))
}
