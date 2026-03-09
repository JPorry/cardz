export interface HeroDeckReference {
  name: string
  deckId: number
}

export const HERO_DECKS: HeroDeckReference[] = [
  { name: 'Spider-Man', deckId: 31300 },
  { name: 'Captain Marvel', deckId: 31304},
  { name: 'Iron Man', deckId: 56728 },
  { name: 'Black Panther', deckId: 31500},
  { name: 'She-Hulk', deckId: 31307},
  // { name: 'Star-Lord', deckId: 12205 },
  // { name: 'Wolverine', deckId: 40815 },
]
