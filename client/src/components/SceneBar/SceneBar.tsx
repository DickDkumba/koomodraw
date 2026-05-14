import { useState, useRef, useEffect } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import './SceneBar.css';

export function SceneBar() {
  const scenes           = useSceneStore((s) => s.scenes);
  const activeIndex      = useSceneStore((s) => s.activeSceneIndex);
  const activateScene    = useSceneStore((s) => s.activateScene);
  const addScene         = useSceneStore((s) => s.addScene);
  const removeScene      = useSceneStore((s) => s.removeScene);
  const renameScene      = useSceneStore((s) => s.renameScene);
  const navigateScene    = useSceneStore((s) => s.navigateScene);

  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editValue, setEditValue]   = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Close add-menu on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingId) editInputRef.current?.select();
  }, [editingId]);

  function startRename(id: string, name: string) {
    setEditingId(id);
    setEditValue(name);
  }

  function commitRename() {
    if (editingId) {
      renameScene(editingId, editValue.trim() || 'Scene');
      setEditingId(null);
    }
  }

  function handleAddScene(mode: 'clear' | 'inherit') {
    addScene(mode);
    setShowAddMenu(false);
  }

  function handleRemove(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (scenes.length === 1) return;
    removeScene(id);
  }

  const atFirst = activeIndex === 0;
  const atLast  = activeIndex === scenes.length - 1;

  return (
    <div className="scene-bar">
      {/* Prev arrow */}
      <button
        className="scene-bar__nav"
        disabled={atFirst}
        onClick={() => navigateScene(-1)}
        title="Previous scene"
        aria-label="Previous scene"
      >‹</button>

      {/* Scene tabs */}
      <div className="scene-bar__tabs">
        {scenes.map((s, i) => (
          <div
            key={s.id}
            className={`scene-tab ${i === activeIndex ? 'scene-tab--active' : ''}`}
            onClick={() => activateScene(s.id)}
            onDoubleClick={() => startRename(s.id, s.name)}
            title="Click to select · Double-click to rename"
          >
            {editingId === s.id ? (
              <input
                ref={editInputRef}
                className="scene-tab__rename"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingId(null);
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="scene-tab__name">{s.name}</span>
            )}
            {scenes.length > 1 && (
              <button
                className="scene-tab__close"
                onClick={(e) => handleRemove(e, s.id)}
                title="Remove scene"
                aria-label="Remove scene"
              >✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Next arrow */}
      <button
        className="scene-bar__nav"
        disabled={atLast}
        onClick={() => navigateScene(1)}
        title="Next scene"
        aria-label="Next scene"
      >›</button>

      {/* Add scene */}
      <div className="scene-bar__add-wrap" ref={addMenuRef}>
        <button
          className="scene-bar__add"
          onClick={() => setShowAddMenu((v) => !v)}
          title="Add scene"
          aria-label="Add scene"
        >+ Scene</button>

        {showAddMenu && (
          <div className="scene-add-menu">
            <button className="scene-add-menu__item" onClick={() => handleAddScene('clear')}>
              <span className="scene-add-menu__icon">□</span>
              <span>
                <strong>Empty</strong>
                <span className="scene-add-menu__desc">Blank new scene</span>
              </span>
            </button>
            <button className="scene-add-menu__item" onClick={() => handleAddScene('inherit')}>
              <span className="scene-add-menu__icon">⊞</span>
              <span>
                <strong>Inherit</strong>
                <span className="scene-add-menu__desc">Copy current scene's objects</span>
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
