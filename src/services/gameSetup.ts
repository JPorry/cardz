import type { CardState, GameSetupLayout } from '../store'
import { getArtworkUrl, type MarvelCard } from './marvelCdb'
import type { HeroDeckReference } from '../config/gameSetup/heroes'
import type { CardSetReference } from '../config/gameSetup/villains'

interface DecklistResponse {
  id: number
  name: string
  hero_code: string
  hero_name: string
  slots: Record<string, number>
}

interface GameSetupSelection {
  hero: HeroDeckReference
  villain: CardSetReference
  modular: CardSetReference
  difficulty: CardSetReference
  villainMode: 'standard' | 'hard'
}

export interface PreparedGameSetup extends GameSetupLayout {
  selection: {
    heroName: string
    villainName: string
    modularName: string
    difficultyName: string
    villainMode: 'standard' | 'hard'
  }
}

const API_BASE_URL = 'https://marvelcdb.com/api/public'

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

async function fetchDecklist(deckId: number): Promise<DecklistResponse> {
  return fetchJson<DecklistResponse>(`${API_BASE_URL}/decklist/${deckId}`)
}

async function fetchCard(cardCode: string): Promise<MarvelCard> {
  return fetchJson<MarvelCard>(`${API_BASE_URL}/card/${cardCode}`)
}

async function fetchPackCards(packCode: string): Promise<MarvelCard[]> {
  return fetchJson<MarvelCard[]>(`${API_BASE_URL}/cards/${packCode}.json`)
}

function cloneCard(card: MarvelCard): MarvelCard {
  return {
    ...card,
    linked_card: card.linked_card ? { ...card.linked_card } : undefined,
  }
}

function hasFrontArtwork(card: MarvelCard): boolean {
  return Boolean(card.imagesrc)
}

function parseStage(stage: MarvelCard['stage']): number | undefined {
  if (typeof stage === 'number' && Number.isFinite(stage)) {
    return stage
  }

  if (typeof stage === 'string') {
    const match = stage.match(/\d+/)
    if (match) {
      return Number(match[0])
    }

    const romanStage = stage.trim().toUpperCase()
    if (romanStage === 'I') return 1
    if (romanStage === 'II') return 2
    if (romanStage === 'III') return 3
  }

  return undefined
}

function normalizeCard(card: MarvelCard, prefix: string, index: number): CardState {
  return {
    id: `${prefix}-${index + 1}`,
    location: 'deck',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    faceUp: false,
    artworkUrl: getArtworkUrl(card, 'front'),
    backArtworkUrl: card.linked_card
      ? getArtworkUrl(card.linked_card, 'front')
      : card.double_sided
        ? getArtworkUrl(card, 'back')
        : undefined,
    name: card.name,
    code: card.code,
    typeCode: card.type_code,
    linkedTypeCode: card.linked_card?.type_code,
    text: card.text,
    stage: parseStage(card.stage),
    cardSetCode: card.card_set_code,
  }
}

function normalizeIdentityCard(card: MarvelCard, prefix: string, index: number): CardState {
  const linkedCard = card.linked_card
  const identityFaces = [card, linkedCard].filter((entry): entry is MarvelCard => Boolean(entry))
  const alterEgoFace = identityFaces.find((entry) => entry.type_code === 'alter_ego')
  const heroFace = identityFaces.find((entry) => entry.type_code === 'hero')
  const frontFace = alterEgoFace ?? card
  const backFace = heroFace && heroFace.code !== frontFace.code ? heroFace : linkedCard

  return {
    id: `${prefix}-${index + 1}`,
    location: 'deck',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    faceUp: false,
    artworkUrl: getArtworkUrl(frontFace, 'front'),
    backArtworkUrl: backFace ? getArtworkUrl(backFace, 'front') : undefined,
    name: frontFace.name,
    code: frontFace.code,
    typeCode: frontFace.type_code,
    linkedTypeCode: backFace?.type_code,
    isIdentity: true,
    text: frontFace.text,
    stage: parseStage(frontFace.stage),
    cardSetCode: frontFace.card_set_code,
  }
}

function hasPermanentKeyword(card: CardState): boolean {
  return Boolean(card.text && /permanent/i.test(card.text))
}

function sortStackWithLowestStageOnTop(cards: CardState[]): CardState[] {
  return [...cards].sort((left, right) => (right.stage ?? 0) - (left.stage ?? 0))
}

async function buildHeroSetup(
  hero: HeroDeckReference,
): Promise<{ heroCards: CardState[]; heroCard: MarvelCard }> {
  const decklist = await fetchDecklist(hero.deckId)
  const uniqueCodes = [decklist.hero_code, ...Object.keys(decklist.slots)]
  const uniqueCardPromises = uniqueCodes.map((cardCode) => fetchCard(cardCode))
  const fetchedCards = await Promise.all(uniqueCardPromises)
  const cardsByCode = new Map(fetchedCards.map((card) => [card.code, card]))

  const heroCard = cardsByCode.get(decklist.hero_code)
  if (!heroCard) {
    throw new Error(`Hero card ${decklist.hero_code} was not found in deck ${decklist.name}.`)
  }

  const expandedCards: MarvelCard[] = [cloneCard(heroCard)]

  for (const [cardCode, quantity] of Object.entries(decklist.slots)) {
    const card = cardsByCode.get(cardCode)
    if (!card) {
      throw new Error(`Card ${cardCode} was not found in deck ${decklist.name}.`)
    }
    for (let index = 0; index < quantity; index += 1) {
      expandedCards.push(cloneCard(card))
    }
  }

  return {
    heroCards: expandedCards.map((card, index) => (
      index === 0
        ? normalizeIdentityCard(card, 'hero-card', index)
        : normalizeCard(card, 'hero-card', index)
    )),
    heroCard,
  }
}

function filterCardSet(cards: MarvelCard[], cardSet: CardSetReference): MarvelCard[] {
  return cards.filter((card) => card.card_set_code === cardSet.card_set_code && hasFrontArtwork(card))
}

async function buildEncounterDeck(
  villain: CardSetReference,
  modular: CardSetReference,
  difficulty: CardSetReference,
): Promise<CardState[]> {
  const packCodes = new Set<string>([
    villain.pack_code,
    modular.pack_code,
    'core',
    difficulty.name === 'Expert' ? difficulty.pack_code : '',
  ].filter(Boolean))

  const packEntries = await Promise.all(
    [...packCodes].map(async (packCode) => [packCode, await fetchPackCards(packCode)] as const),
  )
  const cardsByPack = new Map(packEntries)

  const standardSet: CardSetReference = {
    name: 'Standard',
    pack_code: 'core',
    card_set_code: 'standard',
  }

  const encounterCards = [
    ...filterCardSet(cardsByPack.get(villain.pack_code) ?? [], villain),
    ...filterCardSet(cardsByPack.get(modular.pack_code) ?? [], modular),
    ...filterCardSet(cardsByPack.get(standardSet.pack_code) ?? [], standardSet),
  ]

  if (difficulty.card_set_code === 'expert') {
    encounterCards.push(...filterCardSet(cardsByPack.get(difficulty.pack_code) ?? [], difficulty))
  }

  return encounterCards.map((card, index) => normalizeCard(card, 'encounter-card', index))
}

async function buildNemesisDeck(heroCard: MarvelCard): Promise<CardState[]> {
  if (!heroCard.pack_code || !heroCard.card_set_code) {
    throw new Error(`Hero card ${heroCard.code} is missing pack or set information for nemesis lookup.`)
  }

  const nemesisSetCode = `${heroCard.card_set_code}_nemesis`
  const packCards = await fetchPackCards(heroCard.pack_code)
  const nemesisCards = packCards.filter((card) => card.card_set_code === nemesisSetCode)
    .filter(hasFrontArtwork)

  if (nemesisCards.length === 0) {
    throw new Error(`No nemesis set found for ${heroCard.name} using card_set_code ${nemesisSetCode}.`)
  }

  return nemesisCards.map((card, index) => normalizeCard(card, 'nemesis-card', index))
}

export async function prepareGameSetup(selection: GameSetupSelection): Promise<PreparedGameSetup> {
  const [{ heroCards, heroCard }, encounterCards] = await Promise.all([
    buildHeroSetup(selection.hero),
    buildEncounterDeck(selection.villain, selection.modular, selection.difficulty),
  ])
  const nemesisCards = await buildNemesisDeck(heroCard)
  const playerAreaCards = heroCards
    .filter((card) => card.isIdentity || hasPermanentKeyword(card))
  const playerAreaIds = new Set(playerAreaCards.map((card) => card.id))
  const playerDeckCards = heroCards.filter((card) => !playerAreaIds.has(card.id))

  const villainStages = selection.villainMode === 'hard' ? new Set([2, 3]) : new Set([1, 2])
  const villainStackCards = sortStackWithLowestStageOnTop(
    encounterCards.filter((card) => card.typeCode === 'villain' && villainStages.has(card.stage ?? -1)),
  )
  const mainSchemeStackCards = sortStackWithLowestStageOnTop(
    encounterCards.filter((card) => card.typeCode === 'main_scheme'),
  )
  const villainAreaCards = encounterCards.filter((card) => (
    card.cardSetCode === selection.villain.card_set_code && hasPermanentKeyword(card)
  ))

  const placedEncounterIds = new Set([
    ...villainStackCards.map((card) => card.id),
    ...mainSchemeStackCards.map((card) => card.id),
    ...villainAreaCards.map((card) => card.id),
  ])
  const villainDeckCards = encounterCards.filter((card) => !placedEncounterIds.has(card.id))

  return {
    playerDeckCards,
    playerAreaCards,
    villainDeckCards,
    villainAreaCards,
    villainStackCards,
    mainSchemeStackCards,
    nemesisDeckCards: nemesisCards,
    selection: {
      heroName: selection.hero.name,
      villainName: selection.villain.name,
      modularName: selection.modular.name,
      difficultyName: selection.difficulty.name,
      villainMode: selection.villainMode,
    },
  }
}
