import React, { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store'
import type { CardCounterKey, CardStatusKey } from '../utils/cardMetadata'

const PORTRAIT_RATIO = 1 / 1.4
const HOVER_PORTRAIT_HEIGHT = 525
const HOVER_LANDSCAPE_WIDTH = 525
const HOVER_COUNTER_RAIL_WIDTH = 54
const HOVER_COUNTER_RAIL_GAP = 12
const HOVER_STATUS_RAIL_HEIGHT = 50
const HOVER_STATUS_RAIL_GAP = 4

const COUNTER_CONTROLS: Array<{ key: CardCounterKey, label: string, shortLabel: string }> = [
  { key: 'damage', label: 'Health', shortLabel: 'DMG' },
  { key: 'acceleration', label: 'Acceleration', shortLabel: 'ACC' },
  { key: 'threat', label: 'Threat', shortLabel: 'THR' },
  { key: 'allPurpose', label: 'All Purpose', shortLabel: 'ALL' },
]

const COUNTER_BADGE_COLORS: Record<CardCounterKey, string> = {
  damage: '#c62828',
  acceleration: '#ef6c00',
  threat: '#1565c0',
  allPurpose: '#2e7d32',
}

const STATUS_CONTROLS: Array<{ key: CardStatusKey, label: string }> = [
  { key: 'stunned', label: 'Stunned' },
  { key: 'confused', label: 'Confused' },
  { key: 'tough', label: 'Tough' },
]

const STATUS_BADGE_COLORS: Record<CardStatusKey, string> = {
  stunned: '#ad1457',
  confused: '#4527a0',
  tough: '#1b5e20',
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export const CardPreview: React.FC = () => {
  const {
    hoveredCardId,
    hoveredCardScreenX,
    previewCardId,
    cards,
    setPreviewCard,
    adjustCardCounter,
    toggleCardStatus,
  } = useGameStore()
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({})
  const [supportsHoverPreview, setSupportsHoverPreview] = useState(true)
  const previewOpenedAtRef = useRef<number | null>(null)

  const hoveredCard = cards.find((c) => c.id === hoveredCardId)
  const previewCard = cards.find((c) => c.id === previewCardId)
  const getVisibleArtworkUrl = (card?: typeof hoveredCard) => {
    if (!card) return undefined
    return card.faceUp
      ? card.artworkUrl
      : card.backArtworkUrl
  }
  const hoveredArtworkUrl = getVisibleArtworkUrl(hoveredCard)
  const previewArtworkUrl = getVisibleArtworkUrl(previewCard)

  useEffect(() => {
    const urls = [hoveredArtworkUrl, previewArtworkUrl].filter(Boolean) as string[]

    urls.forEach((url) => {
      if (imageAspectRatios[url]) return

      const img = new Image()
      img.onload = () => {
        if (!img.naturalWidth || !img.naturalHeight) return
        setImageAspectRatios((current) => {
          if (current[url]) return current
          return { ...current, [url]: img.naturalWidth / img.naturalHeight }
        })
      }
      img.src = url
    })
  }, [hoveredArtworkUrl, previewArtworkUrl, imageAspectRatios])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
    const updateSupportsHoverPreview = () => setSupportsHoverPreview(mediaQuery.matches)

    updateSupportsHoverPreview()
    mediaQuery.addEventListener('change', updateSupportsHoverPreview)

    return () => mediaQuery.removeEventListener('change', updateSupportsHoverPreview)
  }, [])

  useEffect(() => {
    previewOpenedAtRef.current = previewCardId ? performance.now() : null
  }, [previewCardId])

  if (!hoveredCard && !previewCard) return null

  const showHoverPreview = supportsHoverPreview && hoveredCard && !previewCardId && hoveredArtworkUrl
  const isHoveredLeft = hoveredCardScreenX !== null && hoveredCardScreenX < window.innerWidth / 2
  const showBigPreview = !!previewCard

  const getAspectRatio = (artworkUrl?: string) => {
    if (!artworkUrl) return PORTRAIT_RATIO
    return imageAspectRatios[artworkUrl] ?? PORTRAIT_RATIO
  }

  const hoverAspectRatio = getAspectRatio(hoveredArtworkUrl)
  const hoverIsLandscape = hoverAspectRatio > 1
  const hoverWidth = hoverIsLandscape
    ? HOVER_LANDSCAPE_WIDTH
    : Math.round(HOVER_PORTRAIT_HEIGHT * hoverAspectRatio)
  const hoverHeight = hoverIsLandscape
    ? Math.round(HOVER_LANDSCAPE_WIDTH / hoverAspectRatio)
    : HOVER_PORTRAIT_HEIGHT

  const previewAspectRatio = getAspectRatio(previewArtworkUrl)
  const hoveredCounters = hoveredCard
    ? COUNTER_CONTROLS.filter((counter) => hoveredCard.counters[counter.key] > 0)
    : []
  const hoveredStatuses = hoveredCard
    ? STATUS_CONTROLS.filter((status) => hoveredCard.statuses[status.key])
    : []
  const hoverFrameWidth = hoverWidth + (hoveredCounters.length > 0 ? HOVER_COUNTER_RAIL_WIDTH + HOVER_COUNTER_RAIL_GAP : 0)
  const hoverFrameHeight = hoverHeight + (hoveredStatuses.length > 0 ? HOVER_STATUS_RAIL_HEIGHT + HOVER_STATUS_RAIL_GAP : 0)
  const closePreview = () => {
    if (previewOpenedAtRef.current !== null && performance.now() - previewOpenedAtRef.current < 250) return
    setPreviewCard(null)
  }

  return (
    <>
      {showHoverPreview && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            [isHoveredLeft ? 'right' : 'left']: '40px',
            width: `${hoverFrameWidth + 20}px`,
            height: `${hoverFrameHeight + 20}px`,
            zIndex: 1000,
            pointerEvents: 'none',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(18,18,18,0.78)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease-out',
            animation: 'fadeIn 0.2s ease-out',
            padding: '10px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: `${hoverFrameWidth}px`,
              height: `${hoverFrameHeight}px`,
            }}
          >
            <img
              src={hoveredArtworkUrl}
              alt={hoveredCard.name}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${hoverWidth}px`,
                height: `${hoverHeight}px`,
                objectFit: 'contain',
                borderRadius: '10px',
              }}
            />
            {hoveredCounters.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${hoverWidth + HOVER_COUNTER_RAIL_GAP}px`,
                  width: `${HOVER_COUNTER_RAIL_WIDTH}px`,
                  height: `${hoverHeight}px`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {hoveredCounters.map((counter) => (
                  <div
                    key={counter.key}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '54px',
                      height: '54px',
                      padding: '4px',
                      borderRadius: '10px',
                      background: COUNTER_BADGE_COLORS[counter.key],
                      color: 'white',
                      fontWeight: 800,
                      boxShadow: '0 10px 18px rgba(0,0,0,0.28)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span style={{ fontSize: '10px', lineHeight: 1, opacity: 0.9 }}>
                      {counter.shortLabel}
                    </span>
                    <span style={{ fontSize: '21px', lineHeight: 1, marginTop: '3px' }}>
                      {hoveredCard.counters[counter.key]}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {hoveredStatuses.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: `${hoverHeight + HOVER_STATUS_RAIL_GAP}px`,
                  left: 0,
                  width: `${hoverWidth}px`,
                  minHeight: `${HOVER_STATUS_RAIL_HEIGHT}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                {hoveredStatuses.map((status) => (
                  <div
                    key={status.key}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '999px',
                      background: STATUS_BADGE_COLORS[status.key],
                      border: '1px solid rgba(255,255,255,0.16)',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 800,
                      boxShadow: '0 10px 18px rgba(0,0,0,0.28)',
                    }}
                  >
                    {status.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showBigPreview && previewCard && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(5px)',
            animation: 'fadeIn 0.2s ease-out',
            padding: '24px',
            boxSizing: 'border-box',
          }}
          onClick={closePreview}
        >
          <div
            style={{
              width: 'min(96vw, 1260px)',
              maxHeight: '92vh',
              borderRadius: '28px',
              overflow: 'hidden',
              boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(12,12,12,0.96)',
              position: 'relative',
              animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              padding: '20px',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closePreview}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(0,0,0,0.45)',
                color: 'white',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(5px)',
                zIndex: 2,
              }}
            >
              ×
            </button>
            <div
              className="card-preview-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)',
                gap: '20px',
                alignItems: 'stretch',
              }}
            >
              <div
                style={{
                  minHeight: 'min(78vh, 860px)',
                  borderRadius: '20px',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: `${clamp(previewAspectRatio * 68, 30, 58)}vw`,
                    aspectRatio: `${previewAspectRatio}`,
                    maxHeight: '74vh',
                  }}
                >
                  <img
                    src={previewArtworkUrl}
                    alt={previewCard.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px' }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  minHeight: '100%',
                }}
              >
                <div
                  style={{
                    padding: '18px',
                    borderRadius: '20px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ color: 'white', fontSize: '26px', fontWeight: 700 }}>
                    {previewCard.name ?? 'Card'}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.62)', fontSize: '13px', marginTop: '6px', letterSpacing: '0.08em' }}>
                    TOKEN TRACKING
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '12px',
                  }}
                >
                  {COUNTER_CONTROLS.map((counter) => (
                    <div
                      key={counter.key}
                      style={{
                        padding: '16px 18px',
                        borderRadius: '18px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        minHeight: '132px',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '16px',
                            lineHeight: 1.15,
                            wordBreak: 'break-word',
                          }}
                        >
                          {counter.label}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: '12px', letterSpacing: '0.08em' }}>
                          {counter.shortLabel}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto auto auto',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: '16px',
                        }}
                      >
                        <button
                          onClick={() => adjustCardCounter(previewCard.id, counter.key, -1)}
                          style={stepperButtonStyle}
                        >
                          −
                        </button>
                        <div
                          style={{
                            minWidth: '52px',
                            textAlign: 'center',
                            color: 'white',
                            fontWeight: 800,
                            fontSize: '24px',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {previewCard.counters[counter.key]}
                        </div>
                        <button
                          onClick={() => adjustCardCounter(previewCard.id, counter.key, 1)}
                          style={stepperButtonStyle}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '20px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ color: 'rgba(255,255,255,0.62)', fontSize: '13px', marginBottom: '12px', letterSpacing: '0.08em' }}>
                    STATUS
                  </div>
                  <div className="card-preview-statuses" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                    {STATUS_CONTROLS.map((status) => {
                      const active = previewCard.statuses[status.key]
                      return (
                        <button
                          key={status.key}
                          onClick={() => toggleCardStatus(previewCard.id, status.key)}
                          style={{
                            minHeight: '64px',
                            borderRadius: '18px',
                            border: active ? '1px solid rgba(123, 235, 181, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                            background: active ? 'rgba(72, 160, 111, 0.36)' : 'rgba(255,255,255,0.04)',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '16px',
                            cursor: 'pointer',
                            padding: '12px',
                          }}
                        >
                          {status.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.8); }
            to { opacity: 1; transform: scale(1); }
          }
          @media (max-width: 980px) {
            .card-preview-grid {
              grid-template-columns: 1fr;
            }
            .card-preview-statuses {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>
    </>
  )
}

const stepperButtonStyle: React.CSSProperties = {
  width: '52px',
  height: '52px',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.08)',
  color: 'white',
  fontSize: '30px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
