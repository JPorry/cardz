import { useEffect, useMemo, useState } from 'react'
import { HERO_DECKS } from '../config/gameSetup/heroes'
import { VILLAIN_SETS } from '../config/gameSetup/villains'
import { MODULAR_SETS } from '../config/gameSetup/modulars'
import { DIFFICULTY_SETS } from '../config/gameSetup/difficulties'
import { prepareGameSetup } from '../services/gameSetup'
import { useGameStore } from '../store'
import { clearStoredGameSession } from '../sessionPersistence'

interface NewGameModalProps {
  isOpen: boolean
  onClose: () => void
}

export function NewGameModal({ isOpen, onClose }: NewGameModalProps) {
  const replaceBoardWithDecks = useGameStore((state) => state.replaceBoardWithDecks)
  const [heroDeckId, setHeroDeckId] = useState(HERO_DECKS[0]?.deckId ?? 0)
  const [villainCode, setVillainCode] = useState(VILLAIN_SETS[0]?.card_set_code ?? '')
  const [modularCode, setModularCode] = useState(MODULAR_SETS[0]?.card_set_code ?? '')
  const [difficultyCode, setDifficultyCode] = useState(DIFFICULTY_SETS[0]?.card_set_code ?? '')
  const [villainInHardMode, setVillainInHardMode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedHero = useMemo(
    () => HERO_DECKS.find((hero) => hero.deckId === heroDeckId) ?? HERO_DECKS[0],
    [heroDeckId],
  )
  const selectedVillain = useMemo(
    () => VILLAIN_SETS.find((villain) => villain.card_set_code === villainCode) ?? VILLAIN_SETS[0],
    [villainCode],
  )
  const selectedModular = useMemo(
    () => MODULAR_SETS.find((modular) => modular.card_set_code === modularCode) ?? MODULAR_SETS[0],
    [modularCode],
  )
  const selectedDifficulty = useMemo(
    () => DIFFICULTY_SETS.find((difficulty) => difficulty.card_set_code === difficultyCode) ?? DIFFICULTY_SETS[0],
    [difficultyCode],
  )

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

  if (!isOpen || !selectedHero || !selectedVillain || !selectedModular || !selectedDifficulty) {
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

    try {
      const result = await prepareGameSetup({
        hero: selectedHero,
        villain: selectedVillain,
        modular: selectedModular,
        difficulty: selectedDifficulty,
        villainMode: villainInHardMode ? 'hard' : 'standard',
      })
      clearStoredGameSession()
      replaceBoardWithDecks(result)
      onClose()
    } catch (error) {
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
            <span className="new-game-modal__eyebrow">Setup</span>
            <h2 id="new-game-title" className="new-game-modal__title">Start New Game</h2>
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
            <span>Hero deck</span>
            <select value={heroDeckId} onChange={(event) => setHeroDeckId(Number(event.target.value))} disabled={isSubmitting}>
              {HERO_DECKS.map((hero) => (
                <option key={hero.deckId} value={hero.deckId}>{hero.name}</option>
              ))}
            </select>
          </label>

          <label className="new-game-modal__field">
            <span>Villain set</span>
            <select value={villainCode} onChange={(event) => setVillainCode(event.target.value)} disabled={isSubmitting}>
              {VILLAIN_SETS.map((villain) => (
                <option key={villain.card_set_code} value={villain.card_set_code}>{villain.name}</option>
              ))}
            </select>
          </label>

          <label className="new-game-modal__field">
            <span>Modular set</span>
            <select value={modularCode} onChange={(event) => setModularCode(event.target.value)} disabled={isSubmitting}>
              {MODULAR_SETS.map((modular) => (
                <option key={modular.card_set_code} value={modular.card_set_code}>{modular.name}</option>
              ))}
            </select>
          </label>

          <label className="new-game-modal__field">
            <span>Difficulty</span>
            <select value={difficultyCode} onChange={(event) => setDifficultyCode(event.target.value)} disabled={isSubmitting}>
              {DIFFICULTY_SETS.map((difficulty) => (
                <option key={difficulty.card_set_code} value={difficulty.card_set_code}>{difficulty.name}</option>
              ))}
            </select>
          </label>

          <label className="new-game-modal__toggle">
            <input
              type="checkbox"
              checked={villainInHardMode}
              onChange={(event) => setVillainInHardMode(event.target.checked)}
              disabled={isSubmitting}
            />
            <span className="new-game-modal__toggle-copy">
              <strong>Villain hard mode</strong>
              <small>Use villain stages 2 and 3 for setup.</small>
            </span>
          </label>

          {errorMessage ? <p className="new-game-modal__error">{errorMessage}</p> : null}
        </div>

        <div className="new-game-modal__footer">
          <button type="button" className="new-game-modal__secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="button" className="new-game-modal__primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Loading...' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  )
}
