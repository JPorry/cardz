// This file now acts as a simple pass-through to our JSON configuration,
// keeping the config purely data-driven as requested.
// All logic and coordinate transformation is handled in src/utils/boardUtils.ts.

import BOARD_DATA from './board.json';

export interface BoardConfig {
  width: number
  depth: number
  padding: number
  allowDirectTableCardDrop?: boolean
}

export const BOARD_CONFIG: BoardConfig = BOARD_DATA.board;
