import { BOARD_CONFIG, BOARD_LANES, BOARD_REGIONS } from '../config/board';
import type { TitlePosition } from '../utils/areaLayout';

const { width, depth, padding } = BOARD_CONFIG;

/**
 * Converts a board-relative center coordinate into THREE.js world coordinates.
 * [0,0] maps to the padded top-left corner of the physical table.
 * Pass the CENTER of each element.
 */
export function toWorldPos(boardX: number, boardZ: number): [number, number, number] {
  // Table3D mesh is offset by Z = -3 in the scene: mesh.position.set(0, ..., -3)
  const TABLE_Z_OFFSET = -3;

  // Top-left padded corner of the table in THREE.js world space
  const topLeftX = -width / 2 + padding;
  const topLeftZ = (-depth / 2 + padding) + TABLE_Z_OFFSET;

  return [topLeftX + boardX, 0, topLeftZ + boardZ];
}

// Ensure the json config matches the interfaces expected by the store.
// In board.json, x and y are the Top-Left corner of each element to make layout easier.
// We convert them to Center coordinates here for THREE.js.
export const INITIAL_LANES = BOARD_LANES.map((lane) => ({
  id: lane.id,
  label: lane.label,
  titlePosition: (lane.titlePosition ?? 'left') as TitlePosition,
  position: toWorldPos(lane.x + lane.width / 2, lane.y + lane.depth / 2),
  width: lane.width,
  depth: lane.depth,
  cardSpacing: lane.cardSpacing,
  flipped: lane.flipped ?? false,
}));

export const INITIAL_REGIONS = BOARD_REGIONS.map((region) => ({
  id: region.id,
  label: region.label,
  titlePosition: (region.titlePosition ?? 'left') as TitlePosition,
  position: toWorldPos(region.x + region.width / 2, region.y + region.depth / 2),
  width: region.width,
  depth: region.depth,
  flipped: region.flipped ?? false,
}));
