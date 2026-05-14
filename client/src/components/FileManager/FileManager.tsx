import { useFileStore } from '../../store/fileStore';
import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import type { SavedFile } from '../../types/scene';
import './FileManager.css';

export function FileManager() {
  const { files, isOpen, closeManager, remove } = useFileStore();
  const loadScene = useSceneStore((s) => s.loadScene);
  const setObjects = useObjectStore((s) => s.setObjects);

  if (!isOpen) return null;

  function handleLoad(file: SavedFile) {
    try {
      const { scene, objects } = JSON.parse(file.sceneData);
      loadScene(scene);
      setObjects(objects);
      closeManager();
    } catch {
      alert('Failed to load file. Data may be corrupted.');
    }
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (window.confirm('Delete this saved file?')) {
      remove(id);
    }
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="fm-overlay" onClick={closeManager}>
      <div className="fm-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Open file">
        <div className="fm-header">
          <h2 className="fm-title">Saved Files</h2>
          <button className="fm-close" onClick={closeManager} aria-label="Close">✕</button>
        </div>

        {files.length === 0 ? (
          <p className="fm-empty">No saved files yet. Use Save to store your work.</p>
        ) : (
          <ul className="fm-list">
            {files.map((file) => (
              <li key={file.id} className="fm-item" onClick={() => handleLoad(file)}>
                <div className="fm-item__info">
                  <span className="fm-item__name">{file.name}</span>
                  <span className="fm-item__date">{formatDate(file.savedAt)}</span>
                </div>
                <button
                  className="fm-item__delete"
                  onClick={(e) => handleDelete(e, file.id)}
                  title="Delete"
                  aria-label="Delete file"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
