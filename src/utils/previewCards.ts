import { getDeckTopCardId, type GameState, type SelectionItem } from '../store'

export function getSelectionPreviewCardId(
  state: Pick<GameState, 'cards' | 'decks'>,
  item: SelectionItem,
  fallbackCardId: string | null = null,
) {
  if (item.kind === 'card') {
    return fallbackCardId ?? item.id
  }

  const deck = state.decks.find((entry) => entry.id === item.id)
  if (!deck || deck.cardIds.length === 0) return null

  const topCardId = getDeckTopCardId(deck)
  if (!topCardId) return null
  const topCard = state.cards.find((entry) => entry.id === topCardId)
  return topCard?.faceUp ? topCardId : null
}
