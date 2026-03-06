import { useEffect, useRef, useState } from 'react';

const MENU_OPTIONS = [
  { id: 'new-game', label: 'New Game', detail: 'Start a fresh setup' },
  { id: 'save-layout', label: 'Save Layout', detail: 'Store the current board state' },
  { id: 'load-layout', label: 'Load Layout', detail: 'Restore a saved board state' },
  { id: 'settings', label: 'Settings', detail: 'Adjust board and interaction options' },
  { id: 'help', label: 'Help', detail: 'Open the quick reference guide' },
];

export function BoardMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="board-menu" ref={rootRef}>
      <button
        type="button"
        className="board-menu__trigger"
        aria-label="Open board menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="board-menu__trigger-line" />
        <span className="board-menu__trigger-line" />
        <span className="board-menu__trigger-line" />
      </button>

      {isOpen ? (
        <div className="board-menu__panel" role="menu" aria-label="Board actions">
          <div className="board-menu__header">
            <span className="board-menu__eyebrow">Board</span>
            <strong className="board-menu__title">Game Menu</strong>
          </div>

          <div className="board-menu__options">
            {MENU_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="board-menu__option"
                role="menuitem"
                onClick={() => setIsOpen(false)}
              >
                <span className="board-menu__option-label">{option.label}</span>
                <span className="board-menu__option-detail">{option.detail}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
