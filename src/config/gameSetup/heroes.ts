export interface HeroDeckReference {
  name: string
  deckId: number
}

export const HERO_DECKS: HeroDeckReference[] = [
  { name: 'Spider-Man', deckId: 31300 },
  { name: 'Wolverine', deckId: 40815 },
  { name: 'Iron Man', deckId: 56728 },
  { name: 'Star-Lord', deckId: 12205 },
]
