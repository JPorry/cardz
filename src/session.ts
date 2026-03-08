import { INITIAL_LANES, INITIAL_REGIONS } from './utils/boardUtils'
import type { CardLocation, CardState, DeckState, ExaminedStackState, GameState, LaneState, RegionState } from './store'
import type { TitlePosition } from './utils/areaLayout'
import { normalizeCardCounters, normalizeCardStatuses } from './utils/cardMetadata'

export const GAME_SESSION_VERSION = 3
export const GAME_SESSION_STORAGE_KEY = `marvel-champions-session-v${GAME_SESSION_VERSION}`

export interface SerializedGameSessionState {
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

function parseCardState(value: unknown): CardState {
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
    counters: normalizeCardCounters(isObject(value.counters) ? value.counters : undefined),
    statuses: normalizeCardStatuses(isObject(value.statuses) ? value.statuses : undefined),
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
  }
}

function applyConfiguredLaneTitlePosition(lane: LaneState): LaneState {
  const configuredLane = INITIAL_LANES.find((entry) => entry.id === lane.id)
  return configuredLane
    ? { ...lane, titlePosition: configuredLane.titlePosition }
    : lane
}

function applyConfiguredRegionTitlePosition(region: RegionState): RegionState {
  const configuredRegion = INITIAL_REGIONS.find((entry) => entry.id === region.id)
  return configuredRegion
    ? { ...region, titlePosition: configuredRegion.titlePosition }
    : region
}

function createDefaultResetState(): ResettableGameState {
  return {
    cards: [],
    decks: [],
    lanes: INITIAL_LANES.map((lane) => ({ ...lane, itemOrder: [] })),
    regions: INITIAL_REGIONS.map(cloneRegion),
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
  state: Pick<GameState, 'cards' | 'decks' | 'lanes' | 'regions' | 'examinedStack'>,
): SerializedGameSessionState {
  return {
    cards: state.cards.map(cloneCard),
    decks: state.decks.map(cloneDeck),
    lanes: state.lanes.map(cloneLane),
    regions: state.regions.map(cloneRegion),
    examinedStack: cloneExaminedStack(state.examinedStack),
  }
}

export function exportSerializedGameSession(
  state: Pick<GameState, 'cards' | 'decks' | 'lanes' | 'regions' | 'examinedStack'>,
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

  if (value.version !== 1 && value.version !== GAME_SESSION_VERSION) {
    throw new Error(`Unsupported session version: ${String(value.version)}`)
  }

  if (!isString(value.savedAt)) {
    throw new Error('Session payload is missing savedAt.')
  }

  if (!isObject(value.state)) {
    throw new Error('Session payload is missing state.')
  }

  const cards = value.state.cards
  const decks = value.state.decks
  const lanes = value.state.lanes
  const regions = value.state.regions
  const examinedStack = 'examinedStack' in value.state ? value.state.examinedStack : null

  if (!Array.isArray(cards) || !Array.isArray(decks) || !Array.isArray(lanes) || !Array.isArray(regions)) {
    throw new Error('Session payload must include cards, decks, lanes, and regions arrays.')
  }

  return {
    version: GAME_SESSION_VERSION,
    savedAt: value.savedAt,
    state: {
      cards: cards.map(parseCardState),
      decks: decks.map(parseDeckState),
      lanes: lanes.map(parseLaneState),
      regions: regions.map(parseRegionState),
      examinedStack: parseExaminedStackState(examinedStack),
    },
  }
}

export function createImportedGameState(session: SerializedGameSession): ResettableGameState {
  const resetState = createDefaultResetState()
  return {
    ...resetState,
    cards: session.state.cards.map(cloneCard),
    decks: session.state.decks.map(cloneDeck),
    lanes: session.state.lanes.map(cloneLane).map(applyConfiguredLaneTitlePosition),
    regions: session.state.regions.map(cloneRegion).map(applyConfiguredRegionTitlePosition),
    examinedStack: cloneExaminedStack(session.state.examinedStack),
  }
}
