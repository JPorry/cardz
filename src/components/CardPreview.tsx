import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store';

const PORTRAIT_RATIO = 1 / 1.4;
const HOVER_PORTRAIT_HEIGHT = 420;
const HOVER_LANDSCAPE_WIDTH = 420;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export const CardPreview: React.FC = () => {
  const { hoveredCardId, hoveredCardScreenX, previewCardId, cards, setPreviewCard } = useGameStore();
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({});
  const [supportsHoverPreview, setSupportsHoverPreview] = useState(true);
  const previewOpenedAtRef = useRef<number | null>(null);

  const hoveredCard = cards.find((c) => c.id === hoveredCardId);
  const previewCard = cards.find((c) => c.id === previewCardId);
  const getVisibleArtworkUrl = (card?: typeof hoveredCard) => {
    if (!card) return undefined;
    return card.faceUp
      ? card.artworkUrl
      : card.backArtworkUrl;
  };
  const hoveredArtworkUrl = getVisibleArtworkUrl(hoveredCard);
  const previewArtworkUrl = getVisibleArtworkUrl(previewCard);

  useEffect(() => {
    const urls = [hoveredArtworkUrl, previewArtworkUrl].filter(Boolean) as string[];

    urls.forEach((url) => {
      if (imageAspectRatios[url]) return;

      const img = new Image();
      img.onload = () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        setImageAspectRatios((current) => {
          if (current[url]) return current;
          return { ...current, [url]: img.naturalWidth / img.naturalHeight };
        });
      };
      img.src = url;
    });
  }, [hoveredArtworkUrl, previewArtworkUrl, imageAspectRatios]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updateSupportsHoverPreview = () => setSupportsHoverPreview(mediaQuery.matches);

    updateSupportsHoverPreview();
    mediaQuery.addEventListener('change', updateSupportsHoverPreview);

    return () => mediaQuery.removeEventListener('change', updateSupportsHoverPreview);
  }, []);

  useEffect(() => {
    previewOpenedAtRef.current = previewCardId ? performance.now() : null;
  }, [previewCardId]);

  if (!hoveredCard && !previewCard) return null;

  // Floating preview logic (desktop hover)
  const showHoverPreview = supportsHoverPreview && hoveredCard && !previewCardId && hoveredArtworkUrl;
  const isHoveredLeft = hoveredCardScreenX !== null && hoveredCardScreenX < window.innerWidth / 2;

  // Big preview logic (double tap/click)
  const showBigPreview = !!previewCard;

  const getAspectRatio = (artworkUrl?: string) => {
    if (!artworkUrl) return PORTRAIT_RATIO;
    return imageAspectRatios[artworkUrl] ?? PORTRAIT_RATIO;
  };

  const hoverAspectRatio = getAspectRatio(hoveredArtworkUrl);
  const hoverIsLandscape = hoverAspectRatio > 1;
  const hoverWidth = hoverIsLandscape
    ? HOVER_LANDSCAPE_WIDTH
    : Math.round(HOVER_PORTRAIT_HEIGHT * hoverAspectRatio);
  const hoverHeight = hoverIsLandscape
    ? Math.round(HOVER_LANDSCAPE_WIDTH / hoverAspectRatio)
    : HOVER_PORTRAIT_HEIGHT;

  const previewAspectRatio = getAspectRatio(previewArtworkUrl);
  const previewWidthVw = clamp(previewAspectRatio * 72, 32, 90);
  const previewHeightVh = clamp(72 / previewAspectRatio, 40, 90);
  const closePreview = () => {
    if (previewOpenedAtRef.current !== null && performance.now() - previewOpenedAtRef.current < 250) return;
    setPreviewCard(null);
  };

  return (
    <>
      {/* Floating Hover Preview */}
      {showHoverPreview && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            [isHoveredLeft ? 'right' : 'left']: '40px',
            width: `${hoverWidth}px`,
            height: `${hoverHeight}px`,
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
          <img
            src={hoveredArtworkUrl}
            alt={hoveredCard.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '10px' }}
          />
        </div>
      )}

      {/* Big Fullscreen Preview */}
      {showBigPreview && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(5px)',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={closePreview}
        >
          <div
            style={{
              width: `${previewWidthVw}vw`,
              height: `${previewHeightVh}vh`,
              maxHeight: '90vh',
              maxWidth: '90vw',
              aspectRatio: `${previewAspectRatio}`,
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(12,12,12,0.96)',
              position: 'relative',
              animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              padding: '18px',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewArtworkUrl}
              alt={previewCard?.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px' }}
            />
            <button
              onClick={closePreview}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                width: '40px',
                height: '40px',
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
              }}
            >
              ×
            </button>
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
        `}
      </style>
    </>
  );
};
