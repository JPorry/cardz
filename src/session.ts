import type { CardLocation, CardState, DeckKind, DeckState, ExaminedStackState, GameState, LaneState, RegionState } from './store'
import type { TitlePosition } from './utils/areaLayout'
import { createInitialLanes, createInitialRegions } from './games/boardLayout'
import { getDefaultGame, getGameDefinition } from './games/registry'
import type { GameCardSemantics } from './games/types'
import { normalizeCardCounters, normalizeCardStatuses } from './utils/cardMetadata'

export const GAME_SESSION_VERSION = 5

export interface SerializedGameSessionState {
  gameId: string
  gameVersion: number
  cards: CardState[]
  decks: DeckState[]
  lanes: LaneState[]
  regions: RegionState[]
  examinedStack: ExaminedStackState | null
}

export interface SerializedGameSession {
  version: number
  savedAt: string
  state: SerializedGameSessionState
}

type ResettableGameState = Pick<
  GameState,
  | 'activeGameId'
  | 'activeGameVersion'
  | 'gameSetupState'
  | 'cards'
  | 'decks'
  | 'lanes'
  | 'regions'
  | 'activeLaneId'
  | 'activeRegionId'
  | 'lanePreviewLaneId'
  | 'lanePreviewIndex'
  | 'lanePreviewItemId'
  | 'handPreviewIndex'
  | 'handPreviewItemId'
  | 'hoveredCardId'
  | 'hoveredCardScreenX'
  | 'previewCardId'
  | 'focusedCardId'
  | 'examinedStack'
  | 'selectedItems'
  | 'draggedSelectionItems'
  | 'dragTargetContext'
  | 'selectionBounds'
  | 'marqueeSelection'
  | 'isDragging'
  | 'activeDragType'
>

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseTuple3(value: unknown, label: string): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 || value.some((entry) => !isFiniteNumber(entry))) {
    throw new Error(`Invalid ${label}. Expected a numeric tuple with length 3.`)
  }

  return [value[0], value[1], value[2]]
}

function parseStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => !isString(entry))) {
    throw new Error(`Invalid ${label}. Expected a string array.`)
  }

  return [...value]
}

function parseOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  if (!isString(value)) {
    throw new Error('Expected an optional string value.')
  }
  return value
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!isFiniteNumber(value)) {
    throw new Error('Expected an optional numeric value.')
  }
  return value
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!isBoolean(value)) {
    throw new Error('Expected an optional boolean value.')
  }
  return value
}

function parseCardLocation(value: unknown): CardLocation {
  if (value === 'deck' || value === 'hand' || value === 'table' || value === 'discard') {
    return value
  }

  throw new Error('Invalid card location.')
}

function parseDeckKind(value: unknown): DeckKind {
  if (value === undefined || value === null) {
    return 'stack'
  }
  if (value === 'stack' || value === 'sequence') {
    return value
  }
  throw new Error('Invalid deck kind.')
}

function parseTitlePosition(value: unknown): TitlePosition {
  if (value === 'top' || value === 'bottom' || value === 'left' || value === 'right') {
    return value
  }

  throw new Error('Invalid title position.')
}

function parseOptionalTitlePosition(value: unknown): TitlePosition {
  if (value === undefined || value === null || value === '') {
    return 'left'
  }

  return parseTitlePosition(value)
}

function parseCardState(value: unknown, semantics: GameCardSemantics): CardState {
  if (!isObject(value)) {
    throw new Error('Invalid card entry.')
  }

  if (!isString(value.id)) {
    throw new Error('Card entry is missing a valid id.')
  }

  if (!isBoolean(value.faceUp)) {
    throw new Error(`Card ${value.id} is missing a valid faceUp flag.`)
  }

  return {
    id: value.id,
    location: parseCardLocation(value.location),
    position: parseTuple3(value.position, `card ${value.id} position`),
    rotation: parseTuple3(value.rotation, `card ${value.id} rotation`),
    faceUp: value.faceUp,
    artworkUrl: parseOptionalString(value.artworkUrl),
    backArtworkUrl: parseOptionalString(value.backArtworkUrl),
    name: parseOptionalString(value.name),
    code: parseOptionalString(value.code),
    typeCode: parseOptionalString(value.typeCode),
    linkedTypeCode: parseOptionalString(value.linkedTypeCode),
    isIdentity: parseOptionalBoolean(value.isIdentity),
    text: parseOptionalString(value.text),
    stage: parseOptionalNumber(value.stage),
    cardSetCode: parseOptionalString(value.cardSetCode),
    laneId: parseOptionalString(value.laneId),
    regionId: parseOptionalString(value.regionId),
    tapped: parseOptionalBoolean(value.tapped),
    attachmentGroupId: parseOptionalString(value.attachmentGroupId),
    attachmentIndex: parseOptionalNumber(value.attachmentIndex),
    counters: normalizeCardCounters(semantics, isObject(value.counters) ? value.counters : undefined),
    statuses: normalizeCardStatuses(semantics, isObject(value.statuses) ? value.statuses : undefined),
  }
}

function parseDeckState(value: unknown): DeckState {
  if (!isObject(value)) {
    throw new Error('Invalid deck entry.')
  }

  if (!isString(value.id)) {
    throw new Error('Deck entry is missing a valid id.')
  }

  return {
    id: value.id,
    kind: parseDeckKind(value.kind),
    position: parseTuple3(value.position, `deck ${value.id} position`),
    rotation: parseTuple3(value.rotation, `deck ${value.id} rotation`),
    cardIds: parseStringArray(value.cardIds, `deck ${value.id} cardIds`),
    laneId: parseOptionalString(value.laneId),
    regionId: parseOptionalString(value.regionId),
  }
}

function parseLaneState(value: unknown): LaneState {
  if (!isObject(value)) {
    throw new Error('Invalid lane entry.')
  }

  if (!isString(value.id) || !isString(value.label)) {
    throw new Error('Lane entry is missing required fields.')
  }

  if (!isFiniteNumber(value.width) || !isFiniteNumber(value.depth) || !isFiniteNumber(value.cardSpacing) || !isBoolean(value.flipped)) {
    throw new Error(`Lane ${value.id} is missing valid geometry.`)
  }

  return {
    id: value.id,
    label: value.label,
    titlePosition: parseOptionalTitlePosition(value.titlePosition),
    position: parseTuple3(value.position, `lane ${value.id} position`),
    width: value.width,
    depth: value.depth,
    flipped: value.flipped,
    cardSpacing: value.cardSpacing,
    itemOrder: parseStringArray(value.itemOrder, `lane ${value.id} itemOrder`),
  }
}

function parseRegionState(value: unknown): RegionState {
  if (!isObject(value)) {
    throw new Error('Invalid region entry.')
  }

  if (!isString(value.id) || !isString(value.label)) {
    throw new Error('Region entry is missing required fields.')
  }

  if (!isFiniteNumber(value.width) || !isFiniteNumber(value.depth) || !isBoolean(value.flipped)) {
    throw new Error(`Region ${value.id} is missing valid geometry.`)
  }

  return {
    id: value.id,
    label: value.label,
    titlePosition: parseOptionalTitlePosition(value.titlePosition),
    position: parseTuple3(value.position, `region ${value.id} position`),
    width: value.width,
    depth: value.depth,
    flipped: value.flipped,
  }
}

function parseExaminedStackState(value: unknown): ExaminedStackState | null {
  if (value === undefined || value === null) {
    return null
  }

  if (!isObject(value) || !isString(value.deckId)) {
    throw new Error('Invalid examined stack entry.')
  }

  return {
    deckId: value.deckId,
    cardOrder: parseStringArray(value.cardOrder, 'examinedStack.cardOrder'),
    originalCardOrder: parseStringArray(value.originalCardOrder, 'examinedStack.originalCardOrder'),
    originalFaceUpCardIds: parseStringArray(
      value.originalFaceUpCardIds ?? [],
      'examinedStack.originalFaceUpCardIds',
    ),
    hiddenDeck: value.hiddenDeck === undefined ? true : Boolean(value.hiddenDeck),
  }
}

function cloneCard(card: CardState): CardState {
  return {
    ...card,
    position: [...card.position],
    rotation: [...card.rotation],
    counters: { ...card.counters },
    statuses: { ...card.statuses },
  }
}

function cloneDeck(deck: DeckState): DeckState {
  return {
    ...deck,
    position: [...deck.position],
    rotation: [...deck.rotation],
    cardIds: [...deck.cardIds],
  }
}

function cloneLane(lane: LaneState): LaneState {
  return {
    ...lane,
    position: [...lane.position],
    itemOrder: [...lane.itemOrder],
  }
}

function cloneRegion(region: RegionState): RegionState {
  return {
    ...region,
    position: [...region.position],
  }
}

function cloneExaminedStack(examinedStack: ExaminedStackState | null): ExaminedStackState | null {
  if (!examinedStack) return null

  return {
    ...examinedStack,
    cardOrder: [...examinedStack.cardOrder],
    originalCardOrder: [...examinedStack.originalCardOrder],
    originalFaceUpCardIds: [...examinedStack.originalFaceUpCardIds],
  }
}

function applyConfiguredLaneConfiguration(gameId: string, lane: LaneState): LaneState {
  const configuredLane = createInitialLanes(getGameDefinition(gameId).board.layout).find((entry) => entry.id === lane.id)
  return configuredLane
    ? {
      ...lane,
      label: configuredLane.label,
      titlePosition: configuredLane.titlePosition,
      position: [...configuredLane.position],
      width: configuredLane.width,
      depth: configuredLane.depth,
      flipped: configuredLane.flipped,
      cardSpacing: configuredLane.cardSpacing,
    }
    : lane
}

function applyConfiguredRegionConfiguration(gameId: string, region: RegionState): RegionState {
  const configuredRegion = createInitialRegions(getGameDefinition(gameId).board.layout).find((entry) => entry.id === region.id)
  return configuredRegion
    ? {
      ...region,
      label: configuredRegion.label,
      titlePosition: configuredRegion.titlePosition,
      position: [...configuredRegion.position],
      width: configuredRegion.width,
      depth: configuredRegion.depth,
      flipped: configuredRegion.flipped,
    }
    : region
}

function createDefaultResetState(gameId: string): ResettableGameState {
  const game = getGameDefinition(gameId)
  const initialLanes = createInitialLanes(game.board.layout)
  const initialRegions = createInitialRegions(game.board.layout)
  return {
    activeGameId: game.id,
    activeGameVersion: game.version,
    gameSetupState: game.setup.createInitialState(),
    cards: [],
    decks: [],
    lanes: initialLanes.map((lane) => ({ ...lane, itemOrder: [] })),
    regions: initialRegions.map(cloneRegion),
    activeLaneId: null,
    activeRegionId: null,
    lanePreviewLaneId: null,
    lanePreviewIndex: null,
    lanePreviewItemId: null,
    handPreviewIndex: null,
    handPreviewItemId: null,
    hoveredCardId: null,
    hoveredCardScreenX: null,
    previewCardId: null,
    focusedCardId: null,
    examinedStack: null,
    selectedItems: [],
    draggedSelectionItems: [],
    dragTargetContext: null,
    selectionBounds: null,
    marqueeSelection: {
      isActive: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      additive: false,
    },
    isDragging: false,
    activeDragType: null,
  }
}

export function createSessionStateSnapshot(
  state: Pick<GameState, 'activeGameId' | 'activeGameVersion' | 'cards' | 'decks' | 'lanes' | 'regions' | 'examinedStack'>,
): SerializedGameSessionState {
  return {
    gameId: state.activeGameId,
    gameVersion: state.activeGameVersion,
    cards: state.cards.map(cloneCard),
    decks: state.decks.map(cloneDeck),
    lanes: state.lanes.map(cloneLane),
    regions: state.regions.map(cloneRegion),
    examinedStack: cloneExaminedStack(state.examinedStack),
  }
}

export function exportSerializedGameSession(
  state: Pick<GameState, 'activeGameId' | 'activeGameVersion' | 'cards' | 'decks' | 'lanes' | 'regions' | 'examinedStack'>,
): SerializedGameSession {
  return {
    version: GAME_SESSION_VERSION,
    savedAt: new Date().toISOString(),
    state: createSessionStateSnapshot(state),
  }
}

export function parseSerializedGameSession(value: unknown): SerializedGameSession {
  if (!isObject(value)) {
    throw new Error('Invalid session payload.')
  }

  if (value.version !== 1 && value.version !== 3 && value.version !== GAME_SESSION_VERSION) {
    throw new Error(`Unsupported session version: ${String(value.version)}`)
  }

  if (!isString(value.savedAt)) {
    throw new Error('Session payload is missing savedAt.')
  }

  if (!isObject(value.state)) {
    throw new Error('Session payload is missing state.')
  }

  const gameId = isString(value.state.gameId) ? value.state.gameId : getDefaultGame().id
  const game = getGameDefinition(gameId)
  const cards = value.state.cards
  const decks = value.state.decks
  const lanes = value.state.lanes
  const regions = value.state.regions
  const examinedStack = 'examinedStack' in value.state ? value.state.examinedStack : null
  const gameVersion = typeof value.state.gameVersion === 'number' ? value.state.gameVersion : game.version

  if (!Array.isArray(cards) || !Array.isArray(decks) || !Array.isArray(lanes) || !Array.isArray(regions)) {
    throw new Error('Session payload must include cards, decks, lanes, and regions arrays.')
  }

  return {
    version: GAME_SESSION_VERSION,
    savedAt: value.savedAt,
    state: {
      gameId: game.id,
      gameVersion,
      cards: cards.map((card) => parseCardState(card, game.cardSemantics)),
      decks: decks.map(parseDeckState),
      lanes: lanes.map(parseLaneState),
      regions: regions.map(parseRegionState),
      examinedStack: parseExaminedStackState(examinedStack),
    },
  }
}

export function createImportedGameState(session: SerializedGameSession): ResettableGameState {
  const resetState = createDefaultResetState(session.state.gameId)
  return {
    ...resetState,
    activeGameId: session.state.gameId,
    activeGameVersion: session.state.gameVersion,
    gameSetupState: getGameDefinition(session.state.gameId).setup.createInitialState(),
    cards: session.state.cards.map(cloneCard),
    decks: session.state.decks.map(cloneDeck),
    lanes: session.state.lanes.map(cloneLane).map((lane) => applyConfiguredLaneConfiguration(session.state.gameId, lane)),
    regions: session.state.regions.map(cloneRegion).map((region) => applyConfiguredRegionConfiguration(session.state.gameId, region)),
    examinedStack: cloneExaminedStack(session.state.examinedStack),
  }
}
