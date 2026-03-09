import { useEffect, useState } from 'react'
import { useSupportsHoverPreview } from '../hooks/useSupportsHoverPreview'
import { useGameStore } from '../store'
import { getSelectionPreviewCardId } from '../utils/previewCards'
import { getSelectionActionSet } from '../utils/selectionActions'

const TOUCH_MENU_DELAY_MS = 350
const MENU_VIEWPORT_MARGIN = 20
const MENU_OFFSET = 16
const MENU_MAX_WIDTH = 188
const MENU_ROW_HEIGHT = 44
const MENU_ROW_GAP = 10
const MENU_PADDING = 10

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function SelectionOverlay() {
  const selectedItems = useGameStore((state) => state.selectedItems)
  const selectionBounds = useGameStore((state) => state.selectionBounds)
  const marqueeSelection = useGameStore((state) => state.marqueeSelection)
  const touchQuickPreviewCardId = useGameStore((state) => state.touchQuickPreviewCardId)
  const previewCardId = useGameStore((state) => state.previewCardId)
  const isExaminingStack = useGameStore((state) => state.examinedStack !== null)
  const isDragging = useGameStore((state) => state.isDragging)
  const menuActions = getSelectionActionSet(useGameStore.getState(), selectedItems).actions
  const supportsImmediateMenu = useSupportsHoverPreview()
  const [showMenu, setShowMenu] = useState(true)
  const [suppressedSelectionKey, setSuppressedSelectionKey] = useState<string | null>(null)
  const [dragSuppressedSelectionKey, setDragSuppressedSelectionKey] = useState<string | null>(null)
  const selectionKey = selectedItems.map((item) => `${item.kind}:${item.id}`).join('|')

  useEffect(() => {
    if ((!previewCardId && !touchQuickPreviewCardId) || selectionKey.length === 0) return
    setSuppressedSelectionKey(selectionKey)
    setShowMenu(false)
  }, [previewCardId, touchQuickPreviewCardId, selectionKey])

  useEffect(() => {
    if (isDragging && selectionKey.length > 0) {
      setDragSuppressedSelectionKey(selectionKey)
      setShowMenu(false)
      return
    }

    if (!isDragging && dragSuppressedSelectionKey && dragSuppressedSelectionKey !== selectionKey) {
      setDragSuppressedSelectionKey(null)
    }
  }, [isDragging, selectionKey, dragSuppressedSelectionKey])

  useEffect(() => {
    if (selectionKey.length === 0) {
      setSuppressedSelectionKey(null)
      setDragSuppressedSelectionKey(null)
      setShowMenu(true)
      return
    }

    if (suppressedSelectionKey && suppressedSelectionKey !== selectionKey) {
      setSuppressedSelectionKey(null)
    }

    if (dragSuppressedSelectionKey && dragSuppressedSelectionKey !== selectionKey) {
      setDragSuppressedSelectionKey(null)
    }
  }, [selectionKey, suppressedSelectionKey, dragSuppressedSelectionKey])

  useEffect(() => {
    if (marqueeSelection.isActive) {
      setShowMenu(false)
      return
    }

    if (suppressedSelectionKey === selectionKey && selectionKey.length > 0) {
      setShowMenu(false)
      return
    }

    if (dragSuppressedSelectionKey === selectionKey && selectionKey.length > 0) {
      setShowMenu(false)
      return
    }

    if (supportsImmediateMenu || selectedItems.length === 0) {
      setShowMenu(true)
      return
    }

    setShowMenu(false)
    const timeoutId = window.setTimeout(() => setShowMenu(true), TOUCH_MENU_DELAY_MS)
    return () => window.clearTimeout(timeoutId)
  }, [selectedItems, selectionKey, suppressedSelectionKey, dragSuppressedSelectionKey, supportsImmediateMenu, marqueeSelection.isActive])

  const menuStyle = selectionBounds
    ? (() => {
        const menuWidth = Math.min(MENU_MAX_WIDTH, window.innerWidth - MENU_VIEWPORT_MARGIN * 2)
        const menuHeight =
          MENU_PADDING * 2
          + menuActions.length * MENU_ROW_HEIGHT
          + Math.max(0, menuActions.length - 1) * MENU_ROW_GAP
        const maxLeft = Math.max(MENU_VIEWPORT_MARGIN, window.innerWidth - menuWidth - MENU_VIEWPORT_MARGIN)
        const maxTop = Math.max(MENU_VIEWPORT_MARGIN, window.innerHeight - menuHeight - MENU_VIEWPORT_MARGIN)
        const preferredRight = selectionBounds.x + selectionBounds.width + MENU_OFFSET
        const preferredLeft = selectionBounds.x - menuWidth - MENU_OFFSET
        const selectionCenterX = selectionBounds.x + selectionBounds.width / 2
        const top = clamp(
          selectionBounds.y + selectionBounds.height / 2 - menuHeight / 2,
          MENU_VIEWPORT_MARGIN,
          maxTop,
        )

        const cardOnRightHalf = selectionCenterX >= window.innerWidth / 2
        const sameSideLeft = cardOnRightHalf ? preferredRight : preferredLeft
        const oppositeSideLeft = cardOnRightHalf ? preferredLeft : preferredRight
        const sameSideFits = sameSideLeft >= MENU_VIEWPORT_MARGIN && sameSideLeft <= maxLeft
        const oppositeSideFits = oppositeSideLeft >= MENU_VIEWPORT_MARGIN && oppositeSideLeft <= maxLeft

        let left = clamp(sameSideLeft, MENU_VIEWPORT_MARGIN, maxLeft)
        if (!sameSideFits && oppositeSideFits) {
          left = oppositeSideLeft
        }

        return {
          left,
          top,
          width: menuWidth,
        }
      })()
    : null

  const marqueeLeft = Math.min(marqueeSelection.startX, marqueeSelection.currentX)
  const marqueeTop = Math.min(marqueeSelection.startY, marqueeSelection.currentY)
  const marqueeWidth = Math.abs(marqueeSelection.currentX - marqueeSelection.startX)
  const marqueeHeight = Math.abs(marqueeSelection.currentY - marqueeSelection.startY)
  const handleActionClick = (action: typeof menuActions[number]) => {
    const isTouchFlipAction = !supportsImmediateMenu && (action.id === 'flip-stack' || action.id === 'flip-cards')
    if (!isTouchFlipAction) {
      action.execute()
      return
    }

    action.execute()

    const state = useGameStore.getState()
    const [selectedItem] = state.selectedItems
    const previewCardId = state.selectedItems.length === 1 && selectedItem
      ? getSelectionPreviewCardId(state, selectedItem, state.focusedCardId)
      : null

    if (!previewCardId) {
      state.clearTouchQuickPreview()
      return
    }

    state.setTouchQuickPreviewCard(previewCardId)
    setSuppressedSelectionKey(state.selectedItems.map((item) => `${item.kind}:${item.id}`).join('|'))
    setShowMenu(false)
  }

  return (
    <>
      {marqueeSelection.isActive && (
        <div
          className="selection-marquee"
          style={{
            left: marqueeLeft,
            top: marqueeTop,
            width: marqueeWidth,
            height: marqueeHeight,
          }}
        />
      )}
      {selectionBounds && menuStyle && showMenu && menuActions.length > 0 && !isExaminingStack && !isDragging && (
        <div
          className="selection-menu"
          style={{
            left: menuStyle.left,
            top: menuStyle.top,
            width: menuStyle.width,
          }}
        >
          {menuActions.map((action) => (
            <button key={action.id} className="selection-menu__button" onClick={() => handleActionClick(action)}>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
