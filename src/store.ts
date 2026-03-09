import { create } from 'zustand'
import {
  getAreaContentBounds,
  getTitleReservedSpace,
  LANE_TITLE_LAYOUT,
  REGION_TITLE_LAYOUT,
  type TitlePosition,
} from './utils/areaLayout'
import {
  getEffectiveCardDimensions,
  TABLE_CARD_SCALE,
  TABLE_CARD_WIDTH,
} from './utils/cardOrientation'
import {
  createImportedGameState,
  exportSerializedGameSession,
  type SerializedGameSession,
} from './session'
import { createInitialLanes, createInitialRegions } from './games/boardLayout'
import { getDefaultGame, getGameDefinition } from './games/registry'
import type { CardCounters, CardStatuses } from './games/types'
import {
  clampCounterValue,
  createDefaultCardMetadata,
  type CardCounterKey,
  type CardStatusKey,
} from './utils/cardMetadata'

export type CardLocation = 'deck' | 'hand' | 'table' | 'discard'
export type SelectionKind = 'card' | 'deck'
export type DeckKind = 'stack' | 'sequence'
export type BoardLoadPhase = 'idle' | 'preparing' | 'settling'
export type { TitlePosition }
export interface SelectionItem {
  id: string
  kind: SelectionKind
}

export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MarqueeSelectionState {
  isActive: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
  additive: boolean
}

export type HoverCardZone = 'top' | 'bottom'

export interface StackTargetContext {
  position: [number, number, number]
  rotation?: [number, number, number]
  laneId?: string
  regionId?: string
  insertIndex?: number
}

export interface CardState {
  id: string
  location: CardLocation
  position: [number, number, number] // specific position if on table
  rotation: [number, number, number] // specific rotation if on table
  faceUp: boolean
  artworkUrl?: string
  backArtworkUrl?: string
  name?: string
  code?: string
  typeCode?: string
  linkedTypeCode?: string
  isIdentity?: boolean
  text?: string
  stage?: number
  cardSetCode?: string
  laneId?: string
  regionId?: string
  tapped?: boolean
  attachmentGroupId?: string
  attachmentIndex?: number
  counters: CardCounters
  statuses: CardStatuses
}

export interface GameSetupLayout {
  playerDeckCards: CardState[]
  playerAreaCards: CardState[]
  villainDeckCards: CardState[]
  villainSequenceCards: CardState[]
  villainAreaCards: CardState[]
  mainSchemeSequenceCards: CardState[]
  nemesisDeckCards: CardState[]
}

export interface DeckState {
  id: string
  kind: DeckKind
  position: [number, number, number]
  rotation: [number, number, number]
  cardIds: string[]
  laneId?: string
  regionId?: string
}

export interface ExaminedStackState {
  deckId: string
  cardOrder: string[]
  originalCardOrder: string[]
  originalFaceUpCardIds: string[]
  hiddenDeck: boolean
}

export interface LaneState {
  id: string
  label: string
  titlePosition: TitlePosition
  position: [number, number, number] // center of the lane
  width: number   // extent along X
  depth: number   // extent along Z
  flipped: boolean
  cardSpacing: number // horizontal spacing between items
  itemOrder: string[] // ordered list of card/deck IDs in this lane
}

export interface RegionState {
  id: string
  label: string
  titlePosition: TitlePosition
  position: [number, number, number]
  width: number
  depth: number
  flipped: boolean
}

export interface GameState {
  activeGameId: string
  activeGameVersion: number
  gameSetupState: Record<string, unknown>
  cards: CardState[]
  decks: DeckState[]
  lanes: LaneState[]
  regions: RegionState[]
  boardLoadPhase: BoardLoadPhase
  boardLoadingLabel: string | null
  gameInstanceId: number
  examinedStack: ExaminedStackState | null
  selectedItems: SelectionItem[]
  draggedSelectionItems: SelectionItem[]
  dragTargetContext: StackTargetContext | null
  selectionBounds: ScreenRect | null
  marqueeSelection: MarqueeSelectionState
  activeLaneId: string | null
  activeRegionId: string | null
  lanePreviewLaneId: string | null
  lanePreviewIndex: number | null
  lanePreviewItemId: string | null
  handPreviewIndex: number | null
  handPreviewItemId: string | null
  isDragging: boolean
  activeDragType: 'card' | 'deck' | null
  hoveredCardId: string | null
  hoveredCardScreenX: number | null
  hoveredCardZone: HoverCardZone | null
  touchQuickPreviewCardId: string | null
  previewCardId: string | null
  focusedCardId: string | null
  beginBoardLoad: (label?: string) => void
  setBoardLoadPhase: (phase: BoardLoadPhase, label?: string | null) => void
  finishBoardLoad: () => void
  setDragging: (dragging: boolean, type?: 'card' | 'deck' | null, id?: string | null) => void
  setHoveredCard: (id: string | null, x?: number | null, zone?: HoverCardZone | null) => void
  setTouchQuickPreviewCard: (id: string | null) => void
  clearTouchQuickPreview: () => void
  setPreviewCard: (id: string | null) => void
  setFocusedCard: (id: string | null) => void
  setActiveGame: (gameId: string) => void
  setGameSetupState: (updates: Record<string, unknown>) => void
  setCardCounter: (id: string, counter: CardCounterKey, value: number) => void
  adjustCardCounter: (id: string, counter: CardCounterKey, delta: number) => void
  toggleCardStatus: (id: string, status: CardStatusKey) => void
  setCardStatus: (id: string, status: CardStatusKey, active: boolean) => void
  setSelectedItems: (items: SelectionItem[]) => void
  setDraggedSelectionItems: (items: SelectionItem[]) => void
  setDragTargetContext: (context: StackTargetContext | null) => void
  selectOnly: (item: SelectionItem | null) => void
  toggleSelection: (item: SelectionItem) => void
  clearSelection: () => void
  setSelectionBounds: (bounds: ScreenRect | null) => void
  startMarqueeSelection: (x: number, y: number, additive: boolean) => void
  updateMarqueeSelection: (x: number, y: number) => void
  endMarqueeSelection: () => void
  setActiveLane: (id: string | null) => void
  setActiveRegion: (id: string | null) => void
  setLanePreview: (laneId: string | null, index: number | null, itemId: string | null) => void
  setHandPreview: (index: number | null, itemId: string | null) => void
  moveCard: (id: string, location: CardLocation, position?: [number, number, number], rotation?: [number, number, number], laneId?: string, regionId?: string) => void
  flipCard: (id: string) => void
  flipCards: (ids: string[]) => void
  createDeck: (card1Id: string, card2Id: string) => void
  addCardToDeck: (cardId: string, deckId: string) => void
  addCardUnderDeck: (cardId: string, deckId: string) => void
  addDeckToDeck: (sourceDeckId: string, targetDeckId: string) => void
  mergeDeckIntoDeck: (sourceDeckId: string, targetDeckId: string, insertAt?: 'top' | 'bottom') => void
  removeTopCardFromDeck: (deckId: string) => string | null
  removeBottomCardFromDeck: (deckId: string) => string | null
  setRegionStackCards: (regionId: string, orderedCardIds: string[]) => void
  moveDeck: (id: string, position?: [number, number, number], rotation?: [number, number, number], laneId?: string, regionId?: string) => void
  dissolveDeck: (deckId: string) => void
  getLaneSlotPosition: (laneId: string, slotIndex: number) => [number, number, number] | null
  insertIntoLane: (laneId: string, itemId: string, index: number) => void
  reorderHand: (itemId: string, index: number) => void
  removeFromLane: (itemId: string) => void
  removeFromRegion: (itemId: string) => void
  reconcileRegion: (regionId: string) => void
  dropSelectionIntoRegion: (items: SelectionItem[], regionId: string, selectSettledItems?: boolean) => void
  tapCard: (id: string) => void
  tapCards: (ids: string[]) => void
  flipDeck: (deckId: string) => void
  flipStack: (deckId: string) => void
  tapDeck: (deckId: string) => void
  advanceStack: (deckId: string) => void
  nextSequence: (deckId: string) => void
  previousSequence: (deckId: string) => void
  attachCards: (cardIds: string[]) => string | null
  detachAttachmentGroup: (groupId: string) => void
  moveAttachmentGroup: (
    groupId: string,
    anchorPosition: [number, number, number],
    rotation?: [number, number, number],
    laneId?: string,
    regionId?: string,
  ) => void
  createStackFromCards: (cardIds: string[], targetContext?: StackTargetContext) => string | null
  combineSelectionIntoStack: (selection: { cardIds: string[], deckIds: string[], orderedItems?: SelectionItem[] }, targetContext?: StackTargetContext) => string | null
  openDeckExamine: (deckId: string) => void
  closeDeckExamine: () => void
  reorderExaminedStack: (fromIndex: number, toIndex: number) => void
  removeCardFromExaminedStack: (cardId: string) => number | null
  commitExaminedStackOrder: () => void
  shuffleDeck: (deckId: string) => void
  closeExaminedStackAndKeepOrder: () => void
  closeExaminedStackAndShuffle: () => void
  replaceBoardWithDecks: (setup: GameSetupLayout) => void
  exportGameSession: () => SerializedGameSession
  importGameSession: (session: SerializedGameSession) => void
}

const LANE_LEFT_PADDING = 1.25
const LANE_INSERT_SNAP_RATIO = 0.65
const ATTACHMENT_X_OFFSET = 0.92
const ATTACHMENT_Z_OFFSET = -0.03
const ATTACHMENT_Y_OFFSET = -0.014
const DETACH_X_OFFSET = 0.62
const DETACH_Z_OFFSET = 0.06

function restoreExaminedStackFaceDown(cards: CardState[], examinedStack: ExaminedStackState | null) {
  if (!examinedStack) return cards

  const remainingCardIds = new Set(examinedStack.cardOrder)
  const originalFaceUpCardIds = new Set(examinedStack.originalFaceUpCardIds)
  return cards.map((card) => (
    remainingCardIds.has(card.id)
      ? { ...card, faceUp: originalFaceUpCardIds.has(card.id) }
      : card
  ))
}

function toExaminedCardOrder(deckCardIds: string[]) {
  return [...deckCardIds].reverse()
}

function fromExaminedCardOrder(cardOrder: string[]) {
  return [...cardOrder].reverse()
}

function rotateDeckCardIds(cardIds: string[], direction: 'next' | 'previous') {
  if (cardIds.length < 2) return cardIds
  if (direction === 'next') {
    return [...cardIds.slice(1), cardIds[0]]
  }
  return [cardIds[cardIds.length - 1], ...cardIds.slice(0, -1)]
}

function getLaneLeadingReservedWidth(lane: LaneState) {
  return lane.titlePosition === 'left'
    ? getTitleReservedSpace(lane.label, LANE_TITLE_LAYOUT, 'left')
    : 0
}

function getLaneGap(lane: LaneState): number {
  return lane.cardSpacing - TABLE_CARD_WIDTH
}

function getAttachmentOffset(index: number): [number, number, number] {
  return [
    ATTACHMENT_X_OFFSET * index,
    ATTACHMENT_Y_OFFSET * index,
    ATTACHMENT_Z_OFFSET * index,
  ]
}

function rotateOffset(
  offset: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  const vector = { x: offset[0], z: offset[2] }
  const cos = Math.cos(rotation[1] ?? 0)
  const sin = Math.sin(rotation[1] ?? 0)
  return [
    vector.x * cos - vector.z * sin,
    offset[1],
    vector.x * sin + vector.z * cos,
  ]
}

export function computeAttachedCardPosition(
  anchorPosition: [number, number, number],
  index: number,
  rotation: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  const offset = rotateOffset(getAttachmentOffset(index), rotation)
  return [
    anchorPosition[0] + offset[0],
    anchorPosition[1] + offset[1],
    anchorPosition[2] + offset[2],
  ]
}

function computeDetachedCardPosition(
  anchorPosition: [number, number, number],
  index: number,
  rotation: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  const offset = rotateOffset([
    DETACH_X_OFFSET * index,
    ATTACHMENT_Y_OFFSET * index,
    DETACH_Z_OFFSET * index,
  ], rotation)
  return [
    anchorPosition[0] + offset[0],
    anchorPosition[1] + offset[1],
    anchorPosition[2] + offset[2],
  ]
}

function getAttachmentGroupCards(cards: CardState[], groupId: string): CardState[] {
  return cards
    .filter((card) => card.attachmentGroupId === groupId)
    .sort((left, right) => (left.attachmentIndex ?? 0) - (right.attachmentIndex ?? 0))
}

function getAttachmentGroupWidth(anchorCard: CardState, cards: CardState[]): number {
  const baseWidth = getEffectiveCardDimensions(anchorCard).width * TABLE_CARD_SCALE
  if (!anchorCard.attachmentGroupId) return baseWidth
  const attachmentCards = getAttachmentGroupCards(cards, anchorCard.attachmentGroupId)
  return baseWidth + ATTACHMENT_X_OFFSET * Math.max(0, attachmentCards.length - 1)
}

function getLaneItemExtents(
  itemId: string,
  cards: CardState[],
  decks: DeckState[],
): { left: number, right: number } {
  const card = cards.find((entry) => entry.id === itemId)
  if (card) {
    const baseWidth = getEffectiveCardDimensions(card).width * TABLE_CARD_SCALE
    if (card.attachmentGroupId && card.attachmentIndex === 0) {
      const attachmentCards = getAttachmentGroupCards(cards, card.attachmentGroupId)
      const extraRight = ATTACHMENT_X_OFFSET * Math.max(0, attachmentCards.length - 1)
      return {
        left: baseWidth / 2,
        right: baseWidth / 2 + extraRight,
      }
    }

    return {
      left: baseWidth / 2,
      right: baseWidth / 2,
    }
  }

  const width = getLaneItemWidth(itemId, cards, decks)
  return {
    left: width / 2,
    right: width / 2,
  }
}

function getDeckTopCard(deck: DeckState, cards: CardState[]): CardState | undefined {
  const topCardId = getDeckTopCardId(deck)
  return cards.find((card) => card.id === topCardId)
}

export function getDeckTopCardId(deck: DeckState): string | undefined {
  if (deck.cardIds.length === 0) return undefined
  return deck.kind === 'sequence'
    ? deck.cardIds[0]
    : deck.cardIds[deck.cardIds.length - 1]
}

function getLaneItemWidth(
  itemId: string,
  cards: CardState[],
  decks: DeckState[],
): number {
  const card = cards.find((entry) => entry.id === itemId)
  if (card) {
    if (card.attachmentGroupId && card.attachmentIndex !== 0) {
      return 0
    }
    return getAttachmentGroupWidth(card, cards)
  }

  const deck = decks.find((entry) => entry.id === itemId)
  if (deck) {
    const topCard = getDeckTopCard(deck, cards)
    if (topCard) {
      return getEffectiveCardDimensions(topCard).width * TABLE_CARD_SCALE
    }
    return TABLE_CARD_WIDTH
  }

  return TABLE_CARD_WIDTH
}

function getLaneSlotCenters(
  lane: LaneState,
  cards: CardState[],
  decks: DeckState[],
  itemOrder: string[] = lane.itemOrder,
): number[] {
  const firstSlotCenter = lane.position[0] - lane.width / 2 + getLaneLeadingReservedWidth(lane) + LANE_LEFT_PADDING
  const gap = getLaneGap(lane)
  const centers: number[] = []

  for (let index = 0; index < itemOrder.length; index += 1) {
    const currentExtents = getLaneItemExtents(itemOrder[index], cards, decks)
    if (index === 0) {
      centers.push(firstSlotCenter + (currentExtents.left - TABLE_CARD_WIDTH / 2))
      continue
    }

    const previousExtents = getLaneItemExtents(itemOrder[index - 1], cards, decks)
    centers.push(centers[index - 1] + previousExtents.right + gap + currentExtents.left)
  }

  return centers
}

// Helper to compute slot position at a given index in a lane (left-to-right)
export function computeLaneSlotPosition(
  lane: LaneState,
  slotIndex: number,
  cards: CardState[] = [],
  decks: DeckState[] = [],
  itemOrder: string[] = lane.itemOrder,
): [number, number, number] {
  const leftEdge = lane.position[0] - lane.width / 2 + getLaneLeadingReservedWidth(lane) + LANE_LEFT_PADDING
  const centers = getLaneSlotCenters(lane, cards, decks, itemOrder)
  const x = centers[slotIndex] ?? leftEdge
  return [x, lane.position[1], lane.position[2]]
}

// Helper to compute insertion index from an X world position
export function computeLaneInsertIndex(
  lane: LaneState,
  worldX: number,
  currentCount: number,
  cards: CardState[] = [],
  decks: DeckState[] = [],
  itemOrder: string[] = lane.itemOrder,
): number {
  if (itemOrder.length === 0) return 0

  const centers = getLaneSlotCenters(lane, cards, decks, itemOrder)
  const gap = getLaneGap(lane)
  if (centers.length === 1) {
    return worldX < centers[0] ? 0 : 1
  }

  const snapRadius = Math.max(gap / 2, lane.cardSpacing * LANE_INSERT_SNAP_RATIO)
  let closestInternalIndex = -1
  let closestInternalDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < centers.length - 1; index += 1) {
    const currentExtents = getLaneItemExtents(itemOrder[index], cards, decks)
    const gapCenter = centers[index] + currentExtents.right + gap / 2
    const distance = Math.abs(worldX - gapCenter)
    if (distance < closestInternalDistance) {
      closestInternalDistance = distance
      closestInternalIndex = index + 1
    }
  }

  if (closestInternalIndex !== -1 && closestInternalDistance <= snapRadius) {
    return closestInternalIndex
  }

  if (worldX < centers[0]) {
    return 0
  }

  for (let index = 0; index < centers.length - 1; index += 1) {
    const midpoint = (centers[index] + centers[index + 1]) / 2
    if (worldX < midpoint) {
      return index + 1
    }
  }

  return Math.max(0, Math.min(itemOrder.length, currentCount))
}

function getContainerFlippedDefault(
  lanes: LaneState[],
  regions: RegionState[],
  laneId?: string,
  regionId?: string,
): boolean | undefined {
  if (laneId) return lanes.find((lane) => lane.id === laneId)?.flipped;
  if (regionId) return regions.find((region) => region.id === regionId)?.flipped;
  return undefined;
}

function applyFaceStateFromContainer<T extends { faceUp: boolean }>(
  item: T,
  lanes: LaneState[],
  regions: RegionState[],
  laneId?: string,
  regionId?: string,
  preserveFaceUp = false,
): T {
  if (preserveFaceUp) return item
  const flipped = getContainerFlippedDefault(lanes, regions, laneId, regionId);
  return flipped === undefined ? item : { ...item, faceUp: !flipped };
}

function normalizeCardForDeck<T extends CardState>(card: T): T {
  return card
}

function selectionItemsEqual(a: SelectionItem, b: SelectionItem): boolean {
  return a.id === b.id && a.kind === b.kind
}

function upsertSelectionItems(items: SelectionItem[]): SelectionItem[] {
  return items.filter((item, index) => items.findIndex((entry) => selectionItemsEqual(entry, item)) === index)
}

function buildLaneOrder(
  lane: LaneState,
  removedIds: string[],
  insertedId?: string,
  insertIndex?: number,
): string[] {
  const filtered = lane.itemOrder.filter((id) => !removedIds.includes(id))
  if (!insertedId) return filtered

  const nextOrder = [...filtered]
  const clampedIndex = Math.max(0, Math.min(insertIndex ?? filtered.length, filtered.length))
  nextOrder.splice(clampedIndex, 0, insertedId)
  return nextOrder
}

function shuffleArray<T>(items: T[]): T[] {
  const nextItems = [...items]
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = nextItems[index]
    nextItems[index] = nextItems[swapIndex]
    nextItems[swapIndex] = current
  }
  return nextItems
}

function withCardMetadata(
  card: Omit<CardState, 'counters' | 'statuses'> & Partial<Pick<CardState, 'counters' | 'statuses'>>,
  gameId: string,
): CardState {
  const defaults = createDefaultCardMetadata(getGameDefinition(gameId).cardSemantics)
  return {
    ...card,
    ...defaults,
    counters: {
      ...defaults.counters,
      ...card.counters,
    },
    statuses: {
      ...defaults.statuses,
      ...card.statuses,
    },
  }
}

function prepareCardsForRegion(
  cards: CardState[],
  region: RegionState,
  lanes: LaneState[],
  regions: RegionState[],
): CardState[] {
  return cards.map((card) => (
    applyFaceStateFromContainer(
      {
        ...card,
        location: 'deck' as const,
        laneId: undefined,
        regionId: undefined,
        position: computeRegionCardPosition(region, card.tapped ?? false),
        rotation: [0, 0, 0] as [number, number, number],
        faceUp: false,
      },
      lanes,
      regions,
      undefined,
      region.id,
    )
  ))
}

function prepareCardsForLane(
  cards: CardState[],
  lane: LaneState,
  itemOrder: string[],
  lanes: LaneState[],
  regions: RegionState[],
  preserveFaceUp = false,
): CardState[] {
  return cards.map((card, index) => (
    applyFaceStateFromContainer(
      {
        ...card,
        location: 'table' as const,
        laneId: lane.id,
        regionId: undefined,
        position: computeLaneSlotPosition(lane, index, cards, [], itemOrder),
        rotation: [0, 0, 0] as [number, number, number],
        faceUp: preserveFaceUp ? card.faceUp : false,
      },
      lanes,
      regions,
      lane.id,
      undefined,
      preserveFaceUp,
    )
  ))
}

export function computeRegionCardPosition(region: RegionState, tapped = false): [number, number, number] {
  const itemDimensions = getEffectiveCardDimensions({ tapped })
  const itemWidth = itemDimensions.width * TABLE_CARD_SCALE
  const itemHeight = itemDimensions.height * TABLE_CARD_SCALE
  const bounds = getAreaContentBounds(
    region.label,
    region.width,
    region.depth,
    REGION_TITLE_LAYOUT,
    region.titlePosition,
  )
  const minCenterX = bounds.left + itemWidth / 2
  const maxCenterX = bounds.right - itemWidth / 2
  const minCenterZ = bounds.top + itemHeight / 2
  const maxCenterZ = bounds.bottom - itemHeight / 2
  const centeredLocalX = minCenterX <= maxCenterX ? (minCenterX + maxCenterX) / 2 : (bounds.left + bounds.right) / 2
  const centeredLocalZ = minCenterZ <= maxCenterZ ? (minCenterZ + maxCenterZ) / 2 : (bounds.top + bounds.bottom) / 2

  return [
    region.position[0] + centeredLocalX,
    region.position[1],
    region.position[2] + centeredLocalZ,
  ]
}

function getRegionById(regions: RegionState[], regionId: string): RegionState | undefined {
  return regions.find((region) => region.id === regionId)
}

function getRegionPosition(regions: RegionState[], regionId: string): [number, number, number] | null {
  const region = getRegionById(regions, regionId)
  return region ? computeRegionCardPosition(region) : null
}

function getOrderedCardIdsForSelection(state: Pick<GameState, 'cards' | 'decks'>, items: SelectionItem[]): string[] {
  return items.flatMap((item) => {
    if (item.kind === 'card') {
      const card = state.cards.find((entry) => entry.id === item.id)
      return card ? [card.id] : []
    }

    const deck = state.decks.find((entry) => entry.id === item.id)
    return deck ? [...deck.cardIds] : []
  })
}

function buildRegionSettlement(
  state: GameState,
  regionId: string,
  orderedCardIds: string[],
  removedItemIds: Set<string>,
  removedDeckIds: Set<string>,
  preferredDeckId?: string | null,
  preserveSelection = true,
): Partial<GameState> {
  const position = getRegionPosition(state.regions, regionId)
  if (!position) return {}

  const normalizedRotation: [number, number, number] = [0, 0, 0]
  const cardIds = orderedCardIds.filter((cardId, index) => orderedCardIds.indexOf(cardId) === index)
  const cardIdSet = new Set(cardIds)

  if (cardIds.length === 0) {
    return {
      lanes: state.lanes.map((lane) => ({
        ...lane,
        itemOrder: lane.itemOrder.filter((id) => !removedItemIds.has(id)),
      })),
      decks: state.decks.filter((deck) => !removedDeckIds.has(deck.id)),
      selectedItems: preserveSelection ? state.selectedItems.filter((item) => !removedItemIds.has(item.id)) : state.selectedItems,
    }
  }

  if (cardIds.length === 1) {
    const [cardId] = cardIds
    return {
      lanes: state.lanes.map((lane) => ({
        ...lane,
        itemOrder: lane.itemOrder.filter((id) => !removedItemIds.has(id)),
      })),
      decks: state.decks.filter((deck) => !removedDeckIds.has(deck.id)),
      cards: state.cards.map((card) => (
        card.id === cardId
          ? applyFaceStateFromContainer(
              {
                ...card,
                location: 'table',
                laneId: undefined,
                regionId,
                position: [...position],
                rotation: [...normalizedRotation],
                attachmentGroupId: undefined,
                attachmentIndex: undefined,
              },
              state.lanes,
              state.regions,
              undefined,
              regionId,
            )
          : card
      )),
      selectedItems: preserveSelection ? [{ id: cardId, kind: 'card' as const }] : state.selectedItems,
    }
  }

  const deckId = preferredDeckId ?? `deck-${Date.now()}`
  const preferredDeckKind = preferredDeckId
    ? state.decks.find((deck) => deck.id === preferredDeckId)?.kind
    : undefined
  const nextDeck: DeckState = {
    id: deckId,
    kind: preferredDeckKind ?? 'stack',
    position: [...position],
    rotation: [...normalizedRotation],
    cardIds,
    regionId,
  }

  return {
    lanes: state.lanes.map((lane) => ({
      ...lane,
      itemOrder: lane.itemOrder.filter((id) => !removedItemIds.has(id)),
    })),
    decks: [...state.decks.filter((deck) => !removedDeckIds.has(deck.id)), nextDeck],
    cards: state.cards.map((card) => (
      cardIdSet.has(card.id)
        ? applyFaceStateFromContainer(
            normalizeCardForDeck({
              ...card,
              location: 'deck',
              laneId: undefined,
              regionId: undefined,
              position: [...position],
              rotation: [...normalizedRotation],
              attachmentGroupId: undefined,
              attachmentIndex: undefined,
            }),
            state.lanes,
            state.regions,
            undefined,
            regionId,
          )
        : card
    )),
    selectedItems: preserveSelection ? [{ id: deckId, kind: 'deck' as const }] : state.selectedItems,
  }
}

function reconcileRegionState(
  state: GameState,
  regionId: string,
  preserveSelection = false,
): Partial<GameState> {
  const regionDecks = state.decks.filter((deck) => deck.regionId === regionId)
  const regionCards = state.cards.filter((card) => card.location === 'table' && card.regionId === regionId)
  const orderedCardIds = [
    ...regionDecks.flatMap((deck) => deck.cardIds),
    ...regionCards.map((card) => card.id),
  ]
  const removedDeckIds = new Set(regionDecks.map((deck) => deck.id))
  const removedItemIds = new Set([
    ...regionDecks.map((deck) => deck.id),
    ...regionCards.map((card) => card.id),
  ])
  const preferredDeckId = regionDecks[0]?.id

  return buildRegionSettlement(
    state,
    regionId,
    orderedCardIds,
    removedItemIds,
    removedDeckIds,
    preferredDeckId,
    preserveSelection,
  )
}

function createTransientUiResetState() {
  return {
    activeLaneId: null,
    activeRegionId: null,
    lanePreviewLaneId: null,
    lanePreviewIndex: null,
    lanePreviewItemId: null,
    handPreviewIndex: null,
    handPreviewItemId: null,
    hoveredCardId: null,
    hoveredCardScreenX: null,
    hoveredCardZone: null,
    touchQuickPreviewCardId: null,
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

function createBoardLoadState(
  phase: BoardLoadPhase = 'idle',
  label: string | null = null,
) {
  return {
    boardLoadPhase: phase,
    boardLoadingLabel: label,
  }
}

function createFreshBoardLayout() {
  const game = getDefaultGame()
  const lanes = createInitialLanes(game.board.layout)
  const regions = createInitialRegions(game.board.layout)
  return {
    lanes: lanes.map((lane) => ({ ...lane, itemOrder: [] })),
    regions: regions.map((region) => ({ ...region, position: [...region.position] as [number, number, number] })),
  }
}

function createFreshBoardLayoutForGame(gameId: string) {
  const game = getGameDefinition(gameId)
  const lanes = createInitialLanes(game.board.layout)
  const regions = createInitialRegions(game.board.layout)
  return {
    lanes: lanes.map((lane) => ({ ...lane, itemOrder: [] })),
    regions: regions.map((region) => ({ ...region, position: [...region.position] as [number, number, number] })),
  }
}

export const useGameStore = create<GameState>((set, get) => ({
  activeGameId: getDefaultGame().id,
  activeGameVersion: getDefaultGame().version,
  gameSetupState: getDefaultGame().setup.createInitialState(),
  ...createBoardLoadState(),
  gameInstanceId: 0,
  isDragging: false,
  activeDragType: null,
  draggedCardId: null,
  draggedDeckId: null,
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
  hoveredCardId: null,
  hoveredCardScreenX: null,
  hoveredCardZone: null,
  touchQuickPreviewCardId: null,
  previewCardId: null,
  focusedCardId: null,
  setActiveGame: (gameId) => set((state) => {
    const game = getGameDefinition(gameId)
    const freshLayout = createFreshBoardLayoutForGame(game.id)
    return {
      activeGameId: game.id,
      activeGameVersion: game.version,
      gameSetupState: game.setup.createInitialState(),
      cards: [],
      decks: [],
      ...freshLayout,
      ...createTransientUiResetState(),
      ...createBoardLoadState(),
      gameInstanceId: state.gameInstanceId + 1,
    }
  }),
  setGameSetupState: (updates) => set((state) => ({
    gameSetupState: {
      ...state.gameSetupState,
      ...updates,
    },
  })),
  beginBoardLoad: (label) => set((state) => {
    const game = getGameDefinition(state.activeGameId)
    return createBoardLoadState('preparing', label ?? game.ui.preparingNewGameLabel)
  }),
  setBoardLoadPhase: (phase, label) =>
    set((state) => ({
      boardLoadPhase: phase,
      boardLoadingLabel: label === undefined ? state.boardLoadingLabel : label,
    })),
  finishBoardLoad: () => set(() => createBoardLoadState()),
  setDragging: (dragging, type = null) => 
    set((state) => ({ 
      isDragging: dragging, 
      activeDragType: dragging ? type : null,
      // Clear hover when dragging starts
      hoveredCardId: dragging ? null : state.hoveredCardId,
      hoveredCardScreenX: dragging ? null : state.hoveredCardScreenX,
      hoveredCardZone: dragging ? null : state.hoveredCardZone,
      touchQuickPreviewCardId: dragging ? null : state.touchQuickPreviewCardId,
    })),
  setHoveredCard: (id, x, zone) => set({
    hoveredCardId: id,
    hoveredCardScreenX: x ?? null,
    hoveredCardZone: id ? zone ?? null : null,
  }),
  setTouchQuickPreviewCard: (id) => set({ touchQuickPreviewCardId: id }),
  clearTouchQuickPreview: () => set({ touchQuickPreviewCardId: null }),
  setPreviewCard: (id) => set((state) => ({
    previewCardId: id,
    touchQuickPreviewCardId: id ? null : state.touchQuickPreviewCardId,
  })),
  setFocusedCard: (id) => set({ focusedCardId: id }),
  setCardCounter: (id, counter, value) => set((state) => ({
    cards: state.cards.map((card) => (
      card.id === id
        ? {
            ...card,
            counters: {
              ...card.counters,
              [counter]: clampCounterValue(value),
            },
          }
        : card
    )),
  })),
  adjustCardCounter: (id, counter, delta) => set((state) => ({
    cards: state.cards.map((card) => (
      card.id === id
        ? {
            ...card,
            counters: {
              ...card.counters,
              [counter]: clampCounterValue(card.counters[counter] + delta),
            },
          }
        : card
    )),
  })),
  toggleCardStatus: (id, status) => set((state) => ({
    cards: state.cards.map((card) => (
      card.id === id
        ? {
            ...card,
            statuses: {
              ...card.statuses,
              [status]: !card.statuses[status],
            },
          }
        : card
    )),
  })),
  setCardStatus: (id, status, active) => set((state) => ({
    cards: state.cards.map((card) => (
      card.id === id
        ? {
            ...card,
            statuses: {
              ...card.statuses,
              [status]: active,
            },
          }
        : card
    )),
  })),
  setSelectedItems: (items) => set({ selectedItems: upsertSelectionItems(items), touchQuickPreviewCardId: null }),
  setDraggedSelectionItems: (items) => set({ draggedSelectionItems: upsertSelectionItems(items) }),
  setDragTargetContext: (context) => set({ dragTargetContext: context ? { ...context } : null }),
  selectOnly: (item) => set({ selectedItems: item ? [item] : [], touchQuickPreviewCardId: null }),
  toggleSelection: (item) => set((state) => ({
    selectedItems: state.selectedItems.some((entry) => selectionItemsEqual(entry, item))
      ? state.selectedItems.filter((entry) => !selectionItemsEqual(entry, item))
      : [...state.selectedItems, item],
    touchQuickPreviewCardId: null,
  })),
  clearSelection: () => set({ selectedItems: [], selectionBounds: null, touchQuickPreviewCardId: null }),
  setSelectionBounds: (bounds) => set({ selectionBounds: bounds }),
  startMarqueeSelection: (x, y, additive) => set({
    marqueeSelection: {
      isActive: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      additive,
    },
  }),
  updateMarqueeSelection: (x, y) => set((state) => ({
    marqueeSelection: state.marqueeSelection.isActive
      ? {
          ...state.marqueeSelection,
          currentX: x,
          currentY: y,
        }
      : state.marqueeSelection,
  })),
  endMarqueeSelection: () => set({
    marqueeSelection: {
      isActive: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      additive: false,
    },
  }),
  setActiveLane: (id) => set({ activeLaneId: id }),
  setActiveRegion: (id) => set({ activeRegionId: id }),
  setLanePreview: (laneId, index, itemId) => set({ lanePreviewLaneId: laneId, lanePreviewIndex: index, lanePreviewItemId: itemId }),
  setHandPreview: (index, itemId) => set({ handPreviewIndex: index, handPreviewItemId: itemId }),
  cards: [],
  decks: [],
  ...createFreshBoardLayout(),
  activeLaneId: null,
  activeRegionId: null,
  lanePreviewLaneId: null,
  lanePreviewIndex: null,
  lanePreviewItemId: null,
  handPreviewIndex: null,
  handPreviewItemId: null,
  moveCard: (id, location, position, rotation, laneId, regionId) => {
    console.log(`[Store] moveCard: ${id}, location: ${location}, laneId: ${laneId}, regionId: ${regionId}, pos: ${position}`);
    set((state) => ({
      cards: state.cards.map((c) => {
        if (c.id !== id) return c
        return applyFaceStateFromContainer({
          ...c,
          location,
          laneId: laneId || undefined,
          regionId: regionId || undefined,
          attachmentGroupId: location === 'table' && !laneId && !regionId ? c.attachmentGroupId : undefined,
          attachmentIndex: location === 'table' && !laneId && !regionId ? c.attachmentIndex : undefined,
          // Always create fresh array references to avoid shared state bugs during React renders
          position: position ? [...position] : [...c.position],
          rotation: rotation ? [...rotation] : [...c.rotation],
        }, state.lanes, state.regions, laneId, regionId)
      }),
    }))
  },
  flipCard: (id) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? { ...c, faceUp: !c.faceUp } : c)),
    })),
  flipCards: (ids) =>
    set((state) => ({
      cards: state.cards.map((card) => (ids.includes(card.id) ? { ...card, faceUp: !card.faceUp } : card)),
    })),
  tapCard: (id) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? { ...c, tapped: !c.tapped } : c)),
    })),
  tapCards: (ids) =>
    set((state) => ({
      cards: state.cards.map((card) => (ids.includes(card.id) ? { ...card, tapped: !card.tapped } : card)),
    })),
  flipDeck: (deckId) =>
    set((state) => {
      const deck = state.decks.find((d) => d.id === deckId)
      if (!deck || deck.cardIds.length === 0) return state

      const topCardId = getDeckTopCardId(deck)
      if (!topCardId) return state

      return {
        cards: state.cards.map((card) => (
          card.id === topCardId
            ? { ...card, faceUp: !card.faceUp }
            : card
        )),
      }
    }),
  flipStack: (deckId) => {
    get().flipDeck(deckId)
  },
  tapDeck: (deckId) =>
    set((state) => {
      const deck = state.decks.find((d) => d.id === deckId);
      if (!deck) return state;

      return {
        cards: state.cards.map((c) => (deck.cardIds.includes(c.id) ? { ...c, tapped: !c.tapped } : c)),
      };
    }),
  advanceStack: (deckId) =>
    set((state) => {
      const deck = state.decks.find((entry) => entry.id === deckId)
      if (!deck || deck.cardIds.length < 2) return state

      const advancedIds = rotateDeckCardIds(deck.cardIds, 'next')
      return {
        decks: state.decks.map((entry) => (
          entry.id === deckId
            ? { ...entry, cardIds: advancedIds }
            : entry
        )),
      }
    }),
  nextSequence: (deckId) =>
    set((state) => {
      const deck = state.decks.find((entry) => entry.id === deckId)
      if (!deck || deck.kind !== 'sequence' || deck.cardIds.length < 2) return state

      const rotatedIds = rotateDeckCardIds(deck.cardIds, 'next')
      const examinedOrder = toExaminedCardOrder(rotatedIds)

      return {
        decks: state.decks.map((entry) => (
          entry.id === deckId
            ? { ...entry, cardIds: rotatedIds }
            : entry
        )),
        examinedStack: state.examinedStack?.deckId === deckId
          ? {
              ...state.examinedStack,
              cardOrder: examinedOrder,
              originalCardOrder: examinedOrder,
            }
          : state.examinedStack,
      }
    }),
  previousSequence: (deckId) =>
    set((state) => {
      const deck = state.decks.find((entry) => entry.id === deckId)
      if (!deck || deck.kind !== 'sequence' || deck.cardIds.length < 2) return state

      const rotatedIds = rotateDeckCardIds(deck.cardIds, 'previous')
      const examinedOrder = toExaminedCardOrder(rotatedIds)

      return {
        decks: state.decks.map((entry) => (
          entry.id === deckId
            ? { ...entry, cardIds: rotatedIds }
            : entry
        )),
        examinedStack: state.examinedStack?.deckId === deckId
          ? {
              ...state.examinedStack,
              cardOrder: examinedOrder,
              originalCardOrder: examinedOrder,
            }
          : state.examinedStack,
      }
    }),
  attachCards: (cardIds) => {
    let newGroupId: string | null = null
    set((state) => {
      const orderedCards = cardIds
        .map((cardId) => state.cards.find((card) => card.id === cardId))
        .filter((card): card is CardState => Boolean(card))
        .filter((card) => card.location === 'table' && !card.regionId)

      if (orderedCards.length < 2) return state

      const existingGroupIds = new Set(
        orderedCards
          .map((card) => card.attachmentGroupId)
          .filter((groupId): groupId is string => Boolean(groupId)),
      )
      if (existingGroupIds.size > 1) return state

      const existingGroupId = [...existingGroupIds][0]
      const existingGroupCards = existingGroupId
        ? getAttachmentGroupCards(state.cards, existingGroupId)
        : []
      const looseCards = orderedCards.filter((card) => !card.attachmentGroupId)
      if (existingGroupId && looseCards.length === 0) return state

      const nextOrderedCards = existingGroupId
        ? [...existingGroupCards, ...looseCards]
        : orderedCards
      const anchorCard = nextOrderedCards[0]
      if (!anchorCard) return state

      newGroupId = existingGroupId ?? `attachment-${Date.now()}`
      const targetIds = new Set(nextOrderedCards.map((card) => card.id))
      const anchorRotation = [...anchorCard.rotation] as [number, number, number]
      const anchorPosition = [...anchorCard.position] as [number, number, number]
      const anchorLaneId = anchorCard.laneId
      const anchorRegionId = anchorCard.regionId
      const anchorLaneIndex = anchorLaneId
        ? state.lanes.find((lane) => lane.id === anchorLaneId)?.itemOrder.indexOf(anchorCard.id)
        : undefined

      return {
        lanes: state.lanes.map((lane) => {
          if (!targetIds.has(anchorCard.id)) return lane
          if (lane.id !== anchorLaneId) {
            return {
              ...lane,
              itemOrder: lane.itemOrder.filter((id) => !targetIds.has(id)),
            }
          }

          return {
            ...lane,
            itemOrder: buildLaneOrder(
              lane,
              nextOrderedCards.map((card) => card.id),
              anchorCard.id,
              anchorLaneIndex,
            ),
          }
        }),
        cards: state.cards.map((card) => {
          if (!targetIds.has(card.id)) return card
          const nextIndex = nextOrderedCards.findIndex((entry) => entry.id === card.id)
          return {
            ...card,
            location: 'table',
            laneId: anchorLaneId,
            regionId: anchorRegionId,
            rotation: anchorRotation,
            position: computeAttachedCardPosition(anchorPosition, nextIndex, anchorRotation),
            attachmentGroupId: newGroupId ?? undefined,
            attachmentIndex: nextIndex,
          }
        }),
        selectedItems: nextOrderedCards.map((card) => ({ id: card.id, kind: 'card' as const })),
      }
    })
    return newGroupId
  },
  detachAttachmentGroup: (groupId) =>
    set((state) => {
      const groupCards = getAttachmentGroupCards(state.cards, groupId)
      if (groupCards.length === 0) return state

      const anchorCard = groupCards[0]
      const anchorPosition = [...anchorCard.position] as [number, number, number]
      const anchorRotation = [...anchorCard.rotation] as [number, number, number]
      const cardIdSet = new Set(groupCards.map((card) => card.id))
      const laneId = anchorCard.laneId
      const lane = laneId ? state.lanes.find((entry) => entry.id === laneId) : undefined
      const anchorLaneIndex = lane ? lane.itemOrder.indexOf(anchorCard.id) : -1
      const detachedCards = state.cards.map((card) => (
        cardIdSet.has(card.id)
          ? { ...card, attachmentGroupId: undefined, attachmentIndex: undefined }
          : card
      ))
      const nextLanes = state.lanes.map((entry) => {
        if (entry.id !== laneId) return entry
        const nextOrder = [...entry.itemOrder]
        const anchorIndex = nextOrder.indexOf(anchorCard.id)
        if (anchorIndex === -1) return entry
        nextOrder.splice(anchorIndex, 1, ...groupCards.map((card) => card.id))
        return {
          ...entry,
          itemOrder: nextOrder,
        }
      })
      const nextLane = laneId ? nextLanes.find((entry) => entry.id === laneId) : undefined

      return {
        lanes: nextLanes,
        cards: state.cards.map((card) => {
          if (!cardIdSet.has(card.id)) return card
          const index = groupCards.findIndex((entry) => entry.id === card.id)
          const slotPosition = nextLane && anchorLaneIndex !== -1
            ? computeLaneSlotPosition(nextLane, anchorLaneIndex + index, detachedCards, state.decks, nextLane.itemOrder)
            : null
          return {
            ...card,
            position: slotPosition ?? computeDetachedCardPosition(anchorPosition, index, anchorRotation),
            rotation: anchorRotation,
            attachmentGroupId: undefined,
            attachmentIndex: undefined,
          }
        }),
      }
    }),
  moveAttachmentGroup: (groupId, anchorPosition, rotation, laneId, regionId) =>
    set((state) => {
      const groupCards = getAttachmentGroupCards(state.cards, groupId)
      if (groupCards.length === 0) return state

      const cardIdSet = new Set(groupCards.map((card) => card.id))
      const anchorCard = groupCards[0]
      const nextRotation = rotation ?? [...anchorCard.rotation] as [number, number, number]
      const nextLaneId = laneId ?? anchorCard.laneId
      const nextRegionId = regionId ?? anchorCard.regionId
      const anchorCardId = anchorCard.id

      return {
        cards: state.cards.map((card) => {
          if (!cardIdSet.has(card.id)) return card
          const index = groupCards.findIndex((entry) => entry.id === card.id)
          return {
            ...card,
            location: 'table',
            laneId: nextLaneId,
            regionId: nextRegionId,
            rotation: [...nextRotation],
            position: computeAttachedCardPosition(anchorPosition, index, nextRotation),
          }
        }),
        lanes: state.lanes.map((lane) => {
          const containsAnchor = lane.itemOrder.includes(anchorCardId)
          if (lane.id === nextLaneId) {
            return containsAnchor
              ? lane
              : { ...lane, itemOrder: [...lane.itemOrder, anchorCardId] }
          }

          if (!containsAnchor) return lane
          return {
            ...lane,
            itemOrder: lane.itemOrder.filter((id) => id !== anchorCardId),
          }
        }),
      }
    }),
  createStackFromCards: (cardIds, targetContext) => {
    let newDeckId: string | null = null
    set((state) => {
      const orderedCards = cardIds
        .map((cardId) => state.cards.find((card) => card.id === cardId))
        .filter((card): card is CardState => Boolean(card))

      if (orderedCards.length === 0) return state

      const anchorCard = orderedCards[0]
      newDeckId = `deck-${Date.now()}`
      const laneId = targetContext?.laneId ?? anchorCard.laneId
      const regionId = targetContext?.regionId ?? anchorCard.regionId
      const deckPosition = targetContext?.position ?? [...anchorCard.position] as [number, number, number]
      const deckRotation = targetContext?.rotation ?? [...anchorCard.rotation] as [number, number, number]
      const removedIds = orderedCards.map((card) => card.id)

      const nextDeck: DeckState = {
        id: newDeckId,
        kind: 'stack',
        position: [...deckPosition],
        rotation: [...deckRotation],
        cardIds: removedIds,
        laneId,
        regionId,
      }

      return {
        lanes: state.lanes.map((lane) => {
          if (lane.id !== laneId) {
            return {
              ...lane,
              itemOrder: lane.itemOrder.filter((id) => !removedIds.includes(id)),
            }
          }

          return {
            ...lane,
            itemOrder: buildLaneOrder(lane, removedIds, nextDeck.id, targetContext?.insertIndex),
          }
        }),
        decks: [...state.decks, nextDeck],
        cards: state.cards.map((card) => (
          removedIds.includes(card.id)
            ? applyFaceStateFromContainer(
                normalizeCardForDeck({
                  ...card,
                  location: 'deck',
                  laneId: undefined,
                  regionId: undefined,
                  attachmentGroupId: undefined,
                  attachmentIndex: undefined,
                  position: [...deckPosition],
                  rotation: [...deckRotation],
                }),
                state.lanes,
                state.regions,
                laneId,
                regionId,
              )
            : card
        )),
        selectedItems: newDeckId ? [{ id: newDeckId, kind: 'deck' as const }] : state.selectedItems,
      }
    })
    return newDeckId
  },
  combineSelectionIntoStack: (selection, targetContext) => {
    let newDeckId: string | null = null
    set((state) => {
      const sourceCards = selection.cardIds
        .map((cardId) => state.cards.find((card) => card.id === cardId))
        .filter((card): card is CardState => Boolean(card))
      const sourceDecks = selection.deckIds
        .map((deckId) => state.decks.find((deck) => deck.id === deckId))
        .filter((deck): deck is DeckState => Boolean(deck))

      const orderedItems = selection.orderedItems ?? [
        ...selection.cardIds.map((id) => ({ id, kind: 'card' as const })),
        ...selection.deckIds.map((id) => ({ id, kind: 'deck' as const })),
      ]
      const combinedCardIds = orderedItems.flatMap((item) => {
        if (item.kind === 'card') {
          return selection.cardIds.includes(item.id) ? [item.id] : []
        }

        const deck = sourceDecks.find((entry) => entry.id === item.id)
        return deck ? [...deck.cardIds] : []
      })

      if (combinedCardIds.length === 0) return state

      const anchorCard = sourceCards[0] ?? state.cards.find((card) => card.id === sourceDecks[0]?.cardIds[sourceDecks[0].cardIds.length - 1])
      if (!anchorCard) return state

      newDeckId = `deck-${Date.now()}`
      const laneId = targetContext?.laneId ?? anchorCard.laneId
      const regionId = targetContext?.regionId ?? anchorCard.regionId
      const deckPosition = targetContext?.position ?? [...anchorCard.position] as [number, number, number]
      const deckRotation = targetContext?.rotation ?? [...anchorCard.rotation] as [number, number, number]
      const removedItemIds = [...selection.cardIds, ...selection.deckIds]

      const nextDeck: DeckState = {
        id: newDeckId,
        kind: 'stack',
        position: [...deckPosition],
        rotation: [...deckRotation],
        cardIds: combinedCardIds,
        laneId,
        regionId,
      }

      return {
        lanes: state.lanes.map((lane) => {
          if (lane.id !== laneId) {
            return {
              ...lane,
              itemOrder: lane.itemOrder.filter((id) => !removedItemIds.includes(id)),
            }
          }

          return {
            ...lane,
            itemOrder: buildLaneOrder(lane, removedItemIds, nextDeck.id, targetContext?.insertIndex),
          }
        }),
        decks: [...state.decks.filter((deck) => !selection.deckIds.includes(deck.id)), nextDeck],
        cards: state.cards.map((card) => (
          combinedCardIds.includes(card.id)
            ? applyFaceStateFromContainer(
                normalizeCardForDeck({
                  ...card,
                  location: 'deck',
                  laneId: undefined,
                  regionId: undefined,
                  attachmentGroupId: undefined,
                  attachmentIndex: undefined,
                  position: [...deckPosition],
                  rotation: [...deckRotation],
                }),
                state.lanes,
                state.regions,
                laneId,
                regionId,
              )
            : card
        )),
        selectedItems: newDeckId ? [{ id: newDeckId, kind: 'deck' as const }] : state.selectedItems,
      }
    })
    return newDeckId
  },
  openDeckExamine: (deckId) =>
    set((state) => {
      const deck = state.decks.find((entry) => entry.id === deckId)
      if (!deck) return state

      const examinedCardOrder = toExaminedCardOrder(deck.cardIds)
      const originalFaceUpCardIds = state.cards
        .filter((card) => deck.cardIds.includes(card.id) && card.faceUp)
        .map((card) => card.id)

      return {
        cards: state.cards.map((card) => (
          deck.cardIds.includes(card.id)
            ? { ...card, faceUp: true }
            : card
        )),
        examinedStack: {
          deckId,
          cardOrder: examinedCardOrder,
          originalCardOrder: examinedCardOrder,
          originalFaceUpCardIds,
          hiddenDeck: true,
        },
        selectedItems: [],
      }
    }),
  closeDeckExamine: () =>
    set((state) => ({
      cards: restoreExaminedStackFaceDown(state.cards, state.examinedStack),
      examinedStack: null,
    })),
  reorderExaminedStack: (fromIndex, toIndex) =>
    set((state) => {
      if (!state.examinedStack) return state
      if (fromIndex === toIndex) return state

      const nextOrder = [...state.examinedStack.cardOrder]
      const [movedCardId] = nextOrder.splice(fromIndex, 1)
      if (!movedCardId) return state

      const clampedIndex = Math.max(0, Math.min(toIndex, nextOrder.length))
      nextOrder.splice(clampedIndex, 0, movedCardId)

      return {
        decks: state.decks.map((entry) => (
          entry.id === state.examinedStack?.deckId
            ? { ...entry, cardIds: fromExaminedCardOrder(nextOrder) }
            : entry
        )),
        examinedStack: {
          ...state.examinedStack,
          cardOrder: nextOrder,
        },
      }
    }),
  removeCardFromExaminedStack: (cardId) => {
    let removedIndex: number | null = null

    set((state) => {
      if (!state.examinedStack) return state
      const removedCardIndex = state.examinedStack.cardOrder.indexOf(cardId)
      if (removedCardIndex === -1) return state

      removedIndex = removedCardIndex
      const nextOrder = state.examinedStack.cardOrder.filter((id) => id !== cardId)

      return {
        decks: nextOrder.length === 0
          ? state.decks.filter((entry) => entry.id !== state.examinedStack?.deckId)
          : state.decks.map((entry) => (
              entry.id === state.examinedStack?.deckId
                ? { ...entry, cardIds: fromExaminedCardOrder(nextOrder) }
                : entry
            )),
        cards: state.cards.map((card) => (
          card.id === cardId
            ? {
                ...card,
                location: 'table',
                laneId: undefined,
                regionId: undefined,
                attachmentGroupId: undefined,
                attachmentIndex: undefined,
              }
            : card
        )),
        examinedStack: nextOrder.length === 0
          ? null
          : {
              ...state.examinedStack,
              cardOrder: nextOrder,
            },
      }
    })

    return removedIndex
  },
  commitExaminedStackOrder: () =>
    set((state) => {
      if (!state.examinedStack) return state
      const { deckId, cardOrder } = state.examinedStack
      const deck = state.decks.find((entry) => entry.id === deckId)
      if (!deck) {
        return { examinedStack: null }
      }

      return {
        decks: state.decks.map((entry) => (
          entry.id === deckId
            ? { ...entry, cardIds: fromExaminedCardOrder(cardOrder) }
            : entry
        )),
        examinedStack: {
          ...state.examinedStack,
          originalCardOrder: [...cardOrder],
        },
      }
    }),
  shuffleDeck: (deckId) =>
    set((state) => {
      const deck = state.decks.find((entry) => entry.id === deckId)
      if (!deck || deck.kind === 'sequence') return state

      const shuffledCardIds = shuffleArray(deck.cardIds)
      return {
        decks: state.decks.map((entry) => (
          entry.id === deckId
            ? { ...entry, cardIds: shuffledCardIds }
            : entry
        )),
        examinedStack: state.examinedStack?.deckId === deckId
          ? {
              ...state.examinedStack,
              cardOrder: toExaminedCardOrder(shuffledCardIds),
              originalCardOrder: toExaminedCardOrder(shuffledCardIds),
            }
          : state.examinedStack,
      }
    }),
  closeExaminedStackAndKeepOrder: () => {
    set((state) => ({
      cards: restoreExaminedStackFaceDown(state.cards, state.examinedStack),
      examinedStack: null,
    }))
  },
  closeExaminedStackAndShuffle: () => {
    const examinedStack = get().examinedStack
    if (!examinedStack) return
    const deck = get().decks.find((entry) => entry.id === examinedStack.deckId)
    if (!deck || deck.kind === 'sequence') {
      set((state) => ({
        cards: restoreExaminedStackFaceDown(state.cards, state.examinedStack),
        examinedStack: null,
      }))
      return
    }
    get().commitExaminedStackOrder()
    get().shuffleDeck(examinedStack.deckId)
    set((state) => ({
      cards: restoreExaminedStackFaceDown(state.cards, state.examinedStack),
      examinedStack: null,
    }))
  },
  createDeck: (card1Id, card2Id) =>
    set((state) => {
      const c1 = state.cards.find(c => c.id === card1Id)
      const c2 = state.cards.find(c => c.id === card2Id)
      if (!c1 || !c2) return state

      const laneId = c2.laneId;
      const regionId = c2.regionId;
      
      const newDeckId = `deck-${Date.now()}`
      const newDeck: DeckState = {
        id: newDeckId,
        kind: 'stack',
        position: [...c2.position], // place at card 2 position
        rotation: [...c2.rotation],
        cardIds: [card2Id, card1Id], // card 2 on bottom, card 1 on top
        laneId, // Inherit the lane from the target card
        regionId // Inherit the region from the target card
      }
      
      return {
        lanes: state.lanes.map(lane => {
          if (c2.laneId === lane.id) {
            // Replace the target card ID with the new deck ID and remove the dragged card
            return {
              ...lane,
              itemOrder: lane.itemOrder.map(id => id === card2Id ? newDeckId : id).filter(id => id !== card1Id)
            };
          }
          // Remove from other lanes
          return {
            ...lane,
            itemOrder: lane.itemOrder.filter(id => id !== card1Id && id !== card2Id)
          }
        }),
        decks: [...state.decks, newDeck],
        cards: state.cards.map(c => 
          (c.id === card1Id || c.id === card2Id) 
            ? applyFaceStateFromContainer(
                normalizeCardForDeck({
                  ...c,
                  location: 'deck',
                  laneId: undefined,
                  regionId: undefined,
                  attachmentGroupId: undefined,
                  attachmentIndex: undefined,
                }),
                state.lanes,
                state.regions,
                laneId,
                regionId,
              )
            : c
        )
      }
    }),
  addCardToDeck: (cardId, deckId) =>
    set((state) => {
      const targetDeck = state.decks.find((d) => d.id === deckId);
      if (!targetDeck || targetDeck.kind === 'sequence') return state
      return {
        lanes: state.lanes.map(lane => ({
          ...lane,
          itemOrder: lane.itemOrder.filter(id => id !== cardId)
        })),
        decks: state.decks.map(d => 
          d.id === deckId 
            ? { ...d, cardIds: [...d.cardIds, cardId] } // Add to top
            : d
        ),
        cards: state.cards.map(c => 
          c.id === cardId
            ? applyFaceStateFromContainer(
                normalizeCardForDeck({
                  ...c,
                  location: 'deck',
                  laneId: undefined,
                  regionId: undefined,
                  attachmentGroupId: undefined,
                  attachmentIndex: undefined,
                }),
                state.lanes,
                state.regions,
                targetDeck?.laneId,
                targetDeck?.regionId,
              )
            : c
        )
      }
    }),
  addCardUnderDeck: (cardId, deckId) =>
    set((state) => {
      const targetDeck = state.decks.find((d) => d.id === deckId);
      if (!targetDeck || targetDeck.kind === 'sequence') return state
      return {
        lanes: state.lanes.map(lane => ({
          ...lane,
          itemOrder: lane.itemOrder.filter(id => id !== cardId)
        })),
        decks: state.decks.map(d =>
          d.id === deckId
            ? { ...d, cardIds: [cardId, ...d.cardIds] } // Add to bottom
            : d
        ),
        cards: state.cards.map(c =>
          c.id === cardId
            ? applyFaceStateFromContainer(
                normalizeCardForDeck({
                  ...c,
                  location: 'deck',
                  laneId: undefined,
                  regionId: undefined,
                  attachmentGroupId: undefined,
                  attachmentIndex: undefined,
                }),
                state.lanes,
                state.regions,
                targetDeck?.laneId,
                targetDeck?.regionId,
              )
            : c
        )
      }
    }),
  addDeckToDeck: (sourceDeckId, targetDeckId) =>
    get().mergeDeckIntoDeck(sourceDeckId, targetDeckId, 'top'),
  mergeDeckIntoDeck: (sourceDeckId, targetDeckId, insertAt = 'top') =>
    set((state) => {
      const sourceDeck = state.decks.find(d => d.id === sourceDeckId)
      const targetDeck = state.decks.find(d => d.id === targetDeckId)
      if (!sourceDeck || !targetDeck || sourceDeckId === targetDeckId) return state
      if (sourceDeck.kind === 'sequence' || targetDeck.kind === 'sequence') return state

      const nextSelectedItems = state.selectedItems
        .filter((item) => item.id !== sourceDeckId)

      if (
        state.selectedItems.some((item) => item.id === sourceDeckId && item.kind === 'deck')
        && !nextSelectedItems.some((item) => item.id === targetDeckId && item.kind === 'deck')
      ) {
        nextSelectedItems.push({ id: targetDeckId, kind: 'deck' as const })
      }

      return {
        lanes: state.lanes.map(lane => {
          return {
            ...lane,
            itemOrder: lane.itemOrder.filter(id => id !== sourceDeckId)
          };
        }),
        decks: state.decks
          .filter(d => d.id !== sourceDeckId)
          .map(d => 
            d.id === targetDeckId
              ? {
                  ...d,
                  cardIds: insertAt === 'bottom'
                    ? [...sourceDeck.cardIds, ...d.cardIds]
                    : [...d.cardIds, ...sourceDeck.cardIds],
                }
              : d
          ),
        cards: state.cards.map((card) => (
          sourceDeck.cardIds.includes(card.id)
            ? applyFaceStateFromContainer(
                normalizeCardForDeck({
                  ...card,
                  location: 'deck',
                  laneId: undefined,
                  regionId: undefined,
                  attachmentGroupId: undefined,
                  attachmentIndex: undefined,
                }),
                state.lanes,
                state.regions,
                targetDeck.laneId,
                targetDeck.regionId,
              )
            : card
        )),
        selectedItems: nextSelectedItems,
      }
    }),
  removeTopCardFromDeck: (deckId: string) => {
    let topCardId: string | null = null
    set((state) => {
      const deck = state.decks.find((d: DeckState) => d.id === deckId)
      if (!deck || deck.cardIds.length === 0) return state
      
      topCardId = deck.cardIds[deck.cardIds.length - 1]
      const remainingIds = deck.cardIds.slice(0, -1)
      const isDissolving = remainingIds.length === 1;
      const lastCardId = isDissolving ? remainingIds[0] : null;

      // If dissolving and in a lane, we need to swap the ID in itemOrder
      const updatedLanes = state.lanes.map(lane => {
        if (isDissolving && deck.laneId === lane.id) {
          return {
            ...lane,
            itemOrder: lane.itemOrder.map(id => id === deckId ? lastCardId! : id)
          };
        }
        // If not dissolving but card removed, we still might need to remove it from lane (though top card shouldn't be in lane order directly)
        return lane;
      });
      
      return {
        lanes: updatedLanes,
        decks: remainingIds.length <= 1 
          ? state.decks.filter((d: DeckState) => d.id !== deckId)
          : state.decks.map((d: DeckState) => d.id === deckId ? { ...d, cardIds: remainingIds } : d),
        cards: state.cards.map((c: CardState) => {
          if (c.id === topCardId) {
            return {
              ...c,
              location: 'table',
              laneId: undefined,
              regionId: undefined,
              position: [...deck.position],
              rotation: [...deck.rotation],
              attachmentGroupId: undefined,
              attachmentIndex: undefined,
            }
          }
          if (isDissolving && c.id === lastCardId) {
            return {
              ...c,
              location: 'table',
              laneId: deck.laneId,
              regionId: deck.regionId,
              position: [...deck.position],
              rotation: [...deck.rotation],
              attachmentGroupId: undefined,
              attachmentIndex: undefined,
            }
          }
          return c
        })
      }
    })
    return topCardId
  },
  removeBottomCardFromDeck: (deckId: string) => {
    let bottomCardId: string | null = null
    set((state) => {
      const deck = state.decks.find((d: DeckState) => d.id === deckId)
      if (!deck || deck.cardIds.length === 0) return state

      bottomCardId = deck.cardIds[0]
      const remainingIds = deck.cardIds.slice(1)
      const isDissolving = remainingIds.length === 1
      const lastCardId = isDissolving ? remainingIds[0] : null

      const updatedLanes = state.lanes.map((lane) => {
        if (isDissolving && deck.laneId === lane.id) {
          return {
            ...lane,
            itemOrder: lane.itemOrder.map((id) => id === deckId ? lastCardId! : id),
          }
        }

        return lane
      })

      return {
        lanes: updatedLanes,
        decks: remainingIds.length <= 1
          ? state.decks.filter((d: DeckState) => d.id !== deckId)
          : state.decks.map((d: DeckState) => d.id === deckId ? { ...d, cardIds: remainingIds } : d),
        cards: state.cards.map((c: CardState) => {
          if (c.id === bottomCardId) {
            return {
              ...c,
              location: 'table',
              laneId: undefined,
              regionId: undefined,
              position: [...deck.position],
              rotation: [...deck.rotation],
              attachmentGroupId: undefined,
              attachmentIndex: undefined,
            }
          }
          if (isDissolving && c.id === lastCardId) {
            return {
              ...c,
              location: 'table',
              laneId: deck.laneId,
              regionId: deck.regionId,
              position: [...deck.position],
              rotation: [...deck.rotation],
              attachmentGroupId: undefined,
              attachmentIndex: undefined,
            }
          }
          return c
        }),
      }
    })
    return bottomCardId
  },
  setRegionStackCards: (regionId, orderedCardIds) =>
    set((state) => ({
      ...buildRegionSettlement(
        state,
        regionId,
        orderedCardIds,
        new Set([
          ...state.decks.filter((deck) => deck.regionId === regionId).map((deck) => deck.id),
          ...state.cards
            .filter((card) => card.location === 'table' && card.regionId === regionId)
            .map((card) => card.id),
        ]),
        new Set(state.decks.filter((deck) => deck.regionId === regionId).map((deck) => deck.id)),
        state.decks.find((deck) => deck.regionId === regionId)?.id ?? null,
        false,
      ),
    })),
  moveDeck: (id: string, position?: [number, number, number], rotation?: [number, number, number], laneId?: string, regionId?: string) => {
    console.log(`[Store] moveDeck: ${id}, laneId: ${laneId}, regionId: ${regionId}, pos: ${position}`);
    set((state) => {
      const deck = state.decks.find((d) => d.id === id);
      const cardIds = deck?.cardIds ?? [];
      return {
        decks: state.decks.map((d: DeckState) => {
          if (d.id !== id) return d
          return {
            ...d,
            laneId: laneId || undefined,
            regionId: regionId || undefined,
            position: position ? [...position] : [...d.position],
            rotation: rotation ? [...rotation] : [...d.rotation],
          }
        }),
        cards: state.cards.map((card) => (
          cardIds.includes(card.id)
            ? applyFaceStateFromContainer(
                { ...card },
                state.lanes,
                state.regions,
                laneId,
                regionId,
              )
            : card
        )),
      };
    })
  },
  dissolveDeck: (deckId: string) =>
    set((state) => {
      const deck = state.decks.find((d: DeckState) => d.id === deckId)
      if (!deck) return state
      
      if (deck.cardIds.length !== 1) {
        // Only dissolve if it has 1 card left
        return state
      }
      
      const lastCardId = deck.cardIds[0]
      
      return {
        lanes: state.lanes.map(lane => {
          if (deck.laneId === lane.id) {
            return {
              ...lane,
              itemOrder: lane.itemOrder.map(id => id === deckId ? lastCardId : id)
            };
          }
          return lane;
        }),
        decks: state.decks.filter((d: DeckState) => d.id !== deckId),
        cards: state.cards.map((c: CardState) => 
          c.id === lastCardId 
            ? {
                ...c,
                location: 'table',
                laneId: deck.laneId,
                regionId: deck.regionId,
                position: [...deck.position],
                rotation: [...deck.rotation],
                attachmentGroupId: undefined,
                attachmentIndex: undefined,
              }
            : c
        )
      }
    }),
  getLaneSlotPosition: (laneId: string, slotIndex: number) => {
    const state = get();
    const lane = state.lanes.find(l => l.id === laneId);
    if (!lane) return null;
    return computeLaneSlotPosition(lane, slotIndex, state.cards, state.decks);
  },
  insertIntoLane: (laneId: string, itemId: string, index: number) => {
    console.log(`[Store] insertIntoLane: lane: ${laneId}, item: ${itemId}, index: ${index}`);
    set((state) => ({
      lanes: state.lanes.map(lane => {
        if (lane.id !== laneId) return lane;
        // Remove if already present (reorder case)
        const filtered = lane.itemOrder.filter(id => id !== itemId);
        const clampedIndex = Math.min(index, filtered.length);
        const newOrder = [...filtered];
        newOrder.splice(clampedIndex, 0, itemId);
        console.log(`[Store]   -> newOrder for ${laneId}:`, newOrder);
        return { ...lane, itemOrder: newOrder };
      }),
    }))
  },
  reorderHand: (itemId: string, index: number) => {
    set((state) => {
      const handCards = state.cards.filter((card) => card.location === 'hand');
      const draggedCard = handCards.find((card) => card.id === itemId);
      if (!draggedCard) return state;

      const filteredHandCards = handCards.filter((card) => card.id !== itemId);
      const clampedIndex = Math.max(0, Math.min(index, filteredHandCards.length));
      const reorderedHandCards = [...filteredHandCards];
      reorderedHandCards.splice(clampedIndex, 0, draggedCard);

      let handCardIndex = 0;

      return {
        cards: state.cards.map((card) => {
          if (card.location !== 'hand') return card;
          const nextHandCard = reorderedHandCards[handCardIndex];
          handCardIndex += 1;
          return nextHandCard;
        }),
        handPreviewIndex: null,
        handPreviewItemId: null,
      };
    });
  },
  removeFromLane: (itemId: string) => {
    console.log(`[Store] removeFromLane: ${itemId}`);
    set((state) => ({
      lanes: state.lanes.map(lane => ({
        ...lane,
        itemOrder: lane.itemOrder.filter(id => id !== itemId),
      })),
      cards: state.cards.map(c => c.id === itemId ? { ...c, laneId: undefined } : c),
      decks: state.decks.map(d => d.id === itemId ? { ...d, laneId: undefined } : d),
    }))
  },
  removeFromRegion: (itemId: string) => {
    console.log(`[Store] removeFromRegion: ${itemId}`);
    set((state) => ({
      cards: state.cards.map(c => c.id === itemId ? { ...c, regionId: undefined } : c),
      decks: state.decks.map(d => d.id === itemId ? { ...d, regionId: undefined } : d),
    }))
  },
  reconcileRegion: (regionId: string) => {
    set((state) => ({
      ...reconcileRegionState(state, regionId),
    }))
  },
  dropSelectionIntoRegion: (items, regionId, selectSettledItems = true) => {
    set((state) => {
      const region = getRegionById(state.regions, regionId)
      if (!region) return state

      const incomingItemIds = new Set(items.map((item) => item.id))
      const incomingCardItemIds = new Set(items.filter((item) => item.kind === 'card').map((item) => item.id))
      const incomingDeckIds = new Set(items.filter((item) => item.kind === 'deck').map((item) => item.id))

      const existingDecks = state.decks.filter((deck) => deck.regionId === regionId && !incomingDeckIds.has(deck.id))
      const existingCards = state.cards.filter((card) => (
        card.location === 'table'
        && card.regionId === regionId
        && !incomingCardItemIds.has(card.id)
      ))

      const orderedCardIds = [
        ...existingDecks.flatMap((deck) => deck.cardIds),
        ...existingCards.map((card) => card.id),
        ...getOrderedCardIdsForSelection(state, items),
      ]

      const preferredDeckId = existingDecks[0]?.id
        ?? (items.length === 1 && items[0]?.kind === 'deck' ? items[0].id : null)

      return {
        ...buildRegionSettlement(
          state,
          regionId,
          orderedCardIds,
          incomingItemIds,
          new Set([...existingDecks.map((deck) => deck.id), ...incomingDeckIds]),
          preferredDeckId,
          selectSettledItems,
        ),
      }
    })
  },
  replaceBoardWithDecks: (setup) =>
    set((state) => {
      const game = getGameDefinition(state.activeGameId)
      const { lanes: freshLanes, regions: freshRegions } = createFreshBoardLayoutForGame(state.activeGameId)
      const playerDeckRegion = freshRegions.find((region) => region.id === 'region-player-deck')
      const mainSchemeRegion = freshRegions.find((region) => region.id === 'region-main-scheme')
      const villainDeckRegion = freshRegions.find((region) => region.id === 'region-villain-deck')
      const nemesisDeckRegion = freshRegions.find((region) => region.id === 'region-nemesis-deck')
      const playerAreaLane = freshLanes.find((lane) => lane.id === 'lane-player-area')
      const villainAreaLane = freshLanes.find((lane) => lane.id === 'lane-villain-area')

      if (
        !playerDeckRegion
        || !mainSchemeRegion
        || !villainDeckRegion
        || !nemesisDeckRegion
        || !playerAreaLane
        || !villainAreaLane
      ) {
        return get()
      }

      const heroDeckId = 'deck-hero'
      const encounterDeckId = 'deck-encounter'
      const villainSequenceDeckId = 'deck-villain'
      const mainSchemeDeckId = 'deck-main-scheme'
      const nemesisDeckId = 'deck-nemesis'

      const playerAreaOrder = setup.playerAreaCards.map((card) => card.id)
      const villainAreaOrder = [
        ...(setup.villainSequenceCards.length > 0 ? [villainSequenceDeckId] : []),
        ...setup.villainAreaCards.map((card) => card.id),
      ]

      const preparedPlayerDeckCards = prepareCardsForRegion(
        setup.playerDeckCards,
        playerDeckRegion,
        freshLanes,
        freshRegions,
      )
      const preparedPlayerAreaCards = prepareCardsForLane(
        setup.playerAreaCards,
        playerAreaLane,
        playerAreaOrder,
        freshLanes,
        freshRegions,
      ).map((card) => (
        card.typeCode === 'hero' || card.typeCode === 'alter_ego'
          ? { ...card, faceUp: true }
          : card
      ))
      const preparedVillainDeckCards = prepareCardsForRegion(
        setup.villainDeckCards,
        villainDeckRegion,
        freshLanes,
        freshRegions,
      )
      const preparedVillainSequenceCards = setup.villainSequenceCards.map((card) => (
        applyFaceStateFromContainer(
          normalizeCardForDeck({
            ...card,
            location: 'deck' as const,
            laneId: undefined,
            regionId: undefined,
            position: computeLaneSlotPosition(villainAreaLane, 0, [], [], villainAreaOrder),
            rotation: [0, 0, 0] as [number, number, number],
            attachmentGroupId: undefined,
            attachmentIndex: undefined,
          }),
          freshLanes,
          freshRegions,
          villainAreaLane.id,
          undefined,
        )
      ))
      const preparedVillainAreaCards = setup.villainAreaCards.map((card, index) => (
        applyFaceStateFromContainer(
          {
            ...card,
            location: 'table' as const,
            laneId: villainAreaLane.id,
            regionId: undefined,
            position: computeLaneSlotPosition(villainAreaLane, index + (setup.villainSequenceCards.length > 0 ? 1 : 0), setup.villainAreaCards, [], villainAreaOrder),
            rotation: [0, 0, 0] as [number, number, number],
            faceUp: true,
          },
          freshLanes,
          freshRegions,
          villainAreaLane.id,
          undefined,
          true,
        )
      ))
      const preparedMainSchemeCards = prepareCardsForRegion(
        setup.mainSchemeSequenceCards,
        mainSchemeRegion,
        freshLanes,
        freshRegions,
      ).map((card) => ({ ...card, tapped: true }))
      const preparedNemesisCards = prepareCardsForRegion(
        setup.nemesisDeckCards,
        nemesisDeckRegion,
        freshLanes,
        freshRegions,
      )

      const nextDecks: DeckState[] = [
        {
          id: heroDeckId,
          kind: 'stack' as const,
          position: computeRegionCardPosition(playerDeckRegion),
          rotation: [0, 0, 0] as [number, number, number],
          cardIds: preparedPlayerDeckCards.map((card) => card.id),
          regionId: playerDeckRegion.id,
        },
        {
          id: encounterDeckId,
          kind: 'stack' as const,
          position: computeRegionCardPosition(villainDeckRegion),
          rotation: [0, 0, 0] as [number, number, number],
          cardIds: preparedVillainDeckCards.map((card) => card.id),
          regionId: villainDeckRegion.id,
        },
        {
          id: villainSequenceDeckId,
          kind: 'sequence' as const,
          position: computeLaneSlotPosition(villainAreaLane, 0, [], [], villainAreaOrder),
          rotation: [0, 0, 0] as [number, number, number],
          cardIds: preparedVillainSequenceCards.map((card) => card.id),
          laneId: villainAreaLane.id,
        },
        {
          id: mainSchemeDeckId,
          kind: 'sequence' as const,
          position: computeRegionCardPosition(mainSchemeRegion, true),
          rotation: [0, 0, 0] as [number, number, number],
          cardIds: preparedMainSchemeCards.map((card) => card.id),
          regionId: mainSchemeRegion.id,
        },
        {
          id: nemesisDeckId,
          kind: 'stack' as const,
          position: computeRegionCardPosition(nemesisDeckRegion),
          rotation: [0, 0, 0] as [number, number, number],
          cardIds: preparedNemesisCards.map((card) => card.id),
          regionId: nemesisDeckRegion.id,
        },
      ].filter((deck) => deck.cardIds.length > 0)

      return {
        activeGameId: game.id,
        activeGameVersion: game.version,
        cards: [
          ...preparedPlayerDeckCards,
          ...preparedPlayerAreaCards,
          ...preparedVillainDeckCards,
          ...preparedVillainSequenceCards,
          ...preparedVillainAreaCards,
          ...preparedMainSchemeCards,
          ...preparedNemesisCards,
        ].map((card) => withCardMetadata(card, state.activeGameId)),
        decks: nextDecks,
        lanes: freshLanes.map((lane) => ({
          ...lane,
          itemOrder: lane.id === playerAreaLane.id
            ? playerAreaOrder
            : lane.id === villainAreaLane.id
              ? villainAreaOrder
              : [],
        })),
        regions: freshRegions,
        ...createBoardLoadState('preparing', game.ui.preparingNewGameLabel),
        gameInstanceId: state.gameInstanceId + 1,
        ...createTransientUiResetState(),
      }
    }),
  exportGameSession: () => exportSerializedGameSession(get()),
  importGameSession: (session) => set((state) => ({
    ...createImportedGameState(session),
    ...createBoardLoadState('preparing', 'Loading saved game...'),
    gameInstanceId: state.gameInstanceId + 1,
  })),

}))
