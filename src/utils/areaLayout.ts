export const CARD_DEPTH = 2.09;
export const AREA_TITLE_CARD_PADDING = 0.2;

export const LANE_TITLE_LAYOUT = {
  // Match region title vertical metrics so cards align from the same title bottom.
  labelCenterOffset: 0.5,
  worldWidth: 3.4,
  canvasWidth: 1024,
  canvasHeight: 320,
  baseFontSize: 112,
  maxWidthRatio: 0.9,
} as const;

export const REGION_TITLE_LAYOUT = {
  labelCenterOffset: 0.5,
  worldWidth: 3.4,
  canvasWidth: 1024,
  canvasHeight: 320,
  baseFontSize: 112,
  maxWidthRatio: 0.9,
} as const;

export function getTitleWorldHeight(worldWidth: number, canvasWidth: number, canvasHeight: number) {
  return worldWidth * (canvasHeight / canvasWidth);
}

export function getCardCenterOffsetBelowTitle(
  areaDepth: number,
  labelCenterOffset: number,
  labelWorldHeight: number,
  cardPadding: number = AREA_TITLE_CARD_PADDING,
  cardDepth: number = CARD_DEPTH,
) {
  const topEdge = -areaDepth / 2;
  const titleBottom = topEdge + labelCenterOffset + labelWorldHeight / 2;
  return titleBottom + cardPadding + cardDepth / 2;
}
