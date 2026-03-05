import React from 'react';
import { useGameStore } from '../store';

export const CardPreview: React.FC = () => {
  const { hoveredCardId, hoveredCardScreenX, previewCardId, cards, setPreviewCard } = useGameStore();

  const hoveredCard = cards.find((c) => c.id === hoveredCardId);
  const previewCard = cards.find((c) => c.id === previewCardId);

  if (!hoveredCard && !previewCard) return null;

  // Floating preview logic (desktop hover)
  const showHoverPreview = hoveredCard && !previewCardId && hoveredCard.faceUp && hoveredCard.artworkUrl;
  const isHoveredLeft = hoveredCardScreenX !== null && hoveredCardScreenX < window.innerWidth / 2;

  // Big preview logic (double tap/click)
  const showBigPreview = !!previewCard;

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
            width: '300px',
            height: '420px',
            zIndex: 1000,
            pointerEvents: 'none',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease-out',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <img
            src={hoveredCard.artworkUrl}
            alt={hoveredCard.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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
          onClick={() => setPreviewCard(null)}
        >
          <div
            style={{
              maxHeight: '90vh',
              maxWidth: '90vw',
              width: 'auto',
              aspectRatio: '1 / 1.4',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              background: '#111',
              position: 'relative',
              animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewCard?.artworkUrl}
              alt={previewCard?.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            <button
              onClick={() => setPreviewCard(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.1)',
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
