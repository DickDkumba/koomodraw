import { useRef } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import { useFileStore } from '../../store/fileStore';
import type { SavedFile } from '../../types/scene';
import './Header.css';

interface HeaderProps {
  onOpenDocument: () => void;
  onOpenExamples: () => void;
}

export function Header({ onOpenDocument, onOpenExamples }: HeaderProps) {
  const fileName = useSceneStore((s) => s.fileName);
  const fileId   = useSceneStore((s) => s.fileId);
  const scenes   = useSceneStore((s) => s.scenes);
  const setFileName = useSceneStore((s) => s.setFileName);
  const objects  = useObjectStore((s) => s.objects);
  const { persist, openManager } = useFileStore();

  const inputRef = useRef<HTMLInputElement>(null);

  function buildPayload(name: string, id: string): SavedFile {
    // Collect all objects referenced by any scene
    const allIds = new Set(scenes.flatMap((s) => s.objectIds));
    return {
      id,
      name,
      savedAt: Date.now(),
      sceneData: JSON.stringify({
        fileId: id,
        fileName: name,
        scenes,
        objects: Object.fromEntries([...allIds].map((oid) => [oid, objects[oid]])),
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
