export interface MarvelCard {
  code: string;
  name: string;
  imagesrc?: string;
  pack_code: string;
  type_code: string;
  card_set_code?: string;
  text?: string;
  stage?: number | string | null;
  linked_card?: MarvelCard;
  double_sided?: boolean;
}

const API_BASE_URL = 'https://marvelcdb.com/api/public';

export async function fetchAllCards(): Promise<MarvelCard[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/cards/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch cards: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching Marvel cards:', error);
    return [];
  }
}

function getCerebroCode(card: MarvelCard, face: 'front' | 'back' = 'front'): string {
  if (/[a-z]$/.test(card.code)) {
    return card.code.replace(/[a-z]$/, (match) => match.toUpperCase());
  }

  if (card.double_sided) {
    return `${card.code}${face === 'front' ? 'A' : 'B'}`;
  }

  return card.code;
}

export function getArtworkUrl(card: MarvelCard, face: 'front' | 'back' = 'front'): string {
  const isIdentityCard = card.type_code === 'hero' || card.type_code === 'alter_ego'
  const imagePath = face === 'front' ? card.imagesrc : card.linked_card?.imagesrc
  if (isIdentityCard && imagePath) {
    return `https://images.weserv.nl/?url=https://marvelcdb.com${imagePath}`
  }

  const code = getCerebroCode(card, face);
  // Use weserv.nl as an image proxy to bypass CORS
  return `https://images.weserv.nl/?url=https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/${code}.jpg`;
}

export function getCardBackUrl(typeCode?: string): string {
  let backImage = 'PlayerBack.jpg'; // Default back
  
  if (typeCode === 'upgrade') {
    backImage = 'HeroBack.jpg';
  } else if (typeCode === 'villain') {
    backImage = 'VillainBack.jpg';
  } else if (typeCode === 'treachery') {
    backImage = 'EncounterBack.jpg';
  } else if (typeCode === 'hero' || typeCode === 'alter_ego' || typeCode === 'ally' || typeCode === 'event' || typeCode === 'resource' || typeCode === 'support') {
    // Other player cards should probably also use HeroBack
    backImage = 'HeroBack.jpg';
  } else if (typeCode === 'main_scheme' || typeCode === 'side_scheme' || typeCode === 'minion' || typeCode === 'attachment' || typeCode === 'environment') {
    // Other encounter cards
    backImage = 'EncounterBack.jpg';
  } else {
    // If we only stick strictly to user specified or a sensible default
    backImage = 'HeroBack.jpg';
  }

  return `https://images.weserv.nl/?url=https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/${backImage}`;
}

export async function getRandomCards(count: number): Promise<MarvelCard[]> {
  const allCards = await fetchAllCards();
  if (allCards.length === 0) return [];

  // Filter for cards that are likely to have artwork (e.g., not encounter cards if we want hero ones)
  // For now, let's just take any random cards as requested
  
  const shuffled = [...allCards].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
