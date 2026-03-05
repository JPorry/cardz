export interface MarvelCard {
  code: string;
  name: string;
  imagesrc?: string;
  pack_code: string;
  type_code: string;
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

export function getArtworkUrl(card: MarvelCard): string {
  let url = '';
  if (card.imagesrc) {
    url = `marvelcdb.com${card.imagesrc}`;
  } else {
    url = `marvelcdb.com/bundles/cards/${card.code}.png`;
  }
  // Use weserv.nl as an image proxy to bypass CORS
  return `https://images.weserv.nl/?url=${url}`;
}

export async function getRandomCards(count: number): Promise<MarvelCard[]> {
  const allCards = await fetchAllCards();
  if (allCards.length === 0) return [];

  // Filter for cards that are likely to have artwork (e.g., not encounter cards if we want hero ones)
  // For now, let's just take any random cards as requested
  
  const shuffled = [...allCards].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
