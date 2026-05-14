import { useState } from 'react';
import { Header } from './components/Header/Header';
import { Toolbar } from './components/Toolbar/Toolbar';
import { DrawingCanvas } from './components/Canvas/DrawingCanvas';
import { FileManager } from './components/FileManager/FileManager';
import { PropertiesPanel } from './components/PropertiesPanel/PropertiesPanel';
import { SceneBar } from './components/SceneBar/SceneBar';
import { DocumentView } from './components/DocumentView/DocumentView';
import './App.css';

export default function App() {
  const [docViewOpen, setDocViewOpen] = useState(false);

  return (
    <div className="app">
      <Header onOpenDocument={() => setDocViewOpen(true)} />
      <div className="app__workspace">
        <Toolbar />
        <DrawingCanvas />
        <PropertiesPanel />
      </div>
      <SceneBar />
      <FileManager />
      <DocumentView isOpen={docViewOpen} onClose={() => setDocViewOpen(false)} />
    </div>
  );
}
