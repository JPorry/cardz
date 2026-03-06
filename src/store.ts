import { create } from 'zustand'
import { INITIAL_LANES, INITIAL_REGIONS } from './utils/boardUtils'
import { getCardCenterOffsetBelowTitle, getTitleWorldHeight, LANE_TITLE_LAYOUT } from './utils/areaLayout'
import { getEffectiveCardDimensions } from './utils/cardOrientation'

export type CardLocation = 'deck' | 'hand' | 'table' | 'discard'
export type SelectionKind = 'card' | 'deck'

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
}

export interface GameSetupLayout {
  playerDeckCards: CardState[]
  playerAreaCards: CardState[]
  villainDeckCards: CardState[]
  villainAreaCards: CardState[]
  villainStackCards: CardState[]
  mainSchemeStackCards: CardState[]
  nemesisDeckCards: CardState[]
}

export interface DeckState {
  id: string
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
  pendingClosePrompt: boolean
}

export interface LaneState {
  id: string
  label: string
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
  position: [number, number, number]
  width: number
  depth: number
  flipped: boolean
}

export interface GameState {
  cards: CardState[]
  decks: DeckState[]
  lanes: LaneState[]
  regions: RegionState[]
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
  previewCardId: string | null
  focusedCardId: string | null
  setDragging: (dragging: boolean, type?: 'card' | 'deck' | null, id?: string | null) => void
  setHoveredCard: (id: string | null, x?: number | null) => void
  setPreviewCard: (id: string | null) => void
  setFocusedCard: (id: string | null) => void
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
  removeTopCardFromDeck: (deckId: string) => string | null
  moveDeck: (id: string, position?: [number, number, number], rotation?: [number, number, number], laneId?: string, regionId?: string) => void
  dissolveDeck: (deckId: string) => void
  getLaneSlotPosition: (laneId: string, slotIndex: number) => [number, number, number] | null
  insertIntoLane: (laneId: string, itemId: string, index: number) => void
  reorderHand: (itemId: string, index: number) => void
  removeFromLane: (itemId: string) => void
  removeFromRegion: (itemId: string) => void
  tapCard: (id: string) => void
  tapCards: (ids: string[]) => void
  flipDeck: (deckId: string) => void
  flipStack: (deckId: string) => void
  tapDeck: (deckId: string) => void
  advanceStack: (deckId: string) => void
  createStackFromCards: (cardIds: string[], targetContext?: StackTargetContext) => string | null
  combineSelectionIntoStack: (selection: { cardIds: string[], deckIds: string[], orderedItems?: SelectionItem[] }, targetContext?: StackTargetContext) => string | null
  openDeckExamine: (deckId: string) => void
  closeDeckExamine: () => void
  setExaminedStackPendingClosePrompt: (pending: boolean) => void
  reorderExaminedStack: (fromIndex: number, toIndex: number) => void
  commitExaminedStackOrder: () => void
  shuffleDeck: (deckId: string) => void
  closeExaminedStackAndKeepOrder: () => void
  closeExaminedStackAndShuffle: () => void
  replaceBoardWithDecks: (setup: GameSetupLayout) => void
}

const LANE_LEFT_PADDING = 1.25
const TABLE_CARD_SCALE = 1.35
const TABLE_CARD_WIDTH = 1.44 * TABLE_CARD_SCALE
const LANE_INSERT_SNAP_RATIO = 0.65

function getLaneGap(lane: LaneState): number {
  return lane.cardSpacing - TABLE_CARD_WIDTH
}

function getDeckTopCard(deck: DeckState, cards: CardState[]): CardState | undefined {
  const topCardId = deck.cardIds[deck.cardIds.length - 1]
  return cards.find((card) => card.id === topCardId)
}

function getLaneItemWidth(
  itemId: string,
  cards: CardState[],
  decks: DeckState[],
): number {
  const card = cards.find((entry) => entry.id === itemId)
  if (card) {
    return getEffectiveCardDimensions(card).width * TABLE_CARD_SCALE
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
  const firstSlotCenter = lane.position[0] - lane.width / 2 + LANE_LEFT_PADDING
  const gap = getLaneGap(lane)
  const centers: number[] = []

  for (let index = 0; index < itemOrder.length; index += 1) {
    const currentWidth = getLaneItemWidth(itemOrder[index], cards, decks)
    if (index === 0) {
      centers.push(firstSlotCenter + (currentWidth - TABLE_CARD_WIDTH) / 2)
      continue
    }

    const previousWidth = getLaneItemWidth(itemOrder[index - 1], cards, decks)
    centers.push(centers[index - 1] + previousWidth / 2 + gap + currentWidth / 2)
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
  const leftEdge = lane.position[0] - lane.width / 2 + LANE_LEFT_PADDING
  const centers = getLaneSlotCenters(lane, cards, decks, itemOrder)
  const x = centers[slotIndex] ?? leftEdge
  const labelWorldHeight = getTitleWorldHeight(
    LANE_TITLE_LAYOUT.worldWidth,
    LANE_TITLE_LAYOUT.canvasWidth,
    LANE_TITLE_LAYOUT.canvasHeight,
  )
  const zOffset = getCardCenterOffsetBelowTitle(
    lane.depth,
    LANE_TITLE_LAYOUT.labelCenterOffset,
    labelWorldHeight,
  )
  return [x, lane.position[1], lane.position[2] + zOffset]
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
    const currentWidth = getLaneItemWidth(itemOrder[index], cards, decks)
    const gapCenter = centers[index] + currentWidth / 2 + gap / 2
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
): T {
  const flipped = getContainerFlippedDefault(lanes, regions, laneId, regionId);
  return flipped === undefined ? item : { ...item, faceUp: !flipped };
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
        position: [...region.position] as [number, number, number],
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
        faceUp: false,
      },
      lanes,
      regions,
      lane.id,
      undefined,
    )
  ))
}

export const useGameStore = create<GameState>((set, get) => ({
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
  previewCardId: null,
  focusedCardId: null,
  setDragging: (dragging, type = null) => 
    set((state) => ({ 
      isDragging: dragging, 
      activeDragType: dragging ? type : null,
      // Clear hover when dragging starts
      hoveredCardId: dragging ? null : state.hoveredCardId,
      hoveredCardScreenX: dragging ? null : state.hoveredCardScreenX
    })),
  setHoveredCard: (id, x) => set({ hoveredCardId: id, hoveredCardScreenX: x ?? null }),
  setPreviewCard: (id) => set({ previewCardId: id }),
  setFocusedCard: (id) => set({ focusedCardId: id }),
  setSelectedItems: (items) => set({ selectedItems: upsertSelectionItems(items) }),
  setDraggedSelectionItems: (items) => set({ draggedSelectionItems: upsertSelectionItems(items) }),
  setDragTargetContext: (context) => set({ dragTargetContext: context ? { ...context } : null }),
  selectOnly: (item) => set({ selectedItems: item ? [item] : [] }),
  toggleSelection: (item) => set((state) => ({
    selectedItems: state.selectedItems.some((entry) => selectionItemsEqual(entry, item))
      ? state.selectedItems.filter((entry) => !selectionItemsEqual(entry, item))
      : [...state.selectedItems, item],
  })),
  clearSelection: () => set({ selectedItems: [], selectionBounds: null }),
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
  lanes: INITIAL_LANES.map(lane => ({ ...lane, itemOrder: [] })),
  regions: INITIAL_REGIONS,
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
      const deck = state.decks.find((d) => d.id === deckId);
      if (!deck) return state;

      // Reverse the card order in the deck
      const reversedIds = [...deck.cardIds].reverse();

      return {
        decks: state.decks.map((d) => (d.id === deckId ? { ...d, cardIds: reversedIds } : d)),
        cards: state.cards.map((c) => (deck.cardIds.includes(c.id) ? { ...c, faceUp: !c.faceUp } : c)),
      };
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

      const advancedIds = [...deck.cardIds.slice(1), deck.cardIds[0]]
      return {
        decks: state.decks.map((entry) => (
          entry.id === deckId
            ? { ...entry, cardIds: advancedIds }
            : entry
        )),
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
                {
                  ...card,
                  location: 'deck',
                  laneId: undefined,
                  regionId: undefined,
                  position: [...deckPosition],
                  rotation: [...deckRotation],
                },
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
                {
                  ...card,
                  location: 'deck',
                  laneId: undefined,
                  regionId: undefined,
                  position: [...deckPosition],
                  rotation: [...deckRotation],
                },
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

      return {
        examinedStack: {
          deckId,
          cardOrder: [...deck.cardIds],
          originalCardOrder: [...deck.cardIds],
          pendingClosePrompt: false,
        },
        selectedItems: [{ id: deckId, kind: 'deck' as const }],
      }
    }),
  closeDeckExamine: () => set({ examinedStack: null }),
  setExaminedStackPendingClosePrompt: (pending) =>
    set((state) => (
      state.examinedStack
        ? {
            examinedStack: {
              ...state.examinedStack,
              pendingClosePrompt: pending,
            },
          }
        : state
    )),
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
        examinedStack: {
          ...state.examinedStack,
          cardOrder: nextOrder,
        },
      }
    }),
  commitExaminedStackOrder: () =>
    set((state) => {
      if (!state.examinedStack) return state
      const { deckId, cardOrder } = state.examinedStack
      const deck = state.decks.find((entry) => entry.id === deckId)
      if (!deck) {
        return { examinedStack: null }
      }

      return {
        decks: state.decks.map((entry) => entry.id === deckId ? { ...entry, cardIds: [...cardOrder] } : entry),
        examinedStack: {
          ...state.examinedStack,
          originalCardOrder: [...cardOrder],
          pendingClosePrompt: false,
        },
      }
    }),
  shuffleDeck: (deckId) =>
    set((state) => {
      const deck = state.decks.find((entry) => entry.id === deckId)
      if (!deck) return state

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
              cardOrder: [...shuffledCardIds],
              originalCardOrder: [...shuffledCardIds],
              pendingClosePrompt: false,
            }
          : state.examinedStack,
      }
    }),
  closeExaminedStackAndKeepOrder: () => {
    get().commitExaminedStackOrder()
    set({ examinedStack: null })
  },
  closeExaminedStackAndShuffle: () => {
    const examinedStack = get().examinedStack
    if (!examinedStack) return
    get().commitExaminedStackOrder()
    get().shuffleDeck(examinedStack.deckId)
    set({ examinedStack: null })
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
                { ...c, location: 'deck', laneId: undefined, regionId: undefined },
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
                { ...c, location: 'deck', laneId: undefined, regionId: undefined },
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
                { ...c, location: 'deck', laneId: undefined, regionId: undefined },
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
    set((state) => {
      const sourceDeck = state.decks.find(d => d.id === sourceDeckId)
      const targetDeck = state.decks.find(d => d.id === targetDeckId)
      if (!sourceDeck) return state
      
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
              ? { ...d, cardIds: [...d.cardIds, ...sourceDeck.cardIds] } // target on bottom, source on top
              : d
          ),
        cards: targetDeck
          ? state.cards.map((card) => (
              sourceDeck.cardIds.includes(card.id)
                ? applyFaceStateFromContainer(
                    { ...card },
                    state.lanes,
                    state.regions,
                    targetDeck.laneId,
                    targetDeck.regionId,
                  )
                : card
            ))
          : state.cards,
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
            return { ...c, location: 'table', laneId: undefined, regionId: undefined, position: [...deck.position], rotation: [...deck.rotation] }
          }
          if (isDissolving && c.id === lastCardId) {
            return { ...c, location: 'table', laneId: deck.laneId, regionId: deck.regionId, position: [...deck.position], rotation: [...deck.rotation] }
          }
          return c
        })
      }
    })
    return topCardId
  },
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
            ? { ...c, location: 'table', laneId: deck.laneId, regionId: deck.regionId, position: [...deck.position], rotation: [...deck.rotation] }
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
  replaceBoardWithDecks: (setup) =>
    set((state) => {
      const playerDeckRegion = state.regions.find((region) => region.id === 'region-player-deck')
      const mainSchemeRegion = state.regions.find((region) => region.id === 'region-main-scheme')
      const villainRegion = state.regions.find((region) => region.id === 'region-villain')
      const villainDeckRegion = state.regions.find((region) => region.id === 'region-villain-deck')
      const nemesisDeckRegion = state.regions.find((region) => region.id === 'region-nemesis-deck')
      const playerAreaLane = state.lanes.find((lane) => lane.id === 'lane-player-area')
      const villainAreaLane = state.lanes.find((lane) => lane.id === 'lane-villain-area')

      if (
        !playerDeckRegion
        || !mainSchemeRegion
        || !villainRegion
        || !villainDeckRegion
        || !nemesisDeckRegion
        || !playerAreaLane
        || !villainAreaLane
      ) {
        return state
      }

      const heroDeckId = 'deck-hero'
      const encounterDeckId = 'deck-encounter'
      const villainStackDeckId = 'deck-villain'
      const mainSchemeDeckId = 'deck-main-scheme'
      const nemesisDeckId = 'deck-nemesis'

      const playerAreaOrder = setup.playerAreaCards.map((card) => card.id)
      const villainAreaOrder = setup.villainAreaCards.map((card) => card.id)

      const preparedPlayerDeckCards = prepareCardsForRegion(
        setup.playerDeckCards,
        playerDeckRegion,
        state.lanes,
        state.regions,
      )
      const preparedPlayerAreaCards = prepareCardsForLane(
        setup.playerAreaCards,
        playerAreaLane,
        playerAreaOrder,
        state.lanes,
        state.regions,
      ).map((card) => (
        card.typeCode === 'hero' || card.typeCode === 'alter_ego'
          ? { ...card, faceUp: true }
          : card
      ))
      const preparedVillainDeckCards = prepareCardsForRegion(
        setup.villainDeckCards,
        villainDeckRegion,
        state.lanes,
        state.regions,
      )
      const preparedVillainAreaCards = prepareCardsForLane(
        setup.villainAreaCards,
        villainAreaLane,
        villainAreaOrder,
        state.lanes,
        state.regions,
      )
      const preparedVillainStackCards = prepareCardsForRegion(
        setup.villainStackCards,
        villainRegion,
        state.lanes,
        state.regions,
      )
      const preparedMainSchemeCards = prepareCardsForRegion(
        setup.mainSchemeStackCards,
        mainSchemeRegion,
        state.lanes,
        state.regions,
      ).map((card) => ({ ...card, tapped: true }))
      const preparedNemesisCards = prepareCardsForRegion(
        setup.nemesisDeckCards,
        nemesisDeckRegion,
        state.lanes,
        state.regions,
      )

      const nextDecks: DeckState[] = [
        {
          id: heroDeckId,
          position: [...playerDeckRegion.position] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          cardIds: preparedPlayerDeckCards.map((card) => card.id),
          regionId: playerDeckRegion.id,
        },
        {
          id: encounterDeckId,
          position: [...villainDeckRegion.position] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          cardIds: preparedVillainDeckCards.map((card) => card.id),
          regionId: villainDeckRegion.id,
        },
        {
          id: villainStackDeckId,
          position: [...villainRegion.position] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          cardIds: preparedVillainStackCards.map((card) => card.id),
          regionId: villainRegion.id,
        },
        {
          id: mainSchemeDeckId,
          position: [...mainSchemeRegion.position] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          cardIds: preparedMainSchemeCards.map((card) => card.id),
          regionId: mainSchemeRegion.id,
        },
        {
          id: nemesisDeckId,
          position: [...nemesisDeckRegion.position] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          cardIds: preparedNemesisCards.map((card) => card.id),
          regionId: nemesisDeckRegion.id,
        },
      ].filter((deck) => deck.cardIds.length > 0)

      return {
        cards: [
          ...preparedPlayerDeckCards,
          ...preparedPlayerAreaCards,
          ...preparedVillainDeckCards,
          ...preparedVillainAreaCards,
          ...preparedVillainStackCards,
          ...preparedMainSchemeCards,
          ...preparedNemesisCards,
        ],
        decks: nextDecks,
        lanes: state.lanes.map((lane) => ({
          ...lane,
          itemOrder: lane.id === playerAreaLane.id
            ? playerAreaOrder
            : lane.id === villainAreaLane.id
              ? villainAreaOrder
              : [],
        })),
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
    }),

}))
