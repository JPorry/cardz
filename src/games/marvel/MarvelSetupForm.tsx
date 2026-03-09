import { useRef, useState } from 'react'
import { HERO_DECKS } from '../../config/gameSetup/heroes'
import { VILLAIN_SETS } from '../../config/gameSetup/villains'
import { MODULAR_SETS } from '../../config/gameSetup/modulars'
import { DIFFICULTY_SETS } from '../../config/gameSetup/difficulties'
import { resolveDecklist, type ResolvedHeroDeck } from '../../services/gameSetup'
import { useGameStore } from '../../store'
import type { GameSetupRenderProps } from '../types'

export function MarvelSetupForm({ disabled, onErrorMessageChange }: GameSetupRenderProps) {
  const setupState = useGameStore((state) => state.gameSetupState)
  const setGameSetupState = useGameStore((state) => state.setGameSetupState)
  const [resolvedCustomDeck, setResolvedCustomDeck] = useState<ResolvedHeroDeck | null>(null)
  const [customDeckError, setCustomDeckError] = useState<string | null>(null)
  const [isCustomDeckLoading, setIsCustomDeckLoading] = useState(false)
  const latestLookupId = useRef(0)

  const heroDeckSource = setupState.heroDeckSource === 'custom' ? 'custom' : 'precon'
  const heroDeckId = typeof setupState.heroDeckId === 'number' ? setupState.heroDeckId : (HERO_DECKS[0]?.deckId ?? 0)
  const customDeckIdInput = typeof setupState.customDeckIdInput === 'string' ? setupState.customDeckIdInput : ''
  const villainCode = typeof setupState.villainCode === 'string' ? setupState.villainCode : (VILLAIN_SETS[0]?.card_set_code ?? '')
  const modularCode = typeof setupState.modularCode === 'string' ? setupState.modularCode : (MODULAR_SETS[0]?.card_set_code ?? '')
  const difficultyCode = typeof setupState.difficultyCode === 'string' ? setupState.difficultyCode : (DIFFICULTY_SETS[0]?.card_set_code ?? '')
  const villainInHardMode = Boolean(setupState.villainInHardMode)

  const trimmedCustomDeckId = customDeckIdInput.trim()

  async function lookupCustomDeck(deckIdInput: string) {
    const parsedDeckId = Number(deckIdInput)
    if (!Number.isInteger(parsedDeckId) || parsedDeckId <= 0) {
      setResolvedCustomDeck(null)
      setCustomDeckError('Deck ID must be a positive number.')
      onErrorMessageChange('Deck ID must be a positive number.')
      setIsCustomDeckLoading(false)
      setGameSetupState({ resolvedCustomDeck: null })
      return
    }

    const lookupId = latestLookupId.current + 1
    latestLookupId.current = lookupId
    setIsCustomDeckLoading(true)
    setCustomDeckError(null)
    onErrorMessageChange(null)

    try {
      const deck = await resolveDecklist(parsedDeckId)
      if (latestLookupId.current !== lookupId) return
      setResolvedCustomDeck(deck)
      setGameSetupState({ resolvedCustomDeck: deck })
    } catch (error) {
      if (latestLookupId.current !== lookupId) return
      const message = error instanceof Error ? error.message : 'Failed to load the selected deck.'
      setResolvedCustomDeck(null)
      setCustomDeckError(message)
      setGameSetupState({ resolvedCustomDeck: null })
      onErrorMessageChange(message)
    } finally {
      if (latestLookupId.current === lookupId) {
        setIsCustomDeckLoading(false)
      }
    }
  }

  const resetCustomDeckState = () => {
    latestLookupId.current += 1
    setResolvedCustomDeck(null)
    setCustomDeckError(null)
    setIsCustomDeckLoading(false)
    setGameSetupState({ resolvedCustomDeck: null })
  }

  return (
    <>
      <label className="new-game-modal__field">
        <span>Hero deck source</span>
        <div className="new-game-modal__segmented" role="radiogroup" aria-label="Hero deck source">
          <button
            type="button"
            className={`new-game-modal__segment${heroDeckSource === 'precon' ? ' new-game-modal__segment--active' : ''}`}
            onClick={() => {
              setGameSetupState({ heroDeckSource: 'precon' })
              onErrorMessageChange(null)
              resetCustomDeckState()
            }}
            disabled={disabled}
            aria-pressed={heroDeckSource === 'precon'}
          >
            Pre-con
          </button>
          <button
            type="button"
            className={`new-game-modal__segment${heroDeckSource === 'custom' ? ' new-game-modal__segment--active' : ''}`}
            onClick={() => {
              setGameSetupState({ heroDeckSource: 'custom' })
              onErrorMessageChange(null)
              resetCustomDeckState()
            }}
            disabled={disabled}
            aria-pressed={heroDeckSource === 'custom'}
          >
            Custom
          </button>
        </div>
      </label>

      {heroDeckSource === 'precon' ? (
        <label className="new-game-modal__field">
          <span>Hero deck</span>
          <select value={heroDeckId} onChange={(event) => setGameSetupState({ heroDeckId: Number(event.target.value) })} disabled={disabled}>
            {HERO_DECKS.map((hero) => (
              <option key={hero.deckId} value={hero.deckId}>{hero.name}</option>
            ))}
          </select>
        </label>
      ) : (
        <label className="new-game-modal__field">
          <span>Custom deck ID</span>
          <input
            type="text"
            inputMode="numeric"
            value={customDeckIdInput}
            onChange={(event) => {
              setGameSetupState({ customDeckIdInput: event.target.value })
              onErrorMessageChange(null)
              resetCustomDeckState()
            }}
            onBlur={() => {
              if (trimmedCustomDeckId) {
                void lookupCustomDeck(trimmedCustomDeckId)
              }
            }}
            placeholder="Enter MarvelCDB deck ID"
            disabled={disabled}
          />
          {isCustomDeckLoading ? (
            <p className="new-game-modal__status">Loading deck...</p>
          ) : null}
          {!isCustomDeckLoading && (resolvedCustomDeck ?? (setupState.resolvedCustomDeck as ResolvedHeroDeck | null)) ? (
            <p className="new-game-modal__status new-game-modal__status--success">
              {((resolvedCustomDeck ?? setupState.resolvedCustomDeck) as ResolvedHeroDeck).heroName}: {((resolvedCustomDeck ?? setupState.resolvedCustomDeck) as ResolvedHeroDeck).deckName}
            </p>
          ) : null}
          {!isCustomDeckLoading && customDeckError ? (
            <p className="new-game-modal__status new-game-modal__status--error">{customDeckError}</p>
          ) : null}
        </label>
      )}

      <label className="new-game-modal__field">
        <span>Villain</span>
        <select value={villainCode} onChange={(event) => setGameSetupState({ villainCode: event.target.value })} disabled={disabled}>
          {VILLAIN_SETS.map((villain) => (
            <option key={villain.card_set_code} value={villain.card_set_code}>{villain.name}</option>
          ))}
        </select>
      </label>

      <label className="new-game-modal__field">
        <span>Modular set</span>
        <select value={modularCode} onChange={(event) => setGameSetupState({ modularCode: event.target.value })} disabled={disabled}>
          {MODULAR_SETS.map((modular) => (
            <option key={modular.card_set_code} value={modular.card_set_code}>{modular.name}</option>
          ))}
        </select>
      </label>

      <label className="new-game-modal__field">
        <span>Difficulty</span>
        <select value={difficultyCode} onChange={(event) => setGameSetupState({ difficultyCode: event.target.value })} disabled={disabled}>
          {DIFFICULTY_SETS.map((difficulty) => (
            <option key={difficulty.card_set_code} value={difficulty.card_set_code}>{difficulty.name}</option>
          ))}
        </select>
      </label>

      <label className="new-game-modal__checkbox">
        <input
          type="checkbox"
          checked={villainInHardMode}
          onChange={(event) => setGameSetupState({ villainInHardMode: event.target.checked })}
          disabled={disabled}
        />
        <span>Use hard mode for the villain setup</span>
      </label>
    </>
  )
}
