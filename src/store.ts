import { create } from 'zustand'

export type RadialSlice = 'n' | 'e' | 's' | 'w' | 'c' | null

export interface RadialMenuState {
  isOpen: boolean
  x: number
  y: number
  itemId: string | null
  itemType: 'card' | 'deck' | null
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
  laneId?: string
  regionId?: string
  tapped?: boolean
}

export interface DeckState {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  cardIds: string[]
  laneId?: string
  regionId?: string
}

export interface LaneState {
  id: string
  label: string
  position: [number, number, number] // center of the lane
  width: number   // extent along X
  depth: number   // extent along Z
  cardSpacing: number // horizontal spacing between items
  itemOrder: string[] // ordered list of card/deck IDs in this lane
}

export interface RegionState {
  id: string
  label: string
  position: [number, number, number]
  width: number
  depth: number
}

export interface GameState {
  cards: CardState[]
  decks: DeckState[]
  lanes: LaneState[]
  regions: RegionState[]
  activeLaneId: string | null
  activeRegionId: string | null
  lanePreviewLaneId: string | null
  lanePreviewIndex: number | null
  lanePreviewItemId: string | null
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
  setActiveLane: (id: string | null) => void
  setActiveRegion: (id: string | null) => void
  setLanePreview: (laneId: string | null, index: number | null, itemId: string | null) => void
  moveCard: (id: string, location: CardLocation, position?: [number, number, number], rotation?: [number, number, number], laneId?: string, regionId?: string) => void
  flipCard: (id: string) => void
  openRadialMenu: (x: number, y: number, itemId: string, itemType: 'card' | 'deck') => void
  closeRadialMenu: () => void
  setRadialHover: (slice: RadialSlice) => void
  createDeck: (card1Id: string, card2Id: string) => void
  addCardToDeck: (cardId: string, deckId: string) => void
  addCardUnderDeck: (cardId: string, deckId: string) => void
  addDeckToDeck: (sourceDeckId: string, targetDeckId: string) => void
  removeTopCardFromDeck: (deckId: string) => string | null
  moveDeck: (id: string, position?: [number, number, number], rotation?: [number, number, number], laneId?: string, regionId?: string) => void
  dissolveDeck: (deckId: string) => void
  getLaneSlotPosition: (laneId: string, slotIndex: number) => [number, number, number] | null
  insertIntoLane: (laneId: string, itemId: string, index: number) => void
  removeFromLane: (itemId: string) => void
  removeFromRegion: (itemId: string) => void
  tapCard: (id: string) => void
  flipDeck: (deckId: string) => void
  tapDeck: (deckId: string) => void

}

// Helper to compute slot position at a given index in a lane (left-to-right)
export function computeLaneSlotPosition(lane: LaneState, slotIndex: number): [number, number, number] {
  const padding = 1.0; // inset from the left edge
  const leftEdge = lane.position[0] - lane.width / 2 + padding;
  const x = leftEdge + slotIndex * lane.cardSpacing;
  const zOffset = 0.25; // Shift cards down to hug the bottom border
  return [x, lane.position[1], lane.position[2] + zOffset];
}

// Helper to compute insertion index from an X world position
export function computeLaneInsertIndex(lane: LaneState, worldX: number, currentCount: number): number {
  const padding = 1.0;
  const leftEdge = lane.position[0] - lane.width / 2 + padding;
  const relativeX = worldX - leftEdge;
  const index = Math.round(relativeX / lane.cardSpacing);
  return Math.max(0, Math.min(index, currentCount));
}

export const useGameStore = create<GameState>((set, get) => ({
  isDragging: false,
  activeDragType: null,
  draggedCardId: null,
  draggedDeckId: null,
  radialMenu: {
    isOpen: false,
    x: 0,
    y: 0,
    itemId: null,
    itemType: null,
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
  setActiveLane: (id) => set({ activeLaneId: id }),
  setActiveRegion: (id) => set({ activeRegionId: id }),
  setLanePreview: (laneId, index, itemId) => set({ lanePreviewLaneId: laneId, lanePreviewIndex: index, lanePreviewItemId: itemId }),
  cards: [
    // Hardcoded test cards with fixed Marvel card IDs for consistent testing
    { id: 'card-1', location: 'table', position: [-2, 0, -1], rotation: [0, 0, 0], faceUp: true, name: 'Spider-Man', code: '01001a', artworkUrl: 'https://images.weserv.nl/?url=marvelcdb.com/bundles/cards/01001a.png' },
    { id: 'card-2', location: 'table', position: [-2, 0, 2], rotation: [0, 0, 0], faceUp: true, name: 'Captain Marvel', code: '01010a', artworkUrl: 'https://images.weserv.nl/?url=marvelcdb.com/bundles/cards/01010a.png' },
    { id: 'card-3', location: 'hand', position: [0, 0, 0], rotation: [0, 0, 0], faceUp: false, name: 'Iron Man', code: '01029a', artworkUrl: 'https://images.weserv.nl/?url=marvelcdb.com/bundles/cards/01029a.png' },
    { id: 'card-4', location: 'hand', position: [0, 0, 0], rotation: [0, 0, 0], faceUp: false, name: 'Black Panther', code: '01040a', artworkUrl: 'https://images.weserv.nl/?url=marvelcdb.com/bundles/cards/01040a.png' },
    { id: 'card-5', location: 'hand', position: [0, 0, 0], rotation: [0, 0, 0], faceUp: false, name: 'She-Hulk', code: '01019a', artworkUrl: 'https://images.weserv.nl/?url=marvelcdb.com/bundles/cards/01019a.png' },
    { id: 'card-6', location: 'hand', position: [0, 0, 0], rotation: [0, 0, 0], faceUp: false, name: 'Black Cat', code: '01002', artworkUrl: 'https://images.weserv.nl/?url=marvelcdb.com/bundles/cards/01002.png' },
  ],
  decks: [],
  lanes: [
    {
      id: 'lane-player-area',
      label: 'Player Area',
      position: [0, 0, 3.5],
      width: 16,
      depth: 2.7,
      cardSpacing: 2.0,
      itemOrder: [],
    },
  ],
  regions: [
    {
      id: 'region-main-scheme',
      label: 'Main Scheme',
      position: [-6, 0, -2.5],
      width: 2.5,
      depth: 3.5,
    }
  ],
  activeLaneId: null,
  activeRegionId: null,
  lanePreviewLaneId: null,
  lanePreviewIndex: null,
  lanePreviewItemId: null,
  moveCard: (id, location, position, rotation, laneId, regionId) => {
    console.log(`[Store] moveCard: ${id}, location: ${location}, laneId: ${laneId}, regionId: ${regionId}, pos: ${position}`);
    set((state) => ({
      cards: state.cards.map((c) => {
        if (c.id !== id) return c
        return {
          ...c,
          location,
          laneId: laneId || undefined,
          regionId: regionId || undefined,
          // Always create fresh array references to avoid shared state bugs during React renders
          position: position ? [...position] : [...c.position],
          rotation: rotation ? [...rotation] : [...c.rotation],
        }
      }),
    }))
  },
  flipCard: (id) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? { ...c, faceUp: !c.faceUp } : c)),
    })),
  tapCard: (id) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? { ...c, tapped: !c.tapped } : c)),
    })),
  openRadialMenu: (x, y, itemId, itemType) =>
    set({
      radialMenu: { isOpen: true, x, y, itemId, itemType, hoveredSlice: null },
    }),
  closeRadialMenu: () =>
    set((state) => ({
      radialMenu: { ...state.radialMenu, isOpen: false, itemId: null, itemType: null, hoveredSlice: null },
    })),
  setRadialHover: (slice) =>
    set((state) => ({
      radialMenu: { ...state.radialMenu, hoveredSlice: slice },
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
  tapDeck: (deckId) =>
    set((state) => {
      const deck = state.decks.find((d) => d.id === deckId);
      if (!deck) return state;

      return {
        cards: state.cards.map((c) => (deck.cardIds.includes(c.id) ? { ...c, tapped: !c.tapped } : c)),
      };
    }),
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
        cardIds: [card2Id, card1Id], // card 2 on bottom, card 1 on top
        laneId: c2.laneId, // Inherit the lane from the target card
        regionId: c2.regionId // Inherit the region from the target card
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
            ? { ...c, location: 'deck', laneId: undefined, regionId: undefined } 
            : c
        )
      }
    }),
  addCardToDeck: (cardId, deckId) =>
    set((state) => {
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
          c.id === cardId ? { ...c, location: 'deck', laneId: undefined, regionId: undefined } : c
        )
      }
    }),
  addCardUnderDeck: (cardId, deckId) =>
    set((state) => {
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
          c.id === cardId ? { ...c, location: 'deck', laneId: undefined, regionId: undefined } : c
        )
      }
    }),
  addDeckToDeck: (sourceDeckId, targetDeckId) =>
    set((state) => {
      const sourceDeck = state.decks.find(d => d.id === sourceDeckId)
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
    set((state) => ({
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
    }))
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
    return computeLaneSlotPosition(lane, slotIndex);
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

}))
