import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import { EXAMPLES } from '../../examples';
import type { ExampleDoc } from '../../examples';
import './ExamplesModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ExamplesModal({ isOpen, onClose }: Props) {
  const loadAll    = useSceneStore((s) => s.loadAll);
  const setObjects = useObjectStore((s) => s.setObjects);

  if (!isOpen) return null;

  function handleOpen(ex: ExampleDoc) {
    loadAll(ex.name, crypto.randomUUID(), ex.scenes);
    setObjects(ex.objects);
    onClose();
  }

  return (
    <div className="ex-overlay" onClick={onClose}>
      <div
        className="ex-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Example documents"
      >
        <div className="ex-header">
          <div>
            <h2 className="ex-title">Examples</h2>
            <p className="ex-subtitle">Open a sample diagram. Save it anytime under your own name.</p>
          </div>
          <button className="ex-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <ul className="ex-list">
          {EXAMPLES.map((ex, i) => (
            <li key={i} className="ex-card">
              <div className="ex-card__info">
                <span className="ex-card__name">{ex.name}</span>
                <span className="ex-card__desc">{ex.description}</span>
              </div>
              <button className="ex-card__btn" onClick={() => handleOpen(ex)}>
                Open
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
