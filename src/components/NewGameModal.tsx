import { useEffect, useState } from 'react'
import { getGameDefinition, getRegisteredGames } from '../games/registry'
import { useGameStore } from '../store'
import { clearStoredGameSession } from '../sessionPersistence'

interface NewGameModalProps {
  isOpen: boolean
  onClose: () => void
}

export function NewGameModal({ isOpen, onClose }: NewGameModalProps) {
  const activeGameId = useGameStore((state) => state.activeGameId)
  const setActiveGame = useGameStore((state) => state.setActiveGame)
  const gameSetupState = useGameStore((state) => state.gameSetupState)
  const replaceBoardWithDecks = useGameStore((state) => state.replaceBoardWithDecks)
  const beginBoardLoad = useGameStore((state) => state.beginBoardLoad)
  const finishBoardLoad = useGameStore((state) => state.finishBoardLoad)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const games = getRegisteredGames()
  const activeGame = getGameDefinition(activeGameId)
  const SetupRenderer = activeGame.setup.Renderer

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null)
      setIsSubmitting(false)
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) {
    return null
  }

  const handleBackdropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !isSubmitting) {
      onClose()
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)
    beginBoardLoad(activeGame.ui.preparingNewGameLabel)

    try {
      const result = await activeGame.setup.prepare(gameSetupState)
      clearStoredGameSession()
      replaceBoardWithDecks(result)
      onClose()
    } catch (error) {
      finishBoardLoad()
      const message = error instanceof Error ? error.message : 'Failed to prepare the selected game.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onPointerDown={handleBackdropPointerDown}>
      <div
        className="new-game-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-game-title"
      >
        <div className="new-game-modal__header">
          <div>
            <span className="new-game-modal__eyebrow">{activeGame.ui.newGameEyebrow}</span>
            <h2 id="new-game-title" className="new-game-modal__title">{activeGame.ui.newGameTitle}</h2>
          </div>
          <button
            type="button"
            className="new-game-modal__close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close new game setup"
          >
            ×
          </button>
        </div>

        <div className="new-game-modal__body">
          <label className="new-game-modal__field">
            <span>Game</span>
            <select
              value={activeGameId}
              onChange={(event) => {
                setErrorMessage(null)
                setActiveGame(event.target.value)
              }}
              disabled={isSubmitting}
            >
              {games.map((game) => (
                <option key={game.id} value={game.id}>{game.name}</option>
              ))}
            </select>
          </label>

          <SetupRenderer disabled={isSubmitting} onErrorMessageChange={setErrorMessage} />

          {errorMessage ? (
            <p className="new-game-modal__status new-game-modal__status--error">{errorMessage}</p>
          ) : null}
        </div>

        <div className="new-game-modal__footer">
          <button type="button" className="new-game-modal__button new-game-modal__button--ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="button" className="new-game-modal__button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Starting...' : activeGame.ui.newGameButtonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
