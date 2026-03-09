import { createInitialLanes, createInitialRegions, toWorldPos as toWorldPosForBoard } from '../games/boardLayout'
import { getDefaultGame } from '../games/registry'

export function toWorldPos(boardX: number, boardZ: number): [number, number, number] {
  return toWorldPosForBoard(getDefaultGame().board.config, boardX, boardZ)
}

export const INITIAL_LANES = createInitialLanes(getDefaultGame().board.layout)
export const INITIAL_REGIONS = createInitialRegions(getDefaultGame().board.layout)
