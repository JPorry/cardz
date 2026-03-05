const { createStore } = require('zustand/vanilla')

const useGameStore = createStore((set) => ({
  cards: [
    { id: 'card-3', location: 'hand', position: [0, 0, 0], rotation: [0, 0, 0], faceUp: false },
    { id: 'card-4', location: 'hand', position: [0, 0, 0], rotation: [0, 0, 0], faceUp: false },
  ],
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
}))

useGameStore.getState().moveCard('card-3', 'table', [5,0,5], [0,0,0])
useGameStore.getState().flipCard('card-3')
console.log(useGameStore.getState().cards[0])
useGameStore.getState().moveCard('card-4', 'table', [2,0,2], [0,0,0])
console.log(useGameStore.getState().cards[0])
