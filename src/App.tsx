import { useEffect, useRef } from 'react';
import { SceneManager } from './game/SceneManager';
import { RadialMenu } from './components/RadialMenu';
import { CardPreview } from './components/CardPreview';
import { useGameStore } from './store';
import './index.css';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load initial random cards
    useGameStore.getState().loadRandomCards();
  }, []);

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
            <div 
        style={{ 
          position: 'absolute', 
          top: '20px', 
          right: '20px', 
          padding: '10px 20px',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: 'white',
          borderRadius: '8px',
          cursor: 'pointer',
          zIndex: 100
        }}
        onClick={() => useGameStore.getState().loadRandomCards()}
      >
        Refresh Cards
      </div>
      <RadialMenu />
      <CardPreview />
    </div>
  )
}

export default App;
