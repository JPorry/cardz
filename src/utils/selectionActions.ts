import { useGameStore, type CardState, type GameState, type SelectionItem, type StackTargetContext } from '../store'
import { getRegionContextualActions } from '../services/boardActions'

export type OrderedSelectionItem = SelectionItem & {
  x: number
  z: number
  laneId?: string
  regionId?: string
  insertIndex?: number
  position: [number, number, number]
  rotation: [number, number, number]
}

export interface SelectionAction {
  id: string
  label: string
  execute: () => void
}

export type SelectionActionSet = {
  orderedItems: OrderedSelectionItem[]
  selectedCardIds: string[]
  selectedDeckIds: string[]
  actions: SelectionAction[]
}

type SelectionActionOptions = {
  orderedSelectionItems?: SelectionItem[]
  targetContext?: StackTargetContext
}

function getSelectedCards(state: GameState, selectedCardIds: string[]): CardState[] {
  return selectedCardIds
    .map((id) => state.cards.find((card) => card.id === id))
    .filter((card): card is CardState => Boolean(card))
}

function getSingleAttachmentGroupId(cards: GameState['cards']): string | null {
  if (cards.length === 0) return null
  const groupId = cards[0]?.attachmentGroupId
  if (!groupId) return null
  return cards.every((card) => card.attachmentGroupId === groupId) ? groupId : null
}

function canAttachCards(cards: GameState['cards']) {
  return cards.length > 1 && cards.every((card) => (
    card.location === 'table'
    && !card.regionId
    && !card.attachmentGroupId
  ))
}

export function getOrderedSelectionItems(
  state: Pick<GameState, 'cards' | 'decks' | 'lanes'> & { regions?: GameState['regions'] },
  items: SelectionItem[],
): OrderedSelectionItem[] {
  const laneIndexMap = new Map<string, { laneId: string, index: number }>()

  state.lanes.forEach((lane) => {
    lane.itemOrder.forEach((itemId, index) => {
      laneIndexMap.set(itemId, { laneId: lane.id, index })
    })
  })

  return items
    .map((item): OrderedSelectionItem | null => {
      if (item.kind === 'card') {
        const card = state.cards.find((entry) => entry.id === item.id && entry.location === 'table')
        if (!card) return null
        const laneMeta = laneIndexMap.get(card.id)
        return {
          ...item,
          x: card.position[0],
          z: card.position[2],
          laneId: card.laneId,
          regionId: card.regionId,
          insertIndex: laneMeta?.index,
          position: [...card.position],
          rotation: [...card.rotation],
        }
      }

      const deck = state.decks.find((entry) => entry.id === item.id)
      if (!deck) return null
      const laneMeta = laneIndexMap.get(deck.id)
      return {
        ...item,
        x: deck.position[0],
        z: deck.position[2],
        laneId: deck.laneId,
        regionId: deck.regionId,
        insertIndex: laneMeta?.index,
        position: [...deck.position],
        rotation: [...deck.rotation],
      }
    })
    .filter((item): item is OrderedSelectionItem => Boolean(item))
    .sort((a, b) => {
      const laneA = a.insertIndex !== undefined ? 0 : 1
      const laneB = b.insertIndex !== undefined ? 0 : 1
      if (laneA !== laneB) return laneA - laneB
      if (a.laneId && b.laneId && a.laneId === b.laneId && a.insertIndex !== undefined && b.insertIndex !== undefined) {
        return a.insertIndex - b.insertIndex
      }
      if (Math.abs(a.z - b.z) > 0.01) return a.z - b.z
      return a.x - b.x
    })
}

export function getStackTargetContext(items: OrderedSelectionItem[]): StackTargetContext | undefined {
  const anchor = items[0]
  if (!anchor) return undefined

  return {
    position: [...anchor.position],
    rotation: [...anchor.rotation],
    laneId: anchor.laneId,
    regionId: anchor.regionId,
    insertIndex: anchor.insertIndex,
  }
}

export function getSelectionActionSet(
  state: GameState,
  items: SelectionItem[] = state.selectedItems,
  options: SelectionActionOptions = {},
): SelectionActionSet {
  const orderedItems = getOrderedSelectionItems(state, items)
  const actionItems = options.orderedSelectionItems ?? orderedItems.map((item) => ({ id: item.id, kind: item.kind }))
  const selectedCardIds = actionItems.filter((item) => item.kind === 'card').map((item) => item.id)
  const selectedDeckIds = actionItems.filter((item) => item.kind === 'deck').map((item) => item.id)
  const targetContext = options.targetContext ?? getStackTargetContext(orderedItems)
  const selectedCards = getSelectedCards(state, selectedCardIds)
  const selectedAttachmentGroupId = getSingleAttachmentGroupId(selectedCards)
  const canAttachSelection = selectedDeckIds.length === 0 && canAttachCards(selectedCards)
  const { flipCards, tapCards, flipStack, tapDeck, shuffleDeck, attachCards, detachAttachmentGroup, createStackFromCards, combineSelectionIntoStack, setPreviewCard, openDeckExamine } = state

  const actions: SelectionAction[] = []

  if (orderedItems.length === 0) {
    return { orderedItems, selectedCardIds, selectedDeckIds, actions }
  }

  if (selectedDeckIds.length === 1 && selectedCardIds.length === 0) {
    actions.push(
      { id: 'flip-stack', label: 'Flip', execute: () => flipStack(selectedDeckIds[0]) },
      { id: 'tap-stack', label: 'Tap', execute: () => tapDeck(selectedDeckIds[0]) },
      { id: 'shuffle-stack', label: 'Shuffle', execute: () => shuffleDeck(selectedDeckIds[0]) },
      { id: 'examine-stack', label: 'Examine', execute: () => openDeckExamine(selectedDeckIds[0]) },
    )
    actions.push(...getRegionContextualActions(state, actionItems))
    return { orderedItems, selectedCardIds, selectedDeckIds, actions }
  }

  if (selectedDeckIds.length === 0 && selectedCardIds.length > 0) {
    if (orderedItems.length === 1) {
      actions.push({
        id: 'reveal-card',
        label: 'Reveal',
        execute: () => setPreviewCard(selectedCardIds[0]),
      })
      actions.push(
        { id: 'flip-cards', label: 'Flip', execute: () => flipCards(selectedCardIds) },
        { id: 'tap-cards', label: 'Tap', execute: () => tapCards(selectedCardIds) },
      )
      actions.push(...getRegionContextualActions(state, actionItems))
      return { orderedItems, selectedCardIds, selectedDeckIds, actions }
    }

    actions.push(
      { id: 'flip-cards', label: 'Flip', execute: () => flipCards(selectedCardIds) },
      { id: 'tap-cards', label: 'Tap', execute: () => tapCards(selectedCardIds) },
      ...(selectedAttachmentGroupId
        ? [{ id: 'detach-attachment', label: 'Detach', execute: () => detachAttachmentGroup(selectedAttachmentGroupId) } satisfies SelectionAction]
        : []),
      ...(canAttachSelection
        ? [{ id: 'attach-cards', label: 'Attach', execute: () => attachCards(selectedCardIds) } satisfies SelectionAction]
        : []),
      {
        id: 'stack-cards',
        label: 'Stack',
        execute: () => createStackFromCards(selectedCardIds, targetContext),
      },
    )
    return { orderedItems, selectedCardIds, selectedDeckIds, actions }
  }

  if (selectedDeckIds.length > 1 || (selectedDeckIds.length > 0 && selectedCardIds.length > 0)) {
    actions.push(
      {
        id: 'tap-mixed',
        label: 'Tap',
        execute: () => {
          if (selectedCardIds.length > 0) {
            tapCards(selectedCardIds)
          }
          selectedDeckIds.forEach((deckId) => tapDeck(deckId))
        },
      },
      {
        id: 'combine',
        label: 'Combine',
        execute: () => {
          combineSelectionIntoStack(
            { cardIds: selectedCardIds, deckIds: selectedDeckIds, orderedItems: actionItems },
            targetContext,
          )
        },
      },
    )
  }

  actions.push(...getRegionContextualActions(state, actionItems))
  return { orderedItems, selectedCardIds, selectedDeckIds, actions }
}

function getShortcutSelectionItems(state: GameState): SelectionItem[] {
  return state.draggedSelectionItems.length > 0 ? state.draggedSelectionItems : state.selectedItems
}

export function executeFlipShortcut() {
  const state = useGameStore.getState()

  if (state.draggedSelectionItems.length > 0) {
    const action = getSelectionActionSet(state, state.draggedSelectionItems).actions.find((entry) => entry.id === 'flip-stack' || entry.id === 'flip-cards')
    action?.execute()
    return
  }

  if (state.hoveredCardId) {
    state.flipCard(state.hoveredCardId)
    return
  }

  const action = getSelectionActionSet(state).actions.find((entry) => entry.id === 'flip-stack' || entry.id === 'flip-cards')
  action?.execute()
}

export function executeTapShortcut() {
  const state = useGameStore.getState()

  if (state.draggedSelectionItems.length > 0) {
    const action = getSelectionActionSet(state, state.draggedSelectionItems).actions.find((entry) =>
      entry.id === 'tap-stack' || entry.id === 'tap-cards' || entry.id === 'tap-mixed')
    action?.execute()
    return
  }

  if (state.hoveredCardId) {
    state.tapCard(state.hoveredCardId)
    return
  }

  const action = getSelectionActionSet(state).actions.find((entry) =>
    entry.id === 'tap-stack' || entry.id === 'tap-cards' || entry.id === 'tap-mixed')
  action?.execute()
}

export function executeStackShortcut() {
  const state = useGameStore.getState()
  const isDraggingSelection = state.draggedSelectionItems.length > 0
  const items = getShortcutSelectionItems(state)
  const action = getSelectionActionSet(
    state,
    items,
    isDraggingSelection
      ? {
          orderedSelectionItems: state.draggedSelectionItems,
          targetContext: state.dragTargetContext ?? undefined,
        }
      : {},
  ).actions.find((entry) => entry.id === 'stack-cards' || entry.id === 'combine')
  action?.execute()

  if (isDraggingSelection) {
    const nextState = useGameStore.getState()
    nextState.setDraggedSelectionItems(nextState.selectedItems)
  }
}
