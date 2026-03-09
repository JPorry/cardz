import type { GameDefinition } from '../types'

const board = [
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
] satisfies GameDefinition['shortcuts']['board']

export const marvelShortcuts: GameDefinition['shortcuts'] = {
  board,
  sections: [
    {
      eyebrow: 'Board',
      title: 'Board actions',
      items: board,
    },
    {
      eyebrow: 'Counters',
      title: 'Hovered card counters',
      items: [
        { key: '1', label: 'Add or remove damage', detail: 'Use the top half of a hovered card to add damage and the bottom half to remove it.' },
        { key: '2', label: 'Add or remove acceleration', detail: 'Use the top half of a hovered card to add acceleration and the bottom half to remove it.' },
        { key: '3', label: 'Add or remove threat', detail: 'Use the top half of a hovered card to add threat and the bottom half to remove it.' },
        { key: '4', label: 'Add or remove generic counters', detail: 'Use the top half of a hovered card to add a counter and the bottom half to remove it.' },
      ],
    },
    {
      eyebrow: 'Statuses',
      title: 'Hovered card statuses',
      items: [
        { key: '5', label: 'Toggle stunned', detail: 'Applies or removes the stunned status on the hovered visible card.' },
        { key: '6', label: 'Toggle confused', detail: 'Applies or removes the confused status on the hovered visible card.' },
        { key: '7', label: 'Toggle tough', detail: 'Applies or removes the tough status on the hovered visible card.' },
      ],
    },
  ],
  counterShortcutKeys: {
    '1': 'damage',
    '2': 'acceleration',
    '3': 'threat',
    '4': 'allPurpose',
  },
  statusShortcutKeys: {
    '5': 'stunned',
    '6': 'confused',
    '7': 'tough',
  },
}
