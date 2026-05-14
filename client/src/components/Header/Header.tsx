import { useRef } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import { useFileStore } from '../../store/fileStore';
import type { SavedFile } from '../../types/scene';
import './Header.css';

export function Header() {
  const sceneName = useSceneStore((s) => s.scene.name);
  const scene = useSceneStore((s) => s.scene);
  const setSceneName = useSceneStore((s) => s.setSceneName);
  const objects = useObjectStore((s) => s.objects);
  const { persist, openManager } = useFileStore();

  const inputRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    const file: SavedFile = {
      id: scene.id,
      name: scene.name,
      savedAt: Date.now(),
      sceneData: JSON.stringify({
        scene,
        objects: Object.fromEntries(
          scene.objectIds.map((id) => [id, objects[id]])
        ),
      }),
    };
    persist(file);
  }

  function handleNew() {
    const confirmed = scene.objectIds.length === 0 ||
      window.confirm('Start a new scene? Unsaved changes will be lost.');
    if (!confirmed) return;
    const newScene = useSceneStore.getState().scene;
    useSceneStore.getState().resetScene();
    void newScene;
  }

  return (
    <header className="app-header">
      <div className="app-header__left">
        <span className="app-header__logo">kooMoDraw</span>
        <input
          ref={inputRef}
          className="app-header__filename"
          value={sceneName}
          onChange={(e) => setSceneName(e.target.value)}
          aria-label="Scene name"
          spellCheck={false}
        />
      </div>

      <nav className="app-header__actions">
        <button className="hbtn" onClick={handleNew} title="New scene">
          New
        </button>
        <button className="hbtn hbtn--primary" onClick={handleSave} title="Save to local storage">
          Save
        </button>
        <button className="hbtn" onClick={openManager} title="Open saved files">
          Open…
        </button>
      </nav>
    </header>
  );
}
