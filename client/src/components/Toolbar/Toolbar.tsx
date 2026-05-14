import { useSceneStore } from '../../store/sceneStore';
import type { ShapeType } from '../../types/shapes';
import './Toolbar.css';

interface ToolDef {
  type: ShapeType | 'select';
  label: string;
  icon: string;
  title: string;
}

const TOOLS: ToolDef[] = [
  { type: 'select',    label: 'Select',    icon: '↖',  title: 'Select (V)' },
  { type: 'arrow',     label: 'Arrow',     icon: '→',  title: 'Arrow (A)' },
  { type: 'line',      label: 'Line',      icon: '╱',  title: 'Line (L)' },
  { type: 'rectangle', label: 'Rect',      icon: '▭',  title: 'Rectangle (R)' },
  { type: 'circle',    label: 'Circle',    icon: '○',  title: 'Circle (C)' },
  { type: 'diamond',   label: 'Diamond',   icon: '◇',  title: 'Diamond (D)' },
  { type: 'text',      label: 'Text',      icon: 'T',  title: 'Text (T)' },
  { type: 'database',  label: 'Database',  icon: '⊞',  title: 'Database (B)' },
  { type: 'cylinder',  label: 'Cylinder',  icon: '⌭',  title: 'Cylinder (Y)' },
];

interface ToolbarProps {
  onDropShape?: (type: ShapeType, x: number, y: number) => void;
}

export function Toolbar({ onDropShape }: ToolbarProps = {}) {
  const activeTool = useSceneStore((s) => s.activeTool);
  const setActiveTool = useSceneStore((s) => s.setActiveTool);

  function handleDragStart(e: React.DragEvent, tool: ToolDef) {
    if (tool.type === 'select') return;
    e.dataTransfer.setData('koomodraw/shape', tool.type);
    e.dataTransfer.effectAllowed = 'copy';
  }

  function handleDoubleClick(tool: ToolDef) {
    if (tool.type === 'select') return;
    onDropShape?.(tool.type as ShapeType, 160, 200);
  }

  return (
    <aside className="toolbar">
      {TOOLS.map((tool) => (
        <button
          key={tool.type}
          className={`toolbar__item ${activeTool === tool.type ? 'toolbar__item--active' : ''}`}
          title={tool.title}
          onClick={() => setActiveTool(tool.type)}
          onDoubleClick={() => handleDoubleClick(tool)}
          draggable={tool.type !== 'select'}
          onDragStart={(e) => handleDragStart(e, tool)}
          aria-label={tool.label}
          aria-pressed={activeTool === tool.type}
        >
          <span className="toolbar__icon">{tool.icon}</span>
          <span className="toolbar__label">{tool.label}</span>
        </button>
      ))}
    </aside>
  );
}
