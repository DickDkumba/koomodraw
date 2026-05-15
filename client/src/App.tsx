import { useState } from 'react';
import { Header } from './components/Header/Header';
import { Toolbar } from './components/Toolbar/Toolbar';
import { DrawingCanvas } from './components/Canvas/DrawingCanvas';
import { FileManager } from './components/FileManager/FileManager';
import { PropertiesPanel } from './components/PropertiesPanel/PropertiesPanel';
import { SceneBar } from './components/SceneBar/SceneBar';
import { DocumentView } from './components/DocumentView/DocumentView';
import { ExamplesModal } from './components/Examples/ExamplesModal';
import { RecordingBar } from './components/RecordingBar/RecordingBar';
import { useSceneStore } from './store/sceneStore';
import './App.css';

export default function App() {
  const [docViewOpen,   setDocViewOpen]   = useState(false);
  const [examplesOpen,  setExamplesOpen]  = useState(false);
  const appMode = useSceneStore((s) => s.appMode);
  const isPlay = appMode === 'play';

  return (
    <div className="app">
      <Header onOpenDocument={() => setDocViewOpen(true)} onOpenExamples={() => setExamplesOpen(true)} />
      <div className="app__workspace">
        {!isPlay && <Toolbar />}
        <DrawingCanvas />
        {!isPlay && <PropertiesPanel />}
      </div>
      {!isPlay && <SceneBar />}
      <RecordingBar />
      <FileManager />
      <DocumentView isOpen={docViewOpen} onClose={() => setDocViewOpen(false)} />
      <ExamplesModal isOpen={examplesOpen} onClose={() => setExamplesOpen(false)} />
    </div>
  );
}
