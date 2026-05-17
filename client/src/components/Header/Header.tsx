import { useRef, useState } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import { useFileStore } from '../../store/fileStore';
import { useRecordingStore } from '../../store/recordingStore';
import { useEventLogStore } from '../../store/eventLogStore';
import { useCommandStore } from '../../store/commandStore';
import type { SavedFile } from '../../types/scene';
import './Header.css';

interface HeaderProps {
  onOpenDocument: () => void;
  onOpenExamples: () => void;
}

export function Header({ onOpenDocument, onOpenExamples }: HeaderProps) {
  const fileName   = useSceneStore((s) => s.fileName);
  const fileId     = useSceneStore((s) => s.fileId);
  const scenes     = useSceneStore((s) => s.scenes);
  const setFileName = useSceneStore((s) => s.setFileName);
  const appMode    = useSceneStore((s) => s.appMode);
  const setAppMode = useSceneStore((s) => s.setAppMode);
  const objects    = useObjectStore((s) => s.objects);
  const { persist, openManager } = useFileStore();
  const canUndo = useCommandStore((s) => s.canUndo);
  const canRedo = useCommandStore((s) => s.canRedo);
  const undo    = useCommandStore((s) => s.undo);
  const redo    = useCommandStore((s) => s.redo);

  const inputRef = useRef<HTMLInputElement>(null);
  const [logOpen, setLogOpen] = useState(false);
  const logEntries = useEventLogStore((s) => s.entries);
  const clearLog   = useEventLogStore((s) => s.clear);

  function buildPayload(name: string, id: string): SavedFile {
    const rec = useRecordingStore.getState();
    return {
      id,
      name,
      savedAt: Date.now(),
      sceneData: JSON.stringify({
        fileId: id,
        fileName: name,
        scenes,
        objects,  // save all objects (includes group children)
        recording: {
          keyframes: rec.keyframes,
          duration: rec.duration,
          timelineDuration: rec.timelineDuration,
        },
      }),
    };
  }

  function handleSave() {
    persist(buildPayload(fileName, fileId));
  }

  function handleSaveAs() {
    const name = window.prompt('Save as…', fileName + ' copy');
    if (name === null) return;
    const trimmed = name.trim() || 'Untitled';
    const newId = crypto.randomUUID();
    persist(buildPayload(trimmed, newId));
    setFileName(trimmed);
    useSceneStore.setState({ fileId: newId });
  }

  function handleNew() {
    const hasContent = scenes.some((s) => s.objectIds.length > 0);
    const confirmed = !hasContent || window.confirm('Start a new document? Unsaved changes will be lost.');
    if (!confirmed) return;
    useSceneStore.getState().resetScene();
    useObjectStore.getState().setObjects({});
  }

  return (
    <header className="app-header">
      <div className="app-header__left">
        <span className="app-header__logo">kooMoDraw</span>
        <input
          ref={inputRef}
          className="app-header__filename"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          aria-label="Document name"
          spellCheck={false}
        />
      </div>

      <div className="app-header__mode">
        <button
          className={`hbtn hbtn--mode${appMode === 'edit' ? ' hbtn--mode-active' : ''}`}
          onClick={() => setAppMode('edit')}
        >
          Edit
        </button>
        <button
          className={`hbtn hbtn--mode${appMode === 'play' ? ' hbtn--mode-active hbtn--play' : ''}`}
          onClick={() => setAppMode('play')}
        >
          Play
        </button>
      </div>

      <div className="app-header__undo">
        <button
          className="hbtn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          className="hbtn"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>
      </div>

      <div className="app-header__log-wrap">
        <button
          className={`hbtn hbtn--log${logEntries.length > 0 ? ' hbtn--log-active' : ''}`}
          onClick={() => setLogOpen(!logOpen)}
          title="Event log"
        >
          Log {logEntries.length > 0 && <span className="hbtn__badge">{logEntries.length}</span>}
        </button>
        {logOpen && (
          <div className="event-log">
            <div className="event-log__header">
              <span>Event Log</span>
              <button className="event-log__clear" onClick={clearLog} title="Clear">Clear</button>
            </div>
            <div className="event-log__list">
              {logEntries.length === 0 && (
                <div className="event-log__empty">No events fired yet</div>
              )}
              {logEntries.map((e) => (
                <div key={e.id} className="event-log__row">
                  <span className="event-log__time">
                    {new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="event-log__trigger">{e.trigger}</span>
                  <span className="event-log__arrow">&rarr;</span>
                  <span className="event-log__action">{e.action}</span>
                  <span className="event-log__source" title={e.sourceName}>{e.sourceName}</span>
                  {e.targetName && <span className="event-log__target" title={e.targetName}>&rarr; {e.targetName}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <nav className="app-header__actions">
        <button className="hbtn" onClick={onOpenExamples} title="Browse example documents">
          Examples
        </button>
        <button className="hbtn" onClick={handleNew} title="New document">
          New
        </button>
        <button className="hbtn hbtn--primary" onClick={handleSave} title="Save">
          Save
        </button>
        <button className="hbtn" onClick={handleSaveAs} title="Save as a new file">
          Save As…
        </button>
        <button className="hbtn" onClick={openManager} title="Open saved files">
          Open…
        </button>
        <button className="hbtn" onClick={onOpenDocument} title="View document JSON">
          Document
        </button>
      </nav>
    </header>
  );
}
