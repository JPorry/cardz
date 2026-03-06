import { useEffect, useRef, useState } from 'react';
import { SceneManager } from './game/SceneManager';
import { SelectionOverlay } from './components/SelectionOverlay';
import { CardPreview } from './components/CardPreview';
import { BoardMenu } from './components/BoardMenu';
import { NewGameModal } from './components/NewGameModal';
import { BoardShortcuts } from './components/BoardShortcuts';
import { ExamineStackModal } from './components/ExamineStackModal';
import { useGameStore } from './store';
import './index.css';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNewGameOpen, setIsNewGameOpen] = useState(false)
  const isExaminingStack = useGameStore((state) => state.examinedStack !== null)

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initialize our imperative THREE.js logic
    const sceneManager = new SceneManager(containerRef.current);
    
    // Cleanup on unmount
    return () => {
      sceneManager.destroy();
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
      <BoardMenu onStartNewGame={() => setIsNewGameOpen(true)} />
      <BoardShortcuts disabled={isNewGameOpen || isExaminingStack} />
      <SelectionOverlay />
      <CardPreview />
      <NewGameModal isOpen={isNewGameOpen} onClose={() => setIsNewGameOpen(false)} />
      <ExamineStackModal />
    </div>
  )
}

export default App;
