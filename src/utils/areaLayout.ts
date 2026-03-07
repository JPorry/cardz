export type TitlePosition = 'top' | 'bottom' | 'left' | 'right'

export const AREA_TITLE_EDGE_PADDING = 0.18
export const AREA_TITLE_GAP = 0.28
export const AREA_CONTENT_PADDING = 0

export const LANE_TITLE_LAYOUT = {
  worldWidth: 3,
  canvasWidth: 1024,
  canvasHeight: 320,
  baseFontSize: 98,
  maxWidthRatio: 0.9,
} as const

export const REGION_TITLE_LAYOUT = {
  worldWidth: 3,
  canvasWidth: 1024,
  canvasHeight: 320,
  baseFontSize: 98,
  maxWidthRatio: 0.9,
} as const

type AreaTitleLayout = typeof LANE_TITLE_LAYOUT | typeof REGION_TITLE_LAYOUT

export function getTitleWorldHeight(worldWidth: number, canvasWidth: number, canvasHeight: number) {
  return worldWidth * (canvasHeight / canvasWidth)
}

function getTitleCanvasMetrics(text: string, layout: AreaTitleLayout) {
  if (typeof document === 'undefined') {
    const worldHeight = getTitleWorldHeight(layout.worldWidth, layout.canvasWidth, layout.canvasHeight)
    return {
      textWorldWidth: layout.worldWidth * 0.7,
      textWorldHeight: worldHeight * 0.7,
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = layout.canvasWidth
  canvas.height = layout.canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const worldHeight = getTitleWorldHeight(layout.worldWidth, layout.canvasWidth, layout.canvasHeight)
    return {
      textWorldWidth: layout.worldWidth * 0.7,
      textWorldHeight: worldHeight * 0.7,
    }
  }

  const baseFont = `${layout.baseFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  ctx.font = `600 ${baseFont}`
  let metrics = ctx.measureText(text)

  if (metrics.width > layout.canvasWidth * layout.maxWidthRatio) {
    const scale = (layout.canvasWidth * layout.maxWidthRatio) / metrics.width
    ctx.font = `600 ${layout.baseFontSize * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
    metrics = ctx.measureText(text)
  }

  const textPixelHeight = (metrics.actualBoundingBoxAscent ?? layout.baseFontSize * 0.7)
    + (metrics.actualBoundingBoxDescent ?? layout.baseFontSize * 0.15)
  const worldHeight = getTitleWorldHeight(layout.worldWidth, layout.canvasWidth, layout.canvasHeight)

  return {
    textWorldWidth: (metrics.width / layout.canvasWidth) * layout.worldWidth,
    textWorldHeight: (textPixelHeight / layout.canvasHeight) * worldHeight,
  }
}

export function getTitleReservedSpace(
  text: string,
  layout: AreaTitleLayout,
  titlePosition: TitlePosition,
  gap: number = AREA_TITLE_GAP,
  edgePadding: number = AREA_TITLE_EDGE_PADDING,
) {
  const { textWorldHeight } = getTitleCanvasMetrics(text, layout)
  void titlePosition
  return edgePadding + textWorldHeight + gap
}

export function getAreaTitleTransform(
  text: string,
  areaWidth: number,
  areaDepth: number,
  layout: AreaTitleLayout,
  titlePosition: TitlePosition,
  edgePadding: number = AREA_TITLE_EDGE_PADDING,
) {
  const { textWorldHeight } = getTitleCanvasMetrics(text, layout)

  switch (titlePosition) {
    case 'top':
      return { x: 0, z: -areaDepth / 2 + edgePadding + textWorldHeight / 2, rotationY: 0 }
    case 'bottom':
      return { x: 0, z: areaDepth / 2 - edgePadding - textWorldHeight / 2, rotationY: 0 }
    case 'right':
      return { x: areaWidth / 2 - edgePadding - textWorldHeight / 2, z: 0, rotationY: -Math.PI / 2 }
    case 'left':
    default:
      return { x: -areaWidth / 2 + edgePadding + textWorldHeight / 2, z: 0, rotationY: Math.PI / 2 }
  }
}

export function getAreaContentBounds(
  text: string,
  areaWidth: number,
  areaDepth: number,
  layout: AreaTitleLayout,
  titlePosition: TitlePosition,
  gap: number = AREA_TITLE_GAP,
  padding: number = AREA_CONTENT_PADDING,
  edgePadding: number = AREA_TITLE_EDGE_PADDING,
) {
  const reservedSpace = getTitleReservedSpace(text, layout, titlePosition, gap, edgePadding)
  const totalPadding = padding + reservedSpace
  const left = -areaWidth / 2 + totalPadding
  const right = areaWidth / 2 - totalPadding
  const top = -areaDepth / 2 + totalPadding
  const bottom = areaDepth / 2 - totalPadding

  return { left, right, top, bottom }
}
