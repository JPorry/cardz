import { useEffect, useState } from 'react'
import { useGameStore } from '../store'
import { getSelectionActionSet } from '../utils/selectionActions'

const TOUCH_MENU_DELAY_MS = 350

export function SelectionOverlay() {
  const selectedItems = useGameStore((state) => state.selectedItems)
  const selectionBounds = useGameStore((state) => state.selectionBounds)
  const marqueeSelection = useGameStore((state) => state.marqueeSelection)
  const previewCardId = useGameStore((state) => state.previewCardId)
  const isExaminingStack = useGameStore((state) => state.examinedStack !== null)
  const menuActions = getSelectionActionSet(useGameStore.getState(), selectedItems).actions
  const [supportsImmediateMenu, setSupportsImmediateMenu] = useState(true)
  const [showMenu, setShowMenu] = useState(true)
  const [suppressedSelectionKey, setSuppressedSelectionKey] = useState<string | null>(null)
  const selectionKey = selectedItems.map((item) => `${item.kind}:${item.id}`).join('|')

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
    const updateSupportsImmediateMenu = () => setSupportsImmediateMenu(mediaQuery.matches)

    updateSupportsImmediateMenu()
    mediaQuery.addEventListener('change', updateSupportsImmediateMenu)

    return () => mediaQuery.removeEventListener('change', updateSupportsImmediateMenu)
  }, [])

  useEffect(() => {
    if (!previewCardId || selectionKey.length === 0) return
    setSuppressedSelectionKey(selectionKey)
    setShowMenu(false)
  }, [previewCardId, selectionKey])

  useEffect(() => {
    if (selectionKey.length === 0) {
      setSuppressedSelectionKey(null)
      setShowMenu(true)
      return
    }

    if (suppressedSelectionKey && suppressedSelectionKey !== selectionKey) {
      setSuppressedSelectionKey(null)
    }
  }, [selectionKey, suppressedSelectionKey])

  useEffect(() => {
    if (suppressedSelectionKey === selectionKey && selectionKey.length > 0) {
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
  }, [selectedItems, selectionKey, suppressedSelectionKey, supportsImmediateMenu])

  const menuStyle = selectionBounds
    ? {
        left: Math.min(window.innerWidth - 180, Math.max(20, selectionBounds.x + selectionBounds.width / 2 - 72)),
        top: Math.max(20, selectionBounds.y - 72),
      }
    : null

  const marqueeLeft = Math.min(marqueeSelection.startX, marqueeSelection.currentX)
  const marqueeTop = Math.min(marqueeSelection.startY, marqueeSelection.currentY)
  const marqueeWidth = Math.abs(marqueeSelection.currentX - marqueeSelection.startX)
  const marqueeHeight = Math.abs(marqueeSelection.currentY - marqueeSelection.startY)

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
      {selectionBounds && menuStyle && showMenu && menuActions.length > 0 && !isExaminingStack && (
        <div
          className="selection-menu"
          style={{
            left: menuStyle.left,
            top: menuStyle.top,
          }}
        >
          {menuActions.map((action) => (
            <button key={action.id} className="selection-menu__button" onClick={action.execute}>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
