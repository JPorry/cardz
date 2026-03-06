import { useEffect, useRef } from 'react';
import { SceneManager } from './game/SceneManager';
import { RadialMenu } from './components/RadialMenu';
import { CardPreview } from './components/CardPreview';
import { BoardMenu } from './components/BoardMenu';
import './index.css';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

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
      <BoardMenu />
      <RadialMenu />
      <CardPreview />
    </div>
  )
}

export default App;
