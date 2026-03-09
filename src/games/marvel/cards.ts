import type { CardState } from '../../store'
import { getCardBackUrl } from '../../services/marvelCdb'
import type { GameCardPresentation, GameCardSemantics } from '../types'

export const marvelCardSemantics: GameCardSemantics = {
  counters: [
    { key: 'damage', label: 'Health', shortLabel: 'DMG', color: '#e53935', shortcutKey: '1', shortcutDetail: 'Add or remove damage.' },
    { key: 'acceleration', label: 'Acceleration', shortLabel: 'ACC', color: '#fb8c00', shortcutKey: '2', shortcutDetail: 'Add or remove acceleration.' },
    { key: 'threat', label: 'Threat', shortLabel: 'THR', color: '#1e88e5', shortcutKey: '3', shortcutDetail: 'Add or remove threat.' },
    { key: 'allPurpose', label: 'All Purpose', shortLabel: 'ALL', color: '#43a047', shortcutKey: '4', shortcutDetail: 'Add or remove generic counters.' },
  ],
  statuses: [
    { key: 'stunned', label: 'Stunned', shortLabel: 'STUN', color: '#d81b60', shortcutKey: '5', shortcutDetail: 'Toggle stunned.' },
    { key: 'confused', label: 'Confused', shortLabel: 'CONF', color: '#5e35b1', shortcutKey: '6', shortcutDetail: 'Toggle confused.' },
    { key: 'tough', label: 'Tough', shortLabel: 'TOUGH', color: '#2e7d32', shortcutKey: '7', shortcutDetail: 'Toggle tough.' },
  ],
}

export const marvelCardPresentation: GameCardPresentation = {
  getDefaultCardBackUrl: getCardBackUrl,
  hasVisibleGameplayFace(card: CardState) {
    return card.faceUp || (
      Boolean(card.backArtworkUrl)
      && card.backArtworkUrl !== getCardBackUrl(card.typeCode)
    )
  },
}
