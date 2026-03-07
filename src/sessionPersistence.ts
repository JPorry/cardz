import {
  exportSerializedGameSession,
  GAME_SESSION_STORAGE_KEY,
  parseSerializedGameSession,
  type SerializedGameSession,
} from './session'
import { useGameStore } from './store'

let hasBootstrappedSession = false
let autosaveUnsubscribe: (() => void) | null = null
let lastSavedSnapshot = ''

function readStoredSession(): SerializedGameSession | null {
  if (typeof window === 'undefined') {
    return null
  }

  const rawValue = window.localStorage.getItem(GAME_SESSION_STORAGE_KEY)
  if (!rawValue) {
    return null
  }

  try {
    return parseSerializedGameSession(JSON.parse(rawValue))
  } catch {
    window.localStorage.removeItem(GAME_SESSION_STORAGE_KEY)
    return null
  }
}

function writeStoredSession(session: SerializedGameSession) {
  if (typeof window === 'undefined') {
    return
  }

  const serialized = JSON.stringify(session)
  lastSavedSnapshot = serialized
  window.localStorage.setItem(GAME_SESSION_STORAGE_KEY, serialized)
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
    window.localStorage.setItem(GAME_SESSION_STORAGE_KEY, nextSnapshot)
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
  window.localStorage.removeItem(GAME_SESSION_STORAGE_KEY)
}

export function parseGameSessionFileContent(content: string): SerializedGameSession {
  return parseSerializedGameSession(JSON.parse(content))
}
