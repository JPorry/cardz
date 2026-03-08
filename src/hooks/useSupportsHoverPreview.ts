import { useEffect, useState } from 'react'

export function useSupportsHoverPreview() {
  const [supportsHoverPreview, setSupportsHoverPreview] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
    const coarsePointerQuery = window.matchMedia('(pointer: coarse), (any-pointer: coarse)')
    const hoverlessQuery = window.matchMedia('(hover: none), (any-hover: none)')
    const updateSupportsHoverPreview = () => {
      const maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0
      const isIPadLikeDevice = maxTouchPoints > 1 && /iPad|Macintosh/.test(navigator.userAgent)
      const isTouchFirstDevice = coarsePointerQuery.matches || hoverlessQuery.matches || isIPadLikeDevice

      setSupportsHoverPreview(mediaQuery.matches && !isTouchFirstDevice)
    }

    updateSupportsHoverPreview()
    mediaQuery.addEventListener('change', updateSupportsHoverPreview)
    coarsePointerQuery.addEventListener('change', updateSupportsHoverPreview)
    hoverlessQuery.addEventListener('change', updateSupportsHoverPreview)

    return () => {
      mediaQuery.removeEventListener('change', updateSupportsHoverPreview)
      coarsePointerQuery.removeEventListener('change', updateSupportsHoverPreview)
      hoverlessQuery.removeEventListener('change', updateSupportsHoverPreview)
    }
  }, [])

  return supportsHoverPreview
}
