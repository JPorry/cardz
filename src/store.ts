import { create } from 'zustand'
import { getRandomCards, getArtworkUrl } from './services/marvelCdb'

export type RadialSlice = 'n' | 'e' | 's' | 'w' | 'c' | null

export interface RadialMenuState {
  isOpen: boolean
  x: number
  y: number
  cardId: string | null
  hoveredSlice: RadialSlice
}
export type CardLocation = 'deck' | 'hand' | 'table' | 'discard'

export interface CardState {
  id: string
  location: CardLocation
  position: [number, number, number] // specific position if on table
  rotation: [number, number, number] // specific rotation if on table
  faceUp: boolean
  artworkUrl?: string
  name?: string
  code?: string
}

export interface DeckState {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  cardIds: string[]
}

export interface GameState {
  cards: CardState[]
  decks: DeckState[]
  isDragging: boolean
  activeDragType: 'card' | 'deck' | null
  hoveredCardId: string | null
  hoveredCardScreenX: number | null
  previewCardId: string | null
  focusedCardId: string | null
  radialMenu: RadialMenuState
  setDragging: (dragging: boolean, type?: 'card' | 'deck' | null, id?: string | null) => void
  setHoveredCard: (id: string | null, x?: number | null) => void
  setPreviewCard: (id: string | null) => void
  setFocusedCard: (id: string | null) => void
  moveCard: (id: string, location: CardLocation, position?: [number, number, number], rotation?: [number, number, number]) => void
  flipCard: (id: string) => void
  openRadialMenu: (x: number, y: number, cardId: string) => void
  closeRadialMenu: () => void
  setRadialHover: (slice: RadialSlice) => void
  createDeck: (card1Id: string, card2Id: string) => void
  addCardToDeck: (cardId: string, deckId: string) => void
  addDeckToDeck: (sourceDeckId: string, targetDeckId: string) => void
  removeTopCardFromDeck: (deckId: string) => string | null
  moveDeck: (id: string, position?: [number, number, number], rotation?: [number, number, number]) => void
  dissolveDeck: (deckId: string) => void
  loadRandomCards: () => Promise<void>
}

export const useGameStore = create<GameState>((set) => ({
  isDragging: false,
  activeDragType: null,
  draggedCardId: null,
  draggedDeckId: null,
  radialMenu: {
    isOpen: false,
    x: 0,
    y: 0,
    cardId: null,
    hoveredSlice: null,
  },
  hoveredCardId: null,
  hoveredCardScreenX: null,
  previewCardId: null,
  focusedCardId: null,
  setDragging: (dragging, type = null, _id = null) => 
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
  cards: [
    // Initial mock data to match the reference image: some cards on table, some in hand
    { id: 'card-1', location: 'table', position: [-2, 0, -1], rotation: [0, 0, 0], faceUp: true },
    { id: 'card-2', location: 'table', position: [-2, 0, 2], rotation: [0, 0, 0], faceUp: true },
    { id: 'card-3', location: 'hand', position: [0, 0, 0], rotation: [0, 0, 0], faceUp: false },
    { id: 'card-4', location: 'hand', position: [0, 0, 0], rotation: [0, 0, 0], faceUp: false },
    { id: 'card-5', location: 'hand', position: [0, 0, 0], rotation: [0, 0, 0], faceUp: false },
    { id: 'card-6', location: 'hand', position: [0, 0, 0], rotation: [0, 0, 0], faceUp: false },
  ],
  decks: [],
  moveCard: (id, location, position, rotation) =>
    set((state) => ({
      cards: state.cards.map((c) => {
        if (c.id !== id) return c
        return {
          ...c,
          location,
          // Always create fresh array references to avoid shared state bugs during React renders
          position: position ? [...position] : [...c.position],
          rotation: rotation ? [...rotation] : [...c.rotation],
        }
      }),
    })),
  flipCard: (id) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? { ...c, faceUp: !c.faceUp } : c)),
    })),
  openRadialMenu: (x, y, cardId) =>
    set({
      radialMenu: { isOpen: true, x, y, cardId, hoveredSlice: null },
    }),
  closeRadialMenu: () =>
    set((state) => ({
      radialMenu: { ...state.radialMenu, isOpen: false, cardId: null, hoveredSlice: null },
    })),
  setRadialHover: (slice) =>
    set((state) => ({
      radialMenu: { ...state.radialMenu, hoveredSlice: slice },
    })),
  createDeck: (card1Id, card2Id) =>
    set((state) => {
      const c1 = state.cards.find(c => c.id === card1Id)
      const c2 = state.cards.find(c => c.id === card2Id)
      if (!c1 || !c2) return state
      
      const newDeckId = `deck-${Date.now()}`
      const newDeck: DeckState = {
        id: newDeckId,
        position: [...c2.position], // place at card 2 position
        rotation: [...c2.rotation],
        cardIds: [card2Id, card1Id] // card 2 on bottom, card 1 on top
      }
      
      return {
        decks: [...state.decks, newDeck],
        cards: state.cards.map(c => 
          (c.id === card1Id || c.id === card2Id) 
            ? { ...c, location: 'deck' } 
            : c
        )
      }
    }),
  addCardToDeck: (cardId, deckId) =>
    set((state) => {
      return {
        decks: state.decks.map(d => 
          d.id === deckId 
            ? { ...d, cardIds: [...d.cardIds, cardId] } // Add to top
            : d
        ),
        cards: state.cards.map(c => 
          c.id === cardId ? { ...c, location: 'deck' } : c
        )
      }
    }),
  addDeckToDeck: (sourceDeckId, targetDeckId) =>
    set((state) => {
      const sourceDeck = state.decks.find(d => d.id === sourceDeckId)
      if (!sourceDeck) return state
      
      return {
        decks: state.decks
          .filter(d => d.id !== sourceDeckId)
          .map(d => 
            d.id === targetDeckId
              ? { ...d, cardIds: [...d.cardIds, ...sourceDeck.cardIds] } // target on bottom, source on top
              : d
          )
      }
    }),
  removeTopCardFromDeck: (deckId: string) => {
    let topCardId: string | null = null
    set((state) => {
      const deck = state.decks.find((d: DeckState) => d.id === deckId)
      if (!deck || deck.cardIds.length === 0) return state
      
      topCardId = deck.cardIds[deck.cardIds.length - 1]
      const remainingIds = deck.cardIds.slice(0, -1)
      
      return {
        decks: remainingIds.length <= 1 
          ? state.decks.filter((d: DeckState) => d.id !== deckId)
          : state.decks.map((d: DeckState) => d.id === deckId ? { ...d, cardIds: remainingIds } : d),
        cards: state.cards.map((c: CardState) => {
          if (c.id === topCardId) {
            return { ...c, location: 'table', position: [...deck.position], rotation: [...deck.rotation] }
          }
          if (remainingIds.length === 1 && c.id === remainingIds[0]) {
            return { ...c, location: 'table', position: [...deck.position], rotation: [...deck.rotation] }
          }
          return c
        })
      }
    })
    return topCardId
  },
  moveDeck: (id: string, position?: [number, number, number], rotation?: [number, number, number]) =>
    set((state) => ({
      decks: state.decks.map((d: DeckState) => {
        if (d.id !== id) return d
        return {
          ...d,
          position: position ? [...position] : [...d.position],
          rotation: rotation ? [...rotation] : [...d.rotation],
        }
      }),
    })),
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
        decks: state.decks.filter((d: DeckState) => d.id !== deckId),
        cards: state.cards.map((c: CardState) => 
          c.id === lastCardId 
            ? { ...c, location: 'table', position: [...deck.position], rotation: [...deck.rotation] }
            : c
        )
      }
    }),
  loadRandomCards: async () => {
    const marvelCards = await getRandomCards(6)
    
    set((state) => ({
      cards: state.cards.map((c, i) => {
        if (i < marvelCards.length) {
          const mc = marvelCards[i]
          return {
            ...c,
            name: mc.name,
            code: mc.code,
            artworkUrl: getArtworkUrl(mc)
          }
        }
        return c
      })
    }))
  },
}))
