export const PORTRAIT_RATIO = 1 / 1.4
export const HOVER_PORTRAIT_HEIGHT = 525
export const HOVER_LANDSCAPE_WIDTH = 525
export const HOVER_COUNTER_RAIL_WIDTH = 54
export const HOVER_COUNTER_RAIL_GAP = 12
export const HOVER_STATUS_RAIL_HEIGHT = 50
export const HOVER_STATUS_RAIL_GAP = 4
export const HOVER_PREVIEW_EDGE_OFFSET = 40
export const HOVER_PREVIEW_FRAME_PADDING = 10

export interface HoverPreviewMetrics {
  hoverWidth: number
  hoverHeight: number
  hoverFrameWidth: number
  hoverFrameHeight: number
  isHoveredLeft: boolean
}

export interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
}

export function getHoverPreviewMetrics(
  artworkAspectRatio: number,
  counterCount: number,
  statusCount: number,
  screenX: number,
  viewportWidth: number,
): HoverPreviewMetrics {
  const hoverIsLandscape = artworkAspectRatio > 1
  const hoverWidth = hoverIsLandscape
    ? HOVER_LANDSCAPE_WIDTH
    : Math.round(HOVER_PORTRAIT_HEIGHT * artworkAspectRatio)
  const hoverHeight = hoverIsLandscape
    ? Math.round(HOVER_LANDSCAPE_WIDTH / artworkAspectRatio)
    : HOVER_PORTRAIT_HEIGHT
  const hoverFrameWidth = hoverWidth + (counterCount > 0 ? HOVER_COUNTER_RAIL_WIDTH + HOVER_COUNTER_RAIL_GAP : 0)
  const hoverFrameHeight = hoverHeight + (statusCount > 0 ? HOVER_STATUS_RAIL_HEIGHT + HOVER_STATUS_RAIL_GAP : 0)

  return {
    hoverWidth,
    hoverHeight,
    hoverFrameWidth,
    hoverFrameHeight,
    isHoveredLeft: screenX < viewportWidth / 2,
  }
}

export function getHoverPreviewRect(
  screenX: number,
  viewportWidth: number,
  viewportHeight: number,
  hoverFrameWidth: number,
  hoverFrameHeight: number,
): ScreenRect {
  const isHoveredLeft = screenX < viewportWidth / 2
  const width = hoverFrameWidth + HOVER_PREVIEW_FRAME_PADDING * 2
  const height = hoverFrameHeight + HOVER_PREVIEW_FRAME_PADDING * 2
  const left = isHoveredLeft
    ? viewportWidth - HOVER_PREVIEW_EDGE_OFFSET - width
    : HOVER_PREVIEW_EDGE_OFFSET
  const top = Math.round((viewportHeight - height) / 2)

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }
}

export function rectsIntersect(a: ScreenRect, b: ScreenRect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}
