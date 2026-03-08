import { useEffect, useRef, useState } from 'react'
import { SceneManager } from './game/SceneManager'
import { SelectionOverlay } from './components/SelectionOverlay'
import { CardPreview } from './components/CardPreview'
import { BoardMenu } from './components/BoardMenu'
import { NewGameModal } from './components/NewGameModal'
import { BoardShortcuts } from './components/BoardShortcuts'
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal'
import { useGameStore } from './store'
import { parseGameSessionFileContent, persistImportedGameSession, startGameSessionAutosave, bootstrapStoredGameSession } from './sessionPersistence'
import './index.css'

function createSessionFileName() {
  return `marvel-session-${new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '')}.json`
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isNewGameOpen, setIsNewGameOpen] = useState(false)
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false)
  const isExaminingStack = useGameStore((state) => state.examinedStack !== null)

  useEffect(() => {
    bootstrapStoredGameSession()
    const stopAutosave = startGameSessionAutosave()
    if (!containerRef.current) return stopAutosave

    // Initialize our imperative THREE.js logic
    const sceneManager = new SceneManager(containerRef.current)

    // Cleanup on unmount
    return () => {
      stopAutosave()
      sceneManager.destroy()
    }
  }, [])

  const handleExportState = () => {
    const session = useGameStore.getState().exportGameSession()
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' })
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = createSessionFileName()
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  }

  const handleLoadState = async (file: File) => {
    try {
      const content = await file.text()
      const session = parseGameSessionFileContent(content)
      useGameStore.getState().importGameSession(session)
      persistImportedGameSession(session)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load the selected game state.'
      window.alert(message)
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
      <BoardMenu
        onStartNewGame={() => setIsNewGameOpen(true)}
        onExportState={handleExportState}
        onLoadState={handleLoadState}
        onOpenKeyboardShortcuts={() => setIsKeyboardShortcutsOpen(true)}
      />
      <BoardShortcuts disabled={isNewGameOpen || isExaminingStack || isKeyboardShortcutsOpen} />
      <SelectionOverlay />
      <CardPreview />
      <NewGameModal isOpen={isNewGameOpen} onClose={() => setIsNewGameOpen(false)} />
      <KeyboardShortcutsModal isOpen={isKeyboardShortcutsOpen} onClose={() => setIsKeyboardShortcutsOpen(false)} />
    </div>
  )
}

export default App
