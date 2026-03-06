import { useEffect, useEffectEvent } from 'react'
import { executeFlipShortcut, executeStackShortcut, executeTapShortcut } from '../utils/selectionActions'

type BoardShortcutsProps = {
  disabled?: boolean
}

type ShortcutDefinition = {
  key: string
  execute: () => void
}

const SHORTCUTS: ShortcutDefinition[] = [
  { key: 'f', execute: executeFlipShortcut },
  { key: 't', execute: executeTapShortcut },
  { key: 's', execute: executeStackShortcut },
]

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return Boolean(target.closest('input, textarea, select, button, [role="button"], [contenteditable="true"]'))
}

export function BoardShortcuts({ disabled = false }: BoardShortcutsProps) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (disabled || event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    if (isInteractiveElement(event.target) || isInteractiveElement(document.activeElement)) {
      return
    }

    const shortcut = SHORTCUTS.find((entry) => entry.key === event.key.toLowerCase())
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
