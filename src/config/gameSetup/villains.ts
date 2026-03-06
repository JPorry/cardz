export interface CardSetReference {
  name: string
  pack_code: string
  card_set_code: string
}

export const VILLAIN_SETS: CardSetReference[] = [
  { name: 'Rhino', pack_code: 'core', card_set_code: 'rhino' },
  { name: 'Klaw', pack_code: 'core', card_set_code: 'klaw' },
  { name: 'Ultron', pack_code: 'core', card_set_code: 'ultron' },
]
