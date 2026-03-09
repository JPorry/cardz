import type { GameDefinition } from './types'
import { marvelGameDefinition } from './marvel/definition'

const REGISTERED_GAMES = [marvelGameDefinition] as const

const GAME_MAP = new Map<string, GameDefinition>(
  REGISTERED_GAMES.map((game) => [game.id, game]),
)

export function getRegisteredGames(): GameDefinition[] {
  return [...REGISTERED_GAMES]
}

export function getDefaultGame(): GameDefinition {
  return REGISTERED_GAMES[0]
}

export function getGameDefinition(gameId: string): GameDefinition {
  const game = GAME_MAP.get(gameId)
  if (!game) {
    throw new Error(`Unknown game "${gameId}".`)
  }
  return game
}
