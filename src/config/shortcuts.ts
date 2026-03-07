import type { CardCounterKey, CardStatusKey } from '../utils/cardMetadata'

export type ShortcutReferenceItem = {
  key: string
  label: string
  detail: string
}

export const BOARD_SHORTCUTS: ShortcutReferenceItem[] = [
  {
    key: 'F',
    label: 'Flip hovered or selected cards',
    detail: 'Acts on the hovered card first. If nothing is hovered, it flips the current selection or dragged stack.',
  },
  {
    key: 'T',
    label: 'Tap hovered or selected cards',
    detail: 'Acts on the hovered card first. If nothing is hovered, it taps the current selection, deck, or dragged stack.',
  },
  {
    key: 'S',
    label: 'Stack or combine selection',
    detail: 'Stacks multiple selected cards, or combines a mixed card and deck selection into a single stack.',
  },
]

export const HOVERED_CARD_COUNTER_SHORTCUTS: ShortcutReferenceItem[] = [
  { key: '1', label: 'Add or remove damage', detail: 'Use the top half of a hovered card to add damage and the bottom half to remove it.' },
  { key: '2', label: 'Add or remove acceleration', detail: 'Use the top half of a hovered card to add acceleration and the bottom half to remove it.' },
  { key: '3', label: 'Add or remove threat', detail: 'Use the top half of a hovered card to add threat and the bottom half to remove it.' },
  { key: '4', label: 'Add or remove generic counters', detail: 'Use the top half of a hovered card to add a counter and the bottom half to remove it.' },
]

export const HOVERED_CARD_STATUS_SHORTCUTS: ShortcutReferenceItem[] = [
  { key: '5', label: 'Toggle stunned', detail: 'Applies or removes the stunned status on the hovered visible card.' },
  { key: '6', label: 'Toggle confused', detail: 'Applies or removes the confused status on the hovered visible card.' },
  { key: '7', label: 'Toggle tough', detail: 'Applies or removes the tough status on the hovered visible card.' },
]

export const COUNTER_SHORTCUT_KEYS: Record<string, CardCounterKey> = {
  '1': 'damage',
  '2': 'acceleration',
  '3': 'threat',
  '4': 'allPurpose',
}

export const STATUS_SHORTCUT_KEYS: Record<string, CardStatusKey> = {
  '5': 'stunned',
  '6': 'confused',
  '7': 'tough',
}
