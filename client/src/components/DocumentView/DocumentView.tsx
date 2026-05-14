import { useState, useMemo } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import './DocumentView.css';

interface DocumentViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentView({ isOpen, onClose }: DocumentViewProps) {
  const fileName  = useSceneStore((s) => s.fileName);
  const fileId    = useSceneStore((s) => s.fileId);
  const scenes    = useSceneStore((s) => s.scenes);
  const objects   = useObjectStore((s) => s.objects);
  const [copied, setCopied] = useState(false);

  const json = useMemo(() => {
    const allIds = new Set(scenes.flatMap((s) => s.objectIds));
    return JSON.stringify(
      {
        fileId,
        fileName,
        scenes,
        objects: Object.fromEntries([...allIds].map((id) => [id, objects[id]])),
      },
      null,
      2
    );
  }, [fileId, fileName, scenes, objects]);

  function handleCopy() {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  if (!isOpen) return null;

  return (
    <div className="dv-overlay" onClick={onClose}>
      <div className="dv-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Document view">
        <div className="dv-header">
          <div className="dv-header__left">
            <h2 className="dv-title">Document JSON</h2>
            <span className="dv-meta">
              {scenes.length} scene{scenes.length !== 1 ? 's' : ''} ·{' '}
              {Object.keys(objects).length} objects
            </span>
          </div>
          <div className="dv-header__right">
            <button className="dv-btn" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button className="dv-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <pre className="dv-body">{json}</pre>
      </div>
    </div>
  );
}
