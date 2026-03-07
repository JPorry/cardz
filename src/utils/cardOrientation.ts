import * as THREE from 'three'
import type { CardState } from '../store'

export const CARD_WIDTH = 1.44
export const CARD_HEIGHT = 2.09
export const TABLE_CARD_SCALE = 1.65
export const TABLE_CARD_WIDTH = CARD_WIDTH * TABLE_CARD_SCALE
export const TABLE_CARD_HEIGHT = CARD_HEIGHT * TABLE_CARD_SCALE

export function getEffectiveCardDimensions(
  card: Pick<CardState, 'tapped'>,
): { width: number; height: number } {
  if (card.tapped) {
    return { width: CARD_HEIGHT, height: CARD_WIDTH }
  }

  return { width: CARD_WIDTH, height: CARD_HEIGHT }
}

export function getCardTableEuler(
  card: Pick<CardState, 'rotation' | 'faceUp' | 'tapped'>,
  wiggle = 0,
  pitchOffset = 0,
  yawOffset = 0,
): THREE.Euler {
  const flipYRot = card.faceUp ? 0 : Math.PI
  const tapRot = card.tapped ? Math.PI / 2 : 0

  return new THREE.Euler(
    -Math.PI / 2 + pitchOffset,
    card.rotation[1] + yawOffset + wiggle + flipYRot,
    card.rotation[2] + wiggle + tapRot,
  )
}
