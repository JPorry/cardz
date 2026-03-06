import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useGameStore } from '../store'
import { getCardBackUrl } from '../services/marvelCdb'

type DragState = {
  cardId: string
}

export function ExamineStackModal() {
  const examinedStack = useGameStore((state) => state.examinedStack)
  const cards = useGameStore((state) => state.cards)
  const decks = useGameStore((state) => state.decks)
  const reorderExaminedStack = useGameStore((state) => state.reorderExaminedStack)
  const closeExaminedStackAndKeepOrder = useGameStore((state) => state.closeExaminedStackAndKeepOrder)
  const closeExaminedStackAndShuffle = useGameStore((state) => state.closeExaminedStackAndShuffle)
  const setExaminedStackPendingClosePrompt = useGameStore((state) => state.setExaminedStackPendingClosePrompt)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const currentOrderRef = useRef<string[]>([])

  useEffect(() => {
    currentOrderRef.current = examinedStack?.cardOrder ?? []
  }, [examinedStack])

  useEffect(() => {
    if (!examinedStack) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setExaminedStackPendingClosePrompt(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [examinedStack, setExaminedStackPendingClosePrompt])

  useEffect(() => {
    if (!dragState || !examinedStack) return

    const handlePointerMove = (event: PointerEvent) => {
      const cardId = dragState.cardId
      const panelBounds = panelRef.current?.getBoundingClientRect()
      if (!panelBounds) return
      if (
        event.clientX < panelBounds.left
        || event.clientX > panelBounds.right
        || event.clientY < panelBounds.top
        || event.clientY > panelBounds.bottom
      ) {
        return
      }

      const hoveredElement = document.elementFromPoint(event.clientX, event.clientY)
      const hoveredCardElement = hoveredElement instanceof HTMLElement
        ? hoveredElement.closest<HTMLElement>('[data-examine-card-id]')
        : null
      const hoveredCardId = hoveredCardElement?.dataset.examineCardId
      if (!hoveredCardId || hoveredCardId === cardId) return

      const currentOrder = currentOrderRef.current
      const fromIndex = currentOrder.indexOf(cardId)
      const toIndex = currentOrder.indexOf(hoveredCardId)
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
      reorderExaminedStack(fromIndex, toIndex)
    }

    const handlePointerUp = () => {
      setDragState(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragState, examinedStack, reorderExaminedStack])

  if (!examinedStack) return null

  const deck = decks.find((entry) => entry.id === examinedStack.deckId)
  if (!deck && examinedStack.cardOrder.length === 0) return null

  const orderedCards = examinedStack.cardOrder
    .map((cardId) => cards.find((entry) => entry.id === cardId))
    .filter((card): card is NonNullable<typeof card> => Boolean(card))

  const handleBackdropPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    setExaminedStackPendingClosePrompt(true)
  }

  return (
    <div className="modal-backdrop examine-stack-backdrop" role="presentation" onPointerDown={handleBackdropPointerDown}>
      <div
        ref={panelRef}
        className="examine-stack-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="examine-stack-title"
      >
        <div className="examine-stack-modal__header">
          <div>
            <span className="examine-stack-modal__eyebrow">Stack</span>
            <h2 id="examine-stack-title" className="examine-stack-modal__title">Examine Stack</h2>
          </div>
          <button
            type="button"
            className="examine-stack-modal__close"
            onClick={() => setExaminedStackPendingClosePrompt(true)}
            aria-label="Close examine stack"
          >
            ×
          </button>
        </div>

        <div className="examine-stack-modal__actions" aria-label="Stack actions">
          <div className="examine-stack-modal__actions-copy">
            <strong>{orderedCards.length} cards</strong>
            <span>Drag within the grid to reorder cards before closing.</span>
          </div>
          <div className="examine-stack-modal__action-buttons">
            <button type="button" className="examine-stack-modal__secondary" onClick={closeExaminedStackAndKeepOrder}>
              Close and keep order
            </button>
            <button type="button" className="examine-stack-modal__primary" onClick={closeExaminedStackAndShuffle}>
              Close and shuffle
            </button>
          </div>
        </div>

        <div className="examine-stack-modal__grid" role="list" aria-label="Cards in stack order">
          {orderedCards.map((card) => {
            const artworkUrl = card.artworkUrl ?? card.backArtworkUrl ?? getCardBackUrl(card.typeCode)
            const isDragging = dragState?.cardId === card.id

            return (
              <button
                key={card.id}
                type="button"
                role="listitem"
                className={`examine-stack-card${isDragging ? ' examine-stack-card--dragging' : ''}`}
                data-examine-card-id={card.id}
                onPointerDown={() => setDragState({ cardId: card.id })}
              >
                <div className="examine-stack-card__index">{examinedStack.cardOrder.indexOf(card.id) + 1}</div>
                {artworkUrl ? (
                  <img
                    className="examine-stack-card__image"
                    src={artworkUrl}
                    alt={card.name ?? 'Card'}
                    draggable={false}
                  />
                ) : (
                  <div className="examine-stack-card__fallback">{card.name ?? 'Card'}</div>
                )}
                <div className="examine-stack-card__label">{card.name ?? 'Unknown card'}</div>
              </button>
            )
          })}
        </div>

        {examinedStack.pendingClosePrompt ? (
          <div className="examine-stack-dialog-backdrop" role="presentation">
            <div className="examine-stack-dialog" role="alertdialog" aria-modal="true" aria-labelledby="examine-stack-close-title">
              <h3 id="examine-stack-close-title" className="examine-stack-dialog__title">Close stack view?</h3>
              <p className="examine-stack-dialog__body">
                Choose whether to keep the current order or reshuffle the remaining stack before closing.
              </p>
              <div className="examine-stack-dialog__actions">
                <button
                  type="button"
                  className="examine-stack-modal__ghost"
                  onClick={() => setExaminedStackPendingClosePrompt(false)}
                >
                  Continue examining
                </button>
                <button type="button" className="examine-stack-modal__secondary" onClick={closeExaminedStackAndKeepOrder}>
                  Keep order
                </button>
                <button type="button" className="examine-stack-modal__primary" onClick={closeExaminedStackAndShuffle}>
                  Shuffle
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
