import {
  type CardMatchConfig,
  getRegionConfig,
  type BoardActionTargetRef,
  type DeckSourcePosition,
  type MergeRegionAction,
  type RegionActionConfig,
  type SequenceRegionAction,
  type SequenceStepConfig,
} from '../config/board'
import {
  useGameStore,
  type CardState,
  type GameState,
  type SelectionItem,
} from '../store'

export interface ContextualMenuAction {
  id: string
  label: string
  execute: () => void
}

type CardLike = Pick<CardState, 'id' | 'code' | 'name' | 'typeCode' | 'cardSetCode'>

type SequenceExecutionContext = {
  ownerRegionId: string
  remainingCardIds: string[]
}

function getCardSelectionItems(card: CardState, state: Pick<GameState, 'cards'>): SelectionItem[] {
  if (!card.attachmentGroupId) {
    return [{ id: card.id, kind: 'card' }]
  }

  if ((card.attachmentIndex ?? 0) !== 0) {
    return []
  }

  return state.cards
    .filter((entry) => entry.attachmentGroupId === card.attachmentGroupId)
    .sort((left, right) => (left.attachmentIndex ?? 0) - (right.attachmentIndex ?? 0))
    .map((entry) => ({ id: entry.id, kind: 'card' as const }))
}

function getTargetSelectionItems(
  state: Pick<GameState, 'cards' | 'decks' | 'lanes'> & { regions: GameState['regions'] },
  target: BoardActionTargetRef,
): SelectionItem[] {
  if (target.kind === 'hand') {
    return state.cards
      .filter((card) => card.location === 'hand')
      .map((card) => ({ id: card.id, kind: 'card' as const }))
  }

  if (target.kind === 'lane') {
    const lane = state.lanes.find((entry) => entry.id === target.id)
    if (!lane) return []

    return lane.itemOrder.flatMap((itemId) => {
      const deck = state.decks.find((entry) => entry.id === itemId)
      if (deck) {
        return [{ id: deck.id, kind: 'deck' as const }]
      }

      const card = state.cards.find((entry) => entry.id === itemId && entry.location === 'table')
      return card ? getCardSelectionItems(card, state) : []
    })
  }

  const regionDecks = state.decks.filter((deck) => deck.regionId === target.id)
  const regionCards = state.cards.filter((card) => card.location === 'table' && card.regionId === target.id)
  const expandedRegionCards = regionCards.flatMap((card) => getCardSelectionItems(card, state))

  return [
    ...regionDecks.map((deck) => ({ id: deck.id, kind: 'deck' as const })),
    ...expandedRegionCards,
  ].filter((item, index, items) => (
    items.findIndex((entry) => entry.id === item.id && entry.kind === item.kind) === index
  ))
}

function getSingleSelectedRegionContext(
  state: Pick<GameState, 'cards' | 'decks'>,
  items: SelectionItem[],
): { regionId: string; actions: RegionActionConfig[] } | null {
  if (items.length !== 1) return null

  const [item] = items
  const regionId = item.kind === 'card'
    ? state.cards.find((card) => card.id === item.id)?.regionId
    : state.decks.find((deck) => deck.id === item.id)?.regionId

  if (!regionId) return null

  const region = getRegionConfig(regionId)
  if (!region?.actions?.length) return null

  return {
    regionId,
    actions: region.actions,
  }
}

function getRegionCardCount(state: Pick<GameState, 'cards' | 'decks'>, regionId: string): number {
  const deckCards = state.decks
    .filter((deck) => deck.regionId === regionId)
    .reduce((total, deck) => total + deck.cardIds.length, 0)
  const looseCards = state.cards.filter((card) => card.location === 'table' && card.regionId === regionId).length
  return deckCards + looseCards
}

function getRegionOrderedCardIds(state: Pick<GameState, 'cards' | 'decks'>, regionId: string): string[] {
  const regionDeck = state.decks.find((deck) => deck.regionId === regionId)
  if (regionDeck) {
    return [...regionDeck.cardIds]
  }

  return state.cards
    .filter((card) => card.location === 'table' && card.regionId === regionId)
    .map((card) => card.id)
}

function matchesValue(value: string | undefined, expected: string | string[] | undefined): boolean {
  if (expected === undefined) return true
  if (Array.isArray(expected)) {
    return value !== undefined && expected.includes(value)
  }
  return value === expected
}

function matchesCard(card: CardLike, match?: CardMatchConfig): boolean {
  if (!match) return true

  return matchesValue(card.code, match.code)
    && matchesValue(card.name, match.name)
    && matchesValue(card.typeCode, match.typeCode)
    && matchesValue(card.cardSetCode, match.cardSetCode)
}

function selectMatchedCardIds(
  state: Pick<GameState, 'cards'>,
  remainingCardIds: string[],
  match: CardMatchConfig | undefined,
  from: DeckSourcePosition,
  count?: number,
): string[] {
  const traversalOrder = from === 'bottom' ? [...remainingCardIds] : [...remainingCardIds].reverse()
  const matched = traversalOrder.filter((cardId) => {
    const card = state.cards.find((entry) => entry.id === cardId)
    return card ? matchesCard(card, match) : false
  })

  return matched.slice(0, count ?? matched.length)
}

function isActionAvailable(state: GameState, ownerRegionId: string, action: RegionActionConfig): boolean {
  if (action.type === 'deal') {
    if (action.to.kind === 'region' && action.to.id === ownerRegionId) {
      return false
    }
    return getRegionCardCount(state, ownerRegionId) >= action.count
  }

  if (action.type === 'advance') {
    return getRegionCardCount(state, ownerRegionId) > 1
  }

  if (action.type === 'merge') {
    return getRegionCardCount(state, ownerRegionId) > 0 && getRegionCardCount(state, action.to.id) > 0
  }

  if (action.type === 'sequence') {
    const remainingCardIds = getRegionOrderedCardIds(state, ownerRegionId)
    if (remainingCardIds.length === 0) return false

    const context: SequenceExecutionContext = {
      ownerRegionId,
      remainingCardIds: [...remainingCardIds],
    }

    return action.steps.every((step) => isSequenceStepAvailable(state, context, step))
  }

  if (action.from.kind === 'region' && action.from.id === ownerRegionId) {
    return false
  }

  return getTargetSelectionItems(state, action.from).length > 0
}

function normalizeRegionSource(regionId: string) {
  const store = useGameStore.getState()
  const regionDecks = store.decks.filter((deck) => deck.regionId === regionId)
  const regionCards = store.cards.filter((card) => card.location === 'table' && card.regionId === regionId)
  const totalCards = regionDecks.reduce((total, deck) => total + deck.cardIds.length, 0) + regionCards.length

  if (totalCards > 1 && (regionDecks.length !== 1 || regionCards.length > 0)) {
    store.reconcileRegion(regionId)
  }
}

function normalizeRegionStack(regionId: string) {
  normalizeRegionSource(regionId)
}

function removeRemainingIds(remainingCardIds: string[], removedCardIds: string[]) {
  const removed = new Set(removedCardIds)
  return remainingCardIds.filter((cardId) => !removed.has(cardId))
}

function extractRegionCards(regionId: string, count: number, from: DeckSourcePosition): string[] {
  const dealtCardIds: string[] = []

  for (let index = 0; index < count; index += 1) {
    const store = useGameStore.getState()
    const sourceDeck = store.decks.find((deck) => deck.regionId === regionId)
    if (sourceDeck) {
      const cardId = from === 'bottom'
        ? store.removeBottomCardFromDeck(sourceDeck.id)
        : store.removeTopCardFromDeck(sourceDeck.id)
      if (!cardId) break
      dealtCardIds.push(cardId)
      continue
    }

    const looseCard = store.cards.find((card) => card.location === 'table' && card.regionId === regionId)
    if (!looseCard) {
      break
    }

    store.moveCard(looseCard.id, 'table', [...looseCard.position], [...looseCard.rotation])
    dealtCardIds.push(looseCard.id)
  }

  return dealtCardIds
}

function settleCardsToHand(cardIds: string[]) {
  cardIds.forEach((cardId) => {
    const store = useGameStore.getState()
    const card = store.cards.find((entry) => entry.id === cardId)
    if (!card) return

    store.moveCard(cardId, 'hand', [...card.position], [...card.rotation])
    const handCount = useGameStore.getState().cards.filter((entry) => entry.location === 'hand').length
    useGameStore.getState().reorderHand(cardId, handCount - 1)
  })
}

function settleCardsToLane(cardIds: string[], laneId: string) {
  cardIds.forEach((cardId) => {
    const store = useGameStore.getState()
    const lane = store.lanes.find((entry) => entry.id === laneId)
    if (!lane) return

    const nextIndex = lane.itemOrder.length
    store.insertIntoLane(laneId, cardId, nextIndex)
    const nextPosition = useGameStore.getState().getLaneSlotPosition(laneId, nextIndex)
    store.moveCard(cardId, 'table', nextPosition ?? [...lane.position], [0, 0, 0], laneId)
  })
}

function settleCardsToRegion(cardIds: string[], regionId: string) {
  if (cardIds.length === 0) return
  useGameStore.getState().dropSelectionIntoRegion(
    cardIds.map((id) => ({ id, kind: 'card' as const })),
    regionId,
  )
}

function isSequenceStepAvailable(
  state: GameState,
  context: SequenceExecutionContext,
  step: SequenceStepConfig,
): boolean {
  if (step.type === 'deal') {
    const selectedCardIds = selectMatchedCardIds(state, context.remainingCardIds, step.match, step.from, step.count)
    if (selectedCardIds.length === 0) return false
    if (step.to.kind === 'region' && step.to.id === context.ownerRegionId) return false
    context.remainingCardIds = removeRemainingIds(context.remainingCardIds, selectedCardIds)
    return true
  }

  if (context.remainingCardIds.length === 0) return false
  return getRegionCardCount(state, step.to.id) > 0
}

function executeDealAction(ownerRegionId: string, action: Extract<RegionActionConfig, { type: 'deal' }>) {
  normalizeRegionSource(ownerRegionId)
  const dealtCardIds = extractRegionCards(ownerRegionId, action.count, action.from)
  if (dealtCardIds.length === 0) return

  if (action.to.kind === 'hand') {
    settleCardsToHand(dealtCardIds)
    return
  }

  if (action.to.kind === 'lane') {
    settleCardsToLane(dealtCardIds, action.to.id)
    return
  }

  settleCardsToRegion(dealtCardIds, action.to.id)
}

function executeRecoverAction(ownerRegionId: string, action: Extract<RegionActionConfig, { type: 'recover' }>) {
  const store = useGameStore.getState()
  const sourceItems = getTargetSelectionItems(store, action.from)
  if (sourceItems.length === 0) return

  store.dropSelectionIntoRegion(sourceItems, ownerRegionId)

  if (!action.shuffle) return

  const rebuiltDeck = useGameStore.getState().decks.find((deck) => deck.regionId === ownerRegionId)
  if (rebuiltDeck) {
    useGameStore.getState().shuffleDeck(rebuiltDeck.id)
  }
}

function executeAdvanceAction(ownerRegionId: string, action: Extract<RegionActionConfig, { type: 'advance' }>) {
  normalizeRegionSource(ownerRegionId)
  const sourceDeck = useGameStore.getState().decks.find((deck) => deck.regionId === ownerRegionId)
  if (!sourceDeck) return

  for (let index = 0; index < action.count; index += 1) {
    useGameStore.getState().advanceStack(sourceDeck.id)
  }
}

function executeMergeAction(ownerRegionId: string, action: MergeRegionAction) {
  normalizeRegionStack(ownerRegionId)
  normalizeRegionStack(action.to.id)

  const store = useGameStore.getState()
  const sourceDeck = store.decks.find((deck) => deck.regionId === ownerRegionId)
  const targetDeck = store.decks.find((deck) => deck.regionId === action.to.id)
  if (!sourceDeck || !targetDeck) return

  store.mergeDeckIntoDeck(sourceDeck.id, targetDeck.id, action.insertAt)

  if (!action.shuffle) return

  const mergedDeck = useGameStore.getState().decks.find((deck) => deck.id === targetDeck.id)
  if (mergedDeck) {
    useGameStore.getState().shuffleDeck(mergedDeck.id)
  }
}

function executeSequenceAction(ownerRegionId: string, action: SequenceRegionAction) {
  normalizeRegionStack(ownerRegionId)

  const initialState = useGameStore.getState()
  const context: SequenceExecutionContext = {
    ownerRegionId,
    remainingCardIds: getRegionOrderedCardIds(initialState, ownerRegionId),
  }

  action.steps.forEach((step) => {
    if (step.type === 'deal') {
      const currentState = useGameStore.getState()
      const selectedCardIds = selectMatchedCardIds(
        currentState,
        context.remainingCardIds,
        step.match,
        step.from,
        step.count,
      )
      if (selectedCardIds.length === 0) return

      context.remainingCardIds = removeRemainingIds(context.remainingCardIds, selectedCardIds)
      currentState.setRegionStackCards(ownerRegionId, context.remainingCardIds)

      if (step.to.kind === 'hand') {
        settleCardsToHand(selectedCardIds)
        return
      }

      if (step.to.kind === 'lane') {
        settleCardsToLane(selectedCardIds, step.to.id)
        return
      }

      settleCardsToRegion(selectedCardIds, step.to.id)
      return
    }

    const currentState = useGameStore.getState()
    currentState.setRegionStackCards(ownerRegionId, context.remainingCardIds)
    normalizeRegionStack(step.to.id)

    const sourceDeck = useGameStore.getState().decks.find((deck) => deck.regionId === ownerRegionId)
    const targetDeck = useGameStore.getState().decks.find((deck) => deck.regionId === step.to.id)
    if (!sourceDeck || !targetDeck) return

    useGameStore.getState().mergeDeckIntoDeck(sourceDeck.id, targetDeck.id, step.insertAt)
    context.remainingCardIds = []

    if (step.shuffle) {
      const mergedDeck = useGameStore.getState().decks.find((deck) => deck.id === targetDeck.id)
      if (mergedDeck) {
        useGameStore.getState().shuffleDeck(mergedDeck.id)
      }
    }
  })
}

function executeRegionAction(regionId: string, action: RegionActionConfig) {
  if (action.type === 'deal') {
    executeDealAction(regionId, action)
    return
  }

  if (action.type === 'advance') {
    executeAdvanceAction(regionId, action)
    return
  }

  if (action.type === 'merge') {
    executeMergeAction(regionId, action)
    return
  }

  if (action.type === 'sequence') {
    executeSequenceAction(regionId, action)
    return
  }

  executeRecoverAction(regionId, action)
}

export function getRegionContextualActions(
  state: GameState,
  items: SelectionItem[],
): ContextualMenuAction[] {
  const context = getSingleSelectedRegionContext(state, items)
  if (!context) return []

  return context.actions
    .filter((action) => isActionAvailable(state, context.regionId, action))
    .map((action) => ({
      id: `region-action:${context.regionId}:${action.name}`,
      label: action.name,
      execute: () => executeRegionAction(context.regionId, action),
    }))
}
