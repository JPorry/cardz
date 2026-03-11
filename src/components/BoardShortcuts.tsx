import { useEffect, useEffectEvent } from 'react'
import { executeFlipShortcut, executeStackShortcut, executeTapShortcut } from '../utils/selectionActions'
import { canModifyCardMetadata, useGameStore } from '../store'
import { getGameDefinition } from '../games/registry'

type BoardShortcutsProps = {
  disabled?: boolean
}

type ShortcutDefinition = {
  key: string
  execute: () => void
}

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return Boolean(target.closest('input, textarea, select, button, [role="button"], [contenteditable="true"]'))
}

export function BoardShortcuts({ disabled = false }: BoardShortcutsProps) {
  const executeHoveredCardShortcut = useEffectEvent((key: string) => {
    const store = useGameStore.getState()
    const game = getGameDefinition(store.activeGameId)
    const hoveredCardId = store.hoveredCardId
    const hoveredCardZone = store.hoveredCardZone
    if (!hoveredCardId || !hoveredCardZone) {
      return false
    }

    const card = store.cards.find((entry) => entry.id === hoveredCardId)
    if (!card || !game.cardPresentation.hasVisibleGameplayFace(card)) {
      return false
    }

    const isTable = card.location === 'table'
    const isSequence = card.location === 'deck' && store.decks.find((d) => d.cardIds.includes(card.id))?.kind === 'sequence'

    if (!canModifyCardMetadata(card, store.decks) || (!isTable && !isSequence)) {
      return false
    }

    const counterKey = game.shortcuts.counterShortcutKeys[key]
    if (counterKey) {
      const delta = hoveredCardZone === 'top' ? 1 : -1
      store.adjustCardCounter(hoveredCardId, counterKey, delta)
      return true
    }

    const statusKey = game.shortcuts.statusShortcutKeys[key]
    if (statusKey) {
      store.toggleCardStatus(hoveredCardId, statusKey)
      return true
    }

    return false
  })

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const game = getGameDefinition(useGameStore.getState().activeGameId)
    const shortcuts: ShortcutDefinition[] = [
      { key: game.shortcuts.board[0]?.key.toLowerCase() ?? 'f', execute: executeFlipShortcut },
      { key: game.shortcuts.board[1]?.key.toLowerCase() ?? 't', execute: executeTapShortcut },
      { key: game.shortcuts.board[2]?.key.toLowerCase() ?? 's', execute: executeStackShortcut },
    ]
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

    const shortcut = shortcuts.find((entry) => entry.key === key)
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
