import { useEffect, useEffectEvent } from 'react'
import { executeFlipShortcut, executeStackShortcut, executeTapShortcut } from '../utils/selectionActions'
import { useGameStore } from '../store'
import { getCardBackUrl } from '../services/marvelCdb'
import { BOARD_SHORTCUTS, COUNTER_SHORTCUT_KEYS, STATUS_SHORTCUT_KEYS } from '../config/shortcuts'

type BoardShortcutsProps = {
  disabled?: boolean
}

type ShortcutDefinition = {
  key: string
  execute: () => void
}

const SHORTCUTS: ShortcutDefinition[] = [
  { key: BOARD_SHORTCUTS[0].key.toLowerCase(), execute: executeFlipShortcut },
  { key: BOARD_SHORTCUTS[1].key.toLowerCase(), execute: executeTapShortcut },
  { key: BOARD_SHORTCUTS[2].key.toLowerCase(), execute: executeStackShortcut },
]

function hasVisibleGameplayFace(card: NonNullable<ReturnType<typeof useGameStore.getState>['cards'][number]>) {
  return card.faceUp || (
    Boolean(card.backArtworkUrl)
    && card.backArtworkUrl !== getCardBackUrl(card.typeCode)
  )
}

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return Boolean(target.closest('input, textarea, select, button, [role="button"], [contenteditable="true"]'))
}

export function BoardShortcuts({ disabled = false }: BoardShortcutsProps) {
  const executeHoveredCardShortcut = useEffectEvent((key: string) => {
    const store = useGameStore.getState()
    const hoveredCardId = store.hoveredCardId
    const hoveredCardZone = store.hoveredCardZone
    if (!hoveredCardId || !hoveredCardZone) {
      return false
    }

    const card = store.cards.find((entry) => entry.id === hoveredCardId)
    if (!card || !hasVisibleGameplayFace(card)) {
      return false
    }

    const isVisibleTableCard = card.location === 'table'
    const isVisibleTopOfDeck = card.location === 'deck' && store.decks.some((deck) => (
      deck.cardIds[deck.cardIds.length - 1] === card.id
    ))
    if (!isVisibleTableCard && !isVisibleTopOfDeck) {
      return false
    }

    const counterKey = COUNTER_SHORTCUT_KEYS[key]
    if (counterKey) {
      const delta = hoveredCardZone === 'top' ? 1 : -1
      store.adjustCardCounter(hoveredCardId, counterKey, delta)
      return true
    }

    const statusKey = STATUS_SHORTCUT_KEYS[key]
    if (statusKey) {
      store.toggleCardStatus(hoveredCardId, statusKey)
      return true
    }

    return false
  })

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (disabled || event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    if (isInteractiveElement(event.target) || isInteractiveElement(document.activeElement)) {
      return
    }

    const key = event.key.toLowerCase()

    if (executeHoveredCardShortcut(key)) {
      event.preventDefault()
      return
    }

    const shortcut = SHORTCUTS.find((entry) => entry.key === key)
    if (!shortcut) return

    event.preventDefault()
    shortcut.execute()
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => onKeyDown(event)

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return null
}
