import type { GameDefinition } from '../types'
import { marvelBoardDefinition } from './board'
import { marvelShortcuts } from './shortcuts'
import { marvelCardPresentation, marvelCardSemantics } from './cards'
import { marvelSetupDefinition } from './setup'

export const marvelGameDefinition: GameDefinition = {
  id: 'marvel-champions',
  name: 'Marvel Champions',
  version: 1,
  session: {
    schemaVersion: 5,
    storageKeyPrefix: 'marvel-champions-session',
    exportFilePrefix: 'marvel-session',
  },
  board: marvelBoardDefinition,
  setup: marvelSetupDefinition,
  shortcuts: marvelShortcuts,
  cardSemantics: marvelCardSemantics,
  cardPresentation: marvelCardPresentation,
  actions: {
    getRegionConfig: marvelBoardDefinition.getRegionConfig,
  },
  ui: {
    gameTitle: 'Marvel Champions',
    newGameTitle: 'Start New Game',
    newGameEyebrow: 'Setup',
    newGameButtonLabel: 'Start game',
    preparingNewGameLabel: 'Preparing new game...',
    settlingNewGameLabel: 'Finishing setup...',
    keyboardShortcutsTitle: 'Keyboard Shortcuts',
    keyboardShortcutsIntro: 'Shortcuts are disabled while a text field, button, or modal is focused. Counter shortcuts only work on a visible hovered card.',
    menuTitle: 'Game Menu',
    menuEyebrow: 'Board',
  },
}
