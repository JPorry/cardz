import type { TitlePosition } from '../utils/areaLayout'
import type { BoardLayoutConfig } from '../config/board'

export interface InitialLaneState {
  id: string
  label: string
  titlePosition: TitlePosition
  position: [number, number, number]
  width: number
  depth: number
  flipped: boolean
  cardSpacing: number
}

export interface InitialRegionState {
  id: string
  label: string
  titlePosition: TitlePosition
  position: [number, number, number]
  width: number
  depth: number
  flipped: boolean
}

const TABLE_Z_OFFSET = -3

export function toWorldPos(
  boardConfig: BoardLayoutConfig['board'],
  boardX: number,
  boardZ: number,
): [number, number, number] {
  const topLeftX = -boardConfig.width / 2 + boardConfig.padding
  const topLeftZ = (-boardConfig.depth / 2 + boardConfig.padding) + TABLE_Z_OFFSET
  return [topLeftX + boardX, 0, topLeftZ + boardZ]
}

export function createInitialLanes(layout: BoardLayoutConfig): InitialLaneState[] {
  return layout.lanes.map((lane) => ({
    id: lane.id,
    label: lane.label,
    titlePosition: (lane.titlePosition ?? 'left') as TitlePosition,
    position: toWorldPos(layout.board, lane.x + lane.width / 2, lane.y + lane.depth / 2),
    width: lane.width,
    depth: lane.depth,
    cardSpacing: lane.cardSpacing,
    flipped: lane.flipped ?? false,
  }))
}

export function createInitialRegions(layout: BoardLayoutConfig): InitialRegionState[] {
  return layout.regions.map((region) => ({
    id: region.id,
    label: region.label,
    titlePosition: (region.titlePosition ?? 'left') as TitlePosition,
    position: toWorldPos(layout.board, region.x + region.width / 2, region.y + region.depth / 2),
    width: region.width,
    depth: region.depth,
    flipped: region.flipped ?? false,
  }))
}
