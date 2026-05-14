import { Header } from './components/Header/Header';
import { Toolbar } from './components/Toolbar/Toolbar';
import { DrawingCanvas } from './components/Canvas/DrawingCanvas';
import { FileManager } from './components/FileManager/FileManager';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <Header />
      <div className="app__workspace">
        <Toolbar />
        <DrawingCanvas />
      </div>
      <FileManager />
    </div>
  );
}
