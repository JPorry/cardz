import { useEffect, type PointerEvent as ReactPointerEvent } from 'react'
import { useGameStore } from '../store'
import { getGameDefinition } from '../games/registry'
import type { GameShortcutDefinition } from '../games/types'

type KeyboardShortcutsModalProps = {
  isOpen: boolean
  onClose: () => void
}

function ShortcutSection({ title, eyebrow, items }: { title: string, eyebrow: string, items: GameShortcutDefinition[] }) {
  return (
    <section className="keyboard-shortcuts__section" aria-labelledby={`${eyebrow}-title`}>
      <div className="keyboard-shortcuts__section-header">
        <span className="keyboard-shortcuts__section-eyebrow">{eyebrow}</span>
        <h3 id={`${eyebrow}-title`} className="keyboard-shortcuts__section-title">{title}</h3>
      </div>

      <div className="keyboard-shortcuts__list">
        {items.map((item) => (
          <div key={`${eyebrow}-${item.key}`} className="keyboard-shortcuts__item">
            <kbd className="keyboard-shortcuts__key">{item.key}</kbd>
            <div className="keyboard-shortcuts__copy">
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const activeGameId = useGameStore((state) => state.activeGameId)
  const activeGame = getGameDefinition(activeGameId)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const handleBackdropPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal-backdrop keyboard-shortcuts-backdrop" role="presentation" onPointerDown={handleBackdropPointerDown}>
      <div
        className="keyboard-shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
      >
        <div className="keyboard-shortcuts-modal__header">
          <div>
            <span className="keyboard-shortcuts-modal__eyebrow">Reference</span>
            <h2 id="keyboard-shortcuts-title" className="keyboard-shortcuts-modal__title">{activeGame.ui.keyboardShortcutsTitle}</h2>
          </div>
          <button
            type="button"
            className="keyboard-shortcuts-modal__close"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            ×
          </button>
        </div>

        <div className="keyboard-shortcuts-modal__body">
          <p className="keyboard-shortcuts-modal__intro">
            {activeGame.ui.keyboardShortcutsIntro}
          </p>
          {activeGame.shortcuts.sections.map((section) => (
            <ShortcutSection key={section.eyebrow} eyebrow={section.eyebrow} title={section.title} items={section.items} />
          ))}
        </div>
      </div>
    </div>
  )
}
