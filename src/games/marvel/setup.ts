import { HERO_DECKS } from '../../config/gameSetup/heroes'
import { VILLAIN_SETS } from '../../config/gameSetup/villains'
import { MODULAR_SETS } from '../../config/gameSetup/modulars'
import { DIFFICULTY_SETS } from '../../config/gameSetup/difficulties'
import {
  prepareGameSetup,
  type ResolvedHeroDeck,
} from '../../services/gameSetup'
import type { GameDefinition } from '../types'
import { MarvelSetupForm } from './MarvelSetupForm'

export const marvelSetupDefinition: GameDefinition['setup'] = {
  createInitialState() {
    return {
      heroDeckSource: 'precon',
      heroDeckId: HERO_DECKS[0]?.deckId ?? 0,
      customDeckIdInput: '',
      resolvedCustomDeck: null,
      villainCode: VILLAIN_SETS[0]?.card_set_code ?? '',
      modularCode: MODULAR_SETS[0]?.card_set_code ?? '',
      difficultyCode: DIFFICULTY_SETS[0]?.card_set_code ?? '',
      villainInHardMode: false,
    }
  },
  Renderer: MarvelSetupForm,
  async prepare(rawState) {
    const heroDeckSource = rawState.heroDeckSource === 'custom' ? 'custom' : 'precon'
    const heroDeckId = typeof rawState.heroDeckId === 'number' ? rawState.heroDeckId : (HERO_DECKS[0]?.deckId ?? 0)
    const resolvedCustomDeck = (rawState.resolvedCustomDeck ?? null) as ResolvedHeroDeck | null
    const villainCode = typeof rawState.villainCode === 'string' ? rawState.villainCode : VILLAIN_SETS[0]?.card_set_code
    const modularCode = typeof rawState.modularCode === 'string' ? rawState.modularCode : MODULAR_SETS[0]?.card_set_code
    const difficultyCode = typeof rawState.difficultyCode === 'string' ? rawState.difficultyCode : DIFFICULTY_SETS[0]?.card_set_code
    const villainInHardMode = Boolean(rawState.villainInHardMode)

    const selectedHero = HERO_DECKS.find((hero) => hero.deckId === heroDeckId) ?? HERO_DECKS[0]
    const selectedVillain = VILLAIN_SETS.find((villain) => villain.card_set_code === villainCode) ?? VILLAIN_SETS[0]
    const selectedModular = MODULAR_SETS.find((modular) => modular.card_set_code === modularCode) ?? MODULAR_SETS[0]
    const selectedDifficulty = DIFFICULTY_SETS.find((difficulty) => difficulty.card_set_code === difficultyCode) ?? DIFFICULTY_SETS[0]

    if (!selectedHero || !selectedVillain || !selectedModular || !selectedDifficulty) {
      throw new Error('The selected Marvel Champions setup is incomplete.')
    }

    if (heroDeckSource === 'custom' && !resolvedCustomDeck) {
      throw new Error('Load a valid custom deck before starting the game.')
    }

    return prepareGameSetup({
      hero: heroDeckSource === 'precon'
        ? { source: 'precon', hero: selectedHero }
        : { source: 'custom', deck: resolvedCustomDeck! },
      villain: selectedVillain,
      modular: selectedModular,
      difficulty: selectedDifficulty,
      villainMode: villainInHardMode ? 'hard' : 'standard',
    })
  },
}
