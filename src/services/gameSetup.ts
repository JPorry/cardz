import type { CardState, GameSetupLayout } from '../store'
import { getArtworkUrl, type MarvelCard } from './marvelCdb'
import type { HeroDeckReference } from '../config/gameSetup/heroes'
import type { CardSetReference } from '../config/gameSetup/villains'
import { createDefaultCardMetadata } from '../utils/cardMetadata'

interface DecklistResponse {
  id: number
  name: string
  hero_code: string
  hero_name: string
  slots: Record<string, number>
}

export interface ResolvedHeroDeck {
  deckId: number
  deckName: string
  heroCode: string
  heroName: string
}

export type HeroSelection =
  | {
    source: 'precon'
    hero: HeroDeckReference
  }
  | {
    source: 'custom'
    deck: ResolvedHeroDeck
  }

interface GameSetupSelection {
  hero: HeroSelection
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

export async function resolveDecklist(deckId: number): Promise<ResolvedHeroDeck> {
  if (!Number.isInteger(deckId) || deckId <= 0) {
    throw new Error('Deck ID must be a positive number.')
  }

  const decklist = await fetchDecklist(deckId)
  if (!decklist.hero_code || !decklist.hero_name) {
    throw new Error(`Deck ${decklist.name} is missing hero information.`)
  }

  return {
    deckId: decklist.id,
    deckName: decklist.name,
    heroCode: decklist.hero_code,
    heroName: decklist.hero_name,
  }
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
    ...createDefaultCardMetadata(),
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
    ...createDefaultCardMetadata(),
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

function shuffleCards(cards: CardState[]): CardState[] {
  const nextCards = [...cards]
  for (let index = nextCards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = nextCards[index]
    nextCards[index] = nextCards[swapIndex]
    nextCards[swapIndex] = current
  }
  return nextCards
}

async function buildHeroSetup(
  heroSelection: HeroSelection,
): Promise<{ heroCards: CardState[]; heroCard: MarvelCard; resolvedDeck: ResolvedHeroDeck }> {
  const resolvedDeck = heroSelection.source === 'precon'
    ? await resolveDecklist(heroSelection.hero.deckId)
    : heroSelection.deck
  const decklist = await fetchDecklist(resolvedDeck.deckId)
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
    resolvedDeck,
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

async function buildHeroObligations(heroCard: MarvelCard): Promise<CardState[]> {
  if (!heroCard.pack_code || !heroCard.card_set_code) {
    throw new Error(`Hero card ${heroCard.code} is missing pack or set information for obligation lookup.`)
  }

  const packCards = await fetchPackCards(heroCard.pack_code)
  const obligationCards = packCards
    .filter(hasFrontArtwork)
    .filter((card) => card.type_code === 'obligation' && card.card_set_code === heroCard.card_set_code)

  if (obligationCards.length === 0) {
    throw new Error(`No obligation cards found for ${heroCard.name} in pack ${heroCard.pack_code}.`)
  }

  return obligationCards.map((card, index) => normalizeCard(card, 'obligation-card', index))
}

export async function prepareGameSetup(selection: GameSetupSelection): Promise<PreparedGameSetup> {
  const [{ heroCards, heroCard, resolvedDeck }, encounterCards] = await Promise.all([
    buildHeroSetup(selection.hero),
    buildEncounterDeck(selection.villain, selection.modular, selection.difficulty),
  ])
  const [nemesisCards, obligationCards] = await Promise.all([
    buildNemesisDeck(heroCard),
    buildHeroObligations(heroCard),
  ])
  const obligationCodes = new Set(obligationCards.map((card) => card.code))
  const playerPoolCards = heroCards.filter((card) => !obligationCodes.has(card.code))

  const playerAreaCards = playerPoolCards
    .filter((card) => card.isIdentity || hasPermanentKeyword(card))
  const playerAreaIds = new Set(playerAreaCards.map((card) => card.id))
  const playerDeckCards = shuffleCards(playerPoolCards.filter((card) => !playerAreaIds.has(card.id)))

  const currentVillainStage = selection.villainMode === 'hard' ? 2 : 1
  const hiddenVillainStage = selection.villainMode === 'hard' ? 3 : 2
  const villainStageCards = encounterCards.filter((card) => (
    card.typeCode === 'villain'
    && (card.stage === currentVillainStage || card.stage === hiddenVillainStage)
  ))
  const hiddenVillainCard = villainStageCards.find((card) => card.stage === hiddenVillainStage)
  const currentVillainCard = villainStageCards.find((card) => card.stage === currentVillainStage)

  if (!hiddenVillainCard || !currentVillainCard) {
    throw new Error(`Could not find villain setup stages ${hiddenVillainStage} and ${currentVillainStage}.`)
  }

  const discardedVillainStageIds = new Set(
    encounterCards
      .filter((card) => card.typeCode === 'villain' && ![currentVillainStage, hiddenVillainStage].includes(card.stage ?? -1))
      .map((card) => card.id),
  )
  const mainSchemeSequenceCards = [...encounterCards.filter((card) => card.typeCode === 'main_scheme')]
    .sort((left, right) => (left.stage ?? 0) - (right.stage ?? 0))
  const villainPermanentCards = encounterCards.filter((card) => (
    card.cardSetCode === selection.villain.card_set_code && hasPermanentKeyword(card)
  ))
  const villainSequenceCards = [
    { ...currentVillainCard, faceUp: true },
    { ...hiddenVillainCard, faceUp: false },
  ]
  const villainAreaCards = villainPermanentCards.map((card) => ({ ...card, faceUp: true }))

  const placedEncounterIds = new Set([
    hiddenVillainCard.id,
    currentVillainCard.id,
    ...mainSchemeSequenceCards.map((card) => card.id),
    ...villainPermanentCards.map((card) => card.id),
    ...discardedVillainStageIds,
  ])
  const villainDeckPool = encounterCards.filter((card) => !placedEncounterIds.has(card.id))
  villainDeckPool.push(...obligationCards.map((card) => ({ ...card, faceUp: false, location: 'deck' as const })))
  const villainDeckCards = shuffleCards(villainDeckPool)

  return {
    playerDeckCards,
    playerAreaCards,
    villainDeckCards,
    villainSequenceCards,
    villainAreaCards,
    mainSchemeSequenceCards,
    nemesisDeckCards: nemesisCards,
    selection: {
      heroName: resolvedDeck.deckName,
      villainName: selection.villain.name,
      modularName: selection.modular.name,
      difficultyName: selection.difficulty.name,
      villainMode: selection.villainMode,
    },
  }
}
