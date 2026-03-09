import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store'
import { getGameDefinition } from '../games/registry'

const MENU_OPTIONS = [
  { id: 'new-game', label: 'New Game', detail: 'Start a fresh setup' },
  { id: 'export-state', label: 'Export State', detail: 'Download the current game session as JSON' },
  { id: 'load-state', label: 'Load State', detail: 'Restore a saved game session from JSON' },
  { id: 'settings', label: 'Settings', detail: 'Adjust board and interaction options' },
  { id: 'help', label: 'Help', detail: 'Open the quick reference guide' },
]

interface BoardMenuProps {
  onStartNewGame: () => void
  onExportState: () => void
  onLoadState: (file: File) => void | Promise<void>
  onOpenKeyboardShortcuts: () => void
}

export function BoardMenu({ onStartNewGame, onExportState, onLoadState, onOpenKeyboardShortcuts }: BoardMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeGameId = useGameStore((state) => state.activeGameId)
  const activeGame = getGameDefinition(activeGameId)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleOptionClick = (optionId: string) => {
    setIsOpen(false)

    if (optionId === 'new-game') {
      onStartNewGame()
      return
    }

    if (optionId === 'export-state') {
      onExportState()
      return
    }

    if (optionId === 'load-state') {
      fileInputRef.current?.click()
      return
    }

    if (optionId === 'help') {
      onOpenKeyboardShortcuts()
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!file) return
    await onLoadState(file)
  }

  return (
    <div className="board-menu" ref={rootRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        type="button"
        className="board-menu__trigger"
        aria-label="Open board menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="board-menu__trigger-line" />
        <span className="board-menu__trigger-line" />
        <span className="board-menu__trigger-line" />
      </button>

      {isOpen ? (
        <div className="board-menu__panel" role="menu" aria-label="Board actions">
          <div className="board-menu__header">
            <span className="board-menu__eyebrow">{activeGame.ui.menuEyebrow}</span>
            <strong className="board-menu__title">{activeGame.ui.menuTitle}</strong>
          </div>

          <div className="board-menu__options">
            {MENU_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="board-menu__option"
                role="menuitem"
                onClick={() => handleOptionClick(option.id)}
              >
                <span className="board-menu__option-label">{option.label}</span>
                <span className="board-menu__option-detail">{option.detail}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
