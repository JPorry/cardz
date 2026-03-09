import React, { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store'
import { useSupportsHoverPreview } from '../hooks/useSupportsHoverPreview'
import { getSelectionPreviewCardId } from '../utils/previewCards'
import { getGameDefinition } from '../games/registry'
import { getCounterBadgeColors, getStatusBadgeColors } from '../utils/cardMetadata'
import {
  getHoverPreviewMetrics,
  HOVER_COUNTER_RAIL_GAP,
  HOVER_COUNTER_RAIL_WIDTH,
  HOVER_PREVIEW_EDGE_OFFSET,
  HOVER_PREVIEW_FRAME_PADDING,
  HOVER_STATUS_RAIL_GAP,
  HOVER_STATUS_RAIL_HEIGHT,
  PORTRAIT_RATIO,
} from '../utils/hoverPreviewLayout'

function getSingleTouchPreviewSelection(
  cards: ReturnType<typeof useGameStore.getState>['cards'],
  selectedItems: ReturnType<typeof useGameStore.getState>['selectedItems'],
) {
  if (selectedItems.length === 1) {
    return selectedItems[0]
  }

  if (selectedItems.length === 0 || selectedItems.some((item) => item.kind !== 'card')) {
    return null
  }

  const selectedCards = selectedItems
    .map((item) => cards.find((card) => card.id === item.id))
    .filter((card) => Boolean(card))

  if (selectedCards.length !== selectedItems.length) {
    return null
  }

  const attachmentGroupId = selectedCards[0]?.attachmentGroupId
  if (!attachmentGroupId || selectedCards.some((card) => card?.attachmentGroupId !== attachmentGroupId)) {
    return null
  }

  return selectedItems[0]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`
}

function getStatusToggleStyle(color: string, active: boolean): React.CSSProperties {
  return {
    minHeight: '60px',
    borderRadius: '16px',
    border: `1px solid ${color}`,
    background: active
      ? `linear-gradient(180deg, ${withAlpha(color, '66')}, ${withAlpha(color, '38')})`
      : `linear-gradient(180deg, ${withAlpha(color, '20')}, rgba(255,255,255,0.015))`,
    color: active ? 'white' : 'rgba(255,255,255,0.92)',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
    padding: '10px 14px',
    boxShadow: active
      ? `0 18px 38px ${withAlpha(color, '2e')}, inset 0 1px 0 ${withAlpha(color, '5c')}`
      : `inset 0 1px 0 ${withAlpha(color, '1f')}`,
    opacity: active ? 1 : 0.82,
    transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, opacity 120ms ease',
  }
}

export const CardPreview: React.FC = () => {
  const {
    activeGameId,
    hoveredCardId,
    hoveredCardScreenX,
    touchQuickPreviewCardId,
    previewCardId,
    focusedCardId,
    cards,
    decks,
    selectedItems,
    selectionBounds,
    marqueeSelection,
    setPreviewCard,
    adjustCardCounter,
    toggleCardStatus,
  } = useGameStore()
  const activeGame = getGameDefinition(activeGameId)
  const counterControls = activeGame.cardSemantics.counters
  const statusControls = activeGame.cardSemantics.statuses
  const counterColors = getCounterBadgeColors(counterControls)
  const statusColors = getStatusBadgeColors(statusControls)
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({})
  const supportsHoverPreview = useSupportsHoverPreview()
  const previewOpenedAtRef = useRef<number | null>(null)

  const hoveredCard = cards.find((c) => c.id === hoveredCardId)
  const touchPreviewSelection = getSingleTouchPreviewSelection(cards, selectedItems)
  const selectedPreviewCardId = (
    !supportsHoverPreview
    && !previewCardId
    && !marqueeSelection.isActive
  )
    ? (
        touchQuickPreviewCardId
        ?? (
          touchPreviewSelection
            ? (
                focusedCardId
                && selectedItems.some((item) => item.kind === 'card' && item.id === focusedCardId)
                  ? focusedCardId
                  : getSelectionPreviewCardId({ activeGameId, cards, decks }, touchPreviewSelection, focusedCardId)
              )
            : null
        )
      )
    : null
  const touchSelectedCard = cards.find((c) => c.id === selectedPreviewCardId)
  const quickPreviewCard = supportsHoverPreview ? hoveredCard : touchSelectedCard
  const quickPreviewScreenX = supportsHoverPreview
    ? hoveredCardScreenX
    : selectionBounds
      ? selectionBounds.x + selectionBounds.width / 2
      : null
  const previewCard = cards.find((c) => c.id === previewCardId)
  const getVisibleArtworkUrl = (card?: typeof hoveredCard) => {
    if (!card) return undefined
    return card.faceUp
      ? card.artworkUrl
      : card.backArtworkUrl
  }
  const quickPreviewArtworkUrl = getVisibleArtworkUrl(quickPreviewCard)
  const previewArtworkUrl = getVisibleArtworkUrl(previewCard)

  useEffect(() => {
    const urls = [quickPreviewArtworkUrl, previewArtworkUrl].filter(Boolean) as string[]

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
  }, [quickPreviewArtworkUrl, previewArtworkUrl, imageAspectRatios])

  useEffect(() => {
    previewOpenedAtRef.current = previewCardId ? performance.now() : null
  }, [previewCardId])

  if (!quickPreviewCard && !previewCard) return null

  const getAspectRatio = (artworkUrl?: string) => {
    if (!artworkUrl) return PORTRAIT_RATIO
    return imageAspectRatios[artworkUrl] ?? PORTRAIT_RATIO
  }

  const previewAspectRatio = getAspectRatio(previewArtworkUrl)
  const quickPreviewAspectRatio = getAspectRatio(quickPreviewArtworkUrl)
  const showTouchQuickPreview = !!quickPreviewCard && !previewCardId && !supportsHoverPreview && quickPreviewArtworkUrl
  const showHoverPreview = !!quickPreviewCard && !previewCardId && supportsHoverPreview && quickPreviewArtworkUrl
  const isHoveredLeft = quickPreviewScreenX !== null && quickPreviewScreenX < window.innerWidth / 2
  const showBigPreview = !!previewCard
  const hoveredCounters = quickPreviewCard
    ? counterControls.filter((counter) => (quickPreviewCard.counters[counter.key] ?? 0) > 0)
    : []
  const hoveredStatuses = quickPreviewCard
    ? statusControls.filter((status) => quickPreviewCard.statuses[status.key])
    : []
  const hoverPreviewMetrics = showHoverPreview && quickPreviewScreenX !== null
    ? getHoverPreviewMetrics(
        quickPreviewAspectRatio,
        hoveredCounters.length,
        hoveredStatuses.length,
        quickPreviewScreenX,
        window.innerWidth,
      )
    : null
  const closePreview = () => {
    if (previewOpenedAtRef.current !== null && performance.now() - previewOpenedAtRef.current < 250) return
    setPreviewCard(null)
  }

  return (
    <>
      {showHoverPreview && quickPreviewCard && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            [isHoveredLeft ? 'right' : 'left']: `${HOVER_PREVIEW_EDGE_OFFSET}px`,
            width: `${(hoverPreviewMetrics?.hoverFrameWidth ?? 0) + HOVER_PREVIEW_FRAME_PADDING * 2}px`,
            height: `${(hoverPreviewMetrics?.hoverFrameHeight ?? 0) + HOVER_PREVIEW_FRAME_PADDING * 2}px`,
            zIndex: 1000,
            pointerEvents: 'none',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(18,18,18,0.78)',
            backdropFilter: 'blur(10px)',
            padding: `${HOVER_PREVIEW_FRAME_PADDING}px`,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: `${hoverPreviewMetrics?.hoverFrameWidth ?? 0}px`,
              height: `${hoverPreviewMetrics?.hoverFrameHeight ?? 0}px`,
            }}
          >
            <img
              src={quickPreviewArtworkUrl}
              alt={quickPreviewCard.name}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${hoverPreviewMetrics?.hoverWidth ?? 0}px`,
                height: `${hoverPreviewMetrics?.hoverHeight ?? 0}px`,
                objectFit: 'contain',
                borderRadius: '10px',
              }}
            />
            {hoveredCounters.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${(hoverPreviewMetrics?.hoverWidth ?? 0) + HOVER_COUNTER_RAIL_GAP}px`,
                  width: `${HOVER_COUNTER_RAIL_WIDTH}px`,
                  height: `${hoverPreviewMetrics?.hoverHeight ?? 0}px`,
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
                      background: counterColors[counter.key],
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
                      {quickPreviewCard.counters[counter.key]}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {hoveredStatuses.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: `${(hoverPreviewMetrics?.hoverHeight ?? 0) + HOVER_STATUS_RAIL_GAP}px`,
                  left: 0,
                  width: `${hoverPreviewMetrics?.hoverWidth ?? 0}px`,
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
                      background: statusColors[status.key],
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

      {showTouchQuickPreview && quickPreviewCard && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            [isHoveredLeft ? 'right' : 'left']: `${HOVER_PREVIEW_EDGE_OFFSET}px`,
            zIndex: 1400,
            pointerEvents: 'auto',
          }}
        >
          <div
            className="card-preview-touch-shell"
            style={{
              width: 'min(48vw, 400px)',
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 48px)',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 20px 44px rgba(0,0,0,0.56)',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(10,10,12,0.92)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="card-preview-touch-art"
              style={{
                padding: '10px 10px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '360px',
                  aspectRatio: `${quickPreviewAspectRatio}`,
                  maxHeight: '52vh',
                }}
              >
                <img
                  src={quickPreviewArtworkUrl}
                  alt={quickPreviewCard.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    borderRadius: '14px',
                  }}
                />
              </div>
            </div>

            <div
              className="card-preview-touch-tray"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(180deg, rgba(14,16,20,0.96), rgba(10,11,14,0.98))',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {quickPreviewCard.name ?? 'Card'}
                </div>
                <div
                  style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    flexShrink: 0,
                  }}
                >
                  QUICK EDIT
                </div>
              </div>

              <div
                className="card-preview-touch-counters"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '8px',
                }}
              >
                {counterControls.map((counter) => (
                  <div
                    key={counter.key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto auto',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px',
                      borderRadius: '14px',
                      border: `1px solid ${withAlpha(counterColors[counter.key], '4f')}`,
                      background: `linear-gradient(180deg, ${withAlpha(counterColors[counter.key], '20')}, rgba(255,255,255,0.03))`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: 700,
                          lineHeight: 1.1,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {counter.shortLabel}
                      </div>
                    </div>
                    <button
                      onClick={() => adjustCardCounter(quickPreviewCard.id, counter.key, -1)}
                      style={touchStepperButtonStyle}
                    >
                      −
                    </button>
                    <div
                      style={{
                        minWidth: '32px',
                        padding: '6px 4px',
                        borderRadius: '10px',
                        textAlign: 'center',
                        color: 'white',
                        fontWeight: 800,
                        fontSize: '16px',
                        fontVariantNumeric: 'tabular-nums',
                        background: withAlpha(counterColors[counter.key], quickPreviewCard.counters[counter.key] > 0 ? '29' : '14'),
                        border: `1px solid ${withAlpha(counterColors[counter.key], quickPreviewCard.counters[counter.key] > 0 ? '5f' : '2e')}`,
                      }}
                    >
                      {quickPreviewCard.counters[counter.key]}
                    </div>
                    <button
                      onClick={() => adjustCardCounter(quickPreviewCard.id, counter.key, 1)}
                      style={touchStepperButtonStyle}
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>

              <div
                className="card-preview-touch-statuses"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '8px',
                }}
              >
                {statusControls.map((status) => {
                  const active = quickPreviewCard.statuses[status.key]
                  const color = statusColors[status.key]
                  return (
                    <button
                      key={status.key}
                      onClick={() => toggleCardStatus(quickPreviewCard.id, status.key)}
                      style={{
                        ...getStatusToggleStyle(color, active),
                        minHeight: '40px',
                        fontSize: '12px',
                        padding: '8px 10px',
                        borderRadius: '12px',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '999px',
                            background: active ? color : 'rgba(214, 214, 219, 0.7)',
                            boxShadow: active
                              ? `0 0 0 6px ${withAlpha(color, '2b')}`
                              : 'none',
                          }}
                        />
                        <span>{status.label}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
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
            className="card-preview-shell"
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
              className="card-preview-grid card-preview-content"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)',
                gap: '20px',
                alignItems: 'stretch',
                maxHeight: 'calc(92vh - 40px)',
                overflow: 'auto',
                paddingRight: '4px',
              }}
            >
              <div
                className="card-preview-art"
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
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))',
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
                  className="card-preview-counters"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '12px',
                  }}
                >
                  {counterControls.map((counter) => (
                    <div
                      key={counter.key}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '16px',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))',
                        border: `1px solid ${counterColors[counter.key]}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        minHeight: '108px',
                        boxShadow: previewCard.counters[counter.key] > 0
                          ? `inset 0 1px 0 ${withAlpha(counterColors[counter.key], '33')}`
                          : 'none',
                      }}
                    >
                      <div
                        style={{
                          minWidth: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div
                          style={{
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '15px',
                            lineHeight: 1.15,
                            wordBreak: 'break-word',
                          }}
                        >
                          {counter.label}
                        </div>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '5px 10px',
                            borderRadius: '999px',
                            background: withAlpha(counterColors[counter.key], '26'),
                            border: `1px solid ${withAlpha(counterColors[counter.key], '5c')}`,
                            color: '#f3f7fb',
                            fontSize: '10px',
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            minWidth: '52px',
                            flexShrink: 0,
                          }}
                        >
                          {counter.shortLabel}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto auto auto',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: '12px',
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
                            minWidth: '48px',
                            padding: '8px 12px',
                            borderRadius: '14px',
                            textAlign: 'center',
                            color: 'white',
                            fontWeight: 800,
                            fontSize: '22px',
                            fontVariantNumeric: 'tabular-nums',
                            background: withAlpha(counterColors[counter.key], previewCard.counters[counter.key] > 0 ? '1f' : '10'),
                            border: `1px solid ${withAlpha(counterColors[counter.key], previewCard.counters[counter.key] > 0 ? '52' : '2e')}`,
                            boxShadow: previewCard.counters[counter.key] > 0
                              ? `0 12px 30px ${withAlpha(counterColors[counter.key], '22')}`
                              : 'none',
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
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ color: 'rgba(255,255,255,0.62)', fontSize: '13px', marginBottom: '12px', letterSpacing: '0.08em' }}>
                    STATUS
                  </div>
                  <div className="card-preview-statuses" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                    {statusControls.map((status) => {
                      const active = previewCard.statuses[status.key]
                      const color = statusColors[status.key]
                      return (
                        <button
                          key={status.key}
                          onClick={() => toggleCardStatus(previewCard.id, status.key)}
                          style={getStatusToggleStyle(color, active)}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '10px',
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '999px',
                                background: active ? color : 'rgba(214, 214, 219, 0.7)',
                                boxShadow: active
                                  ? `0 0 0 6px ${withAlpha(color, '2b')}`
                                  : 'none',
                              }}
                            />
                            <span>{status.label}</span>
                          </span>
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
            .card-preview-content {
              max-height: calc(92vh - 40px);
            }
            .card-preview-art {
              min-height: auto !important;
            }
            .card-preview-counters {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
            .card-preview-statuses {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
            .card-preview-touch-counters {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .card-preview-touch-statuses {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }
          @media (max-width: 820px) {
            .card-preview-shell {
              width: min(100vw - 20px, 1260px) !important;
            }
            .card-preview-content {
              gap: 16px !important;
            }
            .card-preview-counters {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
            .card-preview-statuses {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
            .card-preview-touch-shell {
              width: min(52vw, 380px) !important;
            }
            .card-preview-touch-counters {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .card-preview-touch-statuses {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (max-width: 640px) {
            .card-preview-counters {
              grid-template-columns: 1fr !important;
            }
            .card-preview-statuses {
              grid-template-columns: 1fr !important;
            }
            .card-preview-touch-shell {
              width: min(100vw - 16px, 360px) !important;
              max-height: calc(100vh - 24px) !important;
            }
            .card-preview-touch-art {
              padding: 8px 8px 6px !important;
            }
            .card-preview-touch-counters {
              grid-template-columns: 1fr;
            }
            .card-preview-touch-statuses {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }
        `}
      </style>
    </>
  )
}

const stepperButtonStyle: React.CSSProperties = {
  width: '46px',
  height: '46px',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.08)',
  color: 'white',
  fontSize: '26px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const touchStepperButtonStyle: React.CSSProperties = {
  width: '30px',
  height: '30px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.08)',
  color: 'white',
  fontSize: '18px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
}
