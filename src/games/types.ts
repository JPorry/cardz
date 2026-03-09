import type { ComponentType } from 'react'
import type {
  BoardConfig,
  BoardLayoutConfig,
  RegionConfig,
} from '../config/board'
import type { CardState, GameSetupLayout } from '../store'

export type CardCounters = Record<string, number>
export type CardStatuses = Record<string, boolean>

export interface CardCounterDefinition {
  key: string
  label: string
  shortLabel: string
  color: string
  shortcutKey?: string
  shortcutDetail?: string
}

export interface CardStatusDefinition {
  key: string
  label: string
  shortLabel: string
  color: string
  shortcutKey?: string
  shortcutDetail?: string
}

export interface GameShortcutDefinition {
  key: string
  label: string
  detail: string
}

export interface ShortcutReferenceSection {
  eyebrow: string
  title: string
  items: GameShortcutDefinition[]
}

export interface GameCardSemantics {
  counters: CardCounterDefinition[]
  statuses: CardStatusDefinition[]
}

export interface GameCardPresentation {
  getDefaultCardBackUrl: (typeCode?: string) => string
  hasVisibleGameplayFace: (card: CardState) => boolean
}

export interface GameBoardDefinition {
  layout: BoardLayoutConfig
  getRegionConfig: (regionId: string) => RegionConfig | undefined
  config: BoardConfig
}

export interface GameSessionDefinition {
  schemaVersion: number
  storageKeyPrefix: string
  exportFilePrefix: string
}

export interface GameSetupRenderProps {
  disabled: boolean
  onErrorMessageChange: (message: string | null) => void
}

export interface GameSetupDefinition<TPreparedState extends GameSetupLayout = GameSetupLayout> {
  createInitialState: () => Record<string, unknown>
  Renderer: ComponentType<GameSetupRenderProps>
  prepare: (state: Record<string, unknown>) => Promise<TPreparedState>
}

export interface GameActionProvider {
  getRegionConfig: (regionId: string) => RegionConfig | undefined
}

export interface GameUiDefinition {
  gameTitle: string
  newGameTitle: string
  newGameEyebrow: string
  newGameButtonLabel: string
  preparingNewGameLabel: string
  settlingNewGameLabel: string
  keyboardShortcutsTitle: string
  keyboardShortcutsIntro: string
  menuTitle: string
  menuEyebrow: string
}

export interface GameDefinition<TPreparedState extends GameSetupLayout = GameSetupLayout> {
  id: string
  name: string
  version: number
  session: GameSessionDefinition
  board: GameBoardDefinition
  setup: GameSetupDefinition<TPreparedState>
  shortcuts: {
    board: GameShortcutDefinition[]
    sections: ShortcutReferenceSection[]
    counterShortcutKeys: Record<string, string>
    statusShortcutKeys: Record<string, string>
  }
  cardSemantics: GameCardSemantics
  cardPresentation: GameCardPresentation
  actions: GameActionProvider
  ui: GameUiDefinition
}
