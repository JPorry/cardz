import BOARD_DATA from '../../config/board.json'
import {
  parseBoardLayout,
  type RegionConfig,
} from '../../config/board'
import type { GameBoardDefinition } from '../types'

const layout = parseBoardLayout(BOARD_DATA)
const regionConfigMap = new Map<string, RegionConfig>(
  layout.regions.map((region) => [region.id, region]),
)

export const marvelBoardDefinition: GameBoardDefinition = {
  layout,
  config: layout.board,
  getRegionConfig(regionId: string) {
    return regionConfigMap.get(regionId)
  },
}
