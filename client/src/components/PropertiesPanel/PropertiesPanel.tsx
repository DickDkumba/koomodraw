import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import type { Shape, ShapeType } from '../../types/shapes';
import './PropertiesPanel.css';

const TYPE_ICON: Record<ShapeType, string> = {
  arrow: '→', line: '╱', squiggle: '∿',
  rectangle: '▭', circle: '○', diamond: '◇',
  triangle: '△', text: 'T', database: '⊞', cylinder: '⌭',
};

function fmtMs(ms: number): string {
  return (ms / 1000).toFixed(1);
}

export function PropertiesPanel() {
  const selectedIds    = useSceneStore((s) => s.selectedIds);
  const sceneName      = useSceneStore((s) => s.scene.name);
  const sceneIndex     = useSceneStore((s) => s.activeSceneIndex);
  const totalScenes    = useSceneStore((s) => s.scenes.length);
  const sceneObjectIds = useSceneStore((s) => s.scene.objectIds);
  const objectCount    = sceneObjectIds.length;
  const objects        = useObjectStore((s) => s.objects);
  const updateObject   = useObjectStore((s) => s.updateObject);

  const ids = [...selectedIds];

  const SceneInfo = (
    <section className="props-section">
      <div className="props-section__title">Scene</div>
      <div className="props-scene-info">
        <span className="props-scene-name">{sceneName}</span>
        <span className="props-scene-meta">
          {sceneIndex + 1} / {totalScenes} · {objectCount} object{objectCount !== 1 ? 's' : ''}
        </span>
      </div>
    </section>
  );

  // Scene Objects: full list with visibility cuepoints — always shown
  const SceneObjects = (
    <section className="props-section props-section--objects">
      <div className="props-section__title">Scene Objects</div>
      {sceneObjectIds.length === 0 && (
        <span className="props-panel__empty" style={{ padding: '4px 0', fontSize: 11 }}>No objects</span>
      )}
      {sceneObjectIds.map((id) => {
        const s = objects[id];
        if (!s) return null;
        const name = s.label?.trim() || s.type;
        const icon = TYPE_ICON[s.type] ?? '?';
        const secVal = s.visibleFrom !== undefined ? fmtMs(s.visibleFrom) : '';
        return (
          <div key={id} className="props-obj-row">
            <span className="props-obj-icon">{icon}</span>
            <span className="props-obj-name" title={name}>{name}</span>
            <input
              className="props-obj-time"
              type="number"
              min="0"
              step="0.1"
              placeholder="0"
              title="Visible from (seconds)"
              value={secVal}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') {
                  updateObject(id, { visibleFrom: undefined });
                } else {
                  const sec = parseFloat(raw);
                  if (!isNaN(sec) && sec >= 0) updateObject(id, { visibleFrom: Math.round(sec * 1000) });
                }
              }}
            />
            <span className="props-obj-unit">s</span>
          </div>
        );
      })}
    </section>
  );

  if (ids.length === 0) {
    return (
      <aside className="props-panel">
        <div className="props-panel__header">Properties</div>
        {SceneInfo}
        <div className="props-panel__empty">No selection</div>
        {SceneObjects}
      </aside>
    );
  }

  if (ids.length > 1) {
    return (
      <aside className="props-panel">
        <div className="props-panel__header">Properties</div>
        {SceneInfo}
        <div className="props-panel__empty">{ids.length} objects selected</div>
        {SceneObjects}
      </aside>
    );
  }

  const shape = objects[ids[0]];
  if (!shape) return null;

  function update(patch: Partial<Shape>) {
    updateObject(ids[0], patch);
  }

  function numInput(label: string, value: number, key: keyof Shape, min?: number) {
    return (
      <label className="props-field">
        <span className="props-field__label">{label}</span>
        <input
          className="props-field__input props-field__input--num"
          type="number"
          value={Math.round(value)}
          min={min}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) update({ [key]: v } as Partial<Shape>);
          }}
        />
      </label>
    );
  }

  function colorInput(label: string, value: string, key: keyof Shape) {
    return (
      <label className="props-field">
        <span className="props-field__label">{label}</span>
        <span className="props-color-wrap">
          <input
            className="props-color-swatch"
            type="color"
            value={value.startsWith('#') ? value : '#ffffff'}
            onChange={(e) => update({ [key]: e.target.value } as Partial<Shape>)}
          />
          <input
            className="props-field__input props-color-hex"
            type="text"
            value={value}
            onChange={(e) => update({ [key]: e.target.value } as Partial<Shape>)}
            spellCheck={false}
            maxLength={20}
          />
        </span>
      </label>
    );
  }

  const isLinear = shape.type === 'line' || shape.type === 'arrow';

  return (
    <aside className="props-panel">
      <div className="props-panel__header">Properties</div>

      {SceneInfo}

      <section className="props-section">
        <div className="props-section__title">Type</div>
        <div className="props-type-badge">{shape.type}</div>
      </section>

      <section className="props-section">
        <div className="props-section__title">Position</div>
        <div className="props-row">
          {numInput('X', shape.x, 'x')}
          {numInput('Y', shape.y, 'y')}
        </div>
      </section>

      <section className="props-section">
        <div className="props-section__title">{isLinear ? 'Extent' : 'Size'}</div>
        <div className="props-row">
          {numInput('W', shape.width, 'width', 20)}
          {numInput('H', shape.height, 'height', 20)}
        </div>
      </section>

      <section className="props-section">
        <div className="props-section__title">Style</div>
        {colorInput('Stroke', shape.strokeColor, 'strokeColor')}
        {!isLinear && colorInput('Fill', shape.fillColor, 'fillColor')}
        {numInput('Line', shape.strokeWidth, 'strokeWidth', 0.5)}
      </section>

      {!isLinear && (
        <section className="props-section">
          <div className="props-section__title">Label</div>
          <input
            className="props-field__input props-label-input"
            type="text"
            value={shape.label}
            placeholder="Label…"
            onChange={(e) => update({ label: e.target.value })}
          />
        </section>
      )}

      {shape.type === 'text' && (
        <section className="props-section">
          <div className="props-section__title">Font</div>
          {numInput('Size', (shape as { fontSize: number }).fontSize, 'fontSize' as keyof Shape, 8)}
        </section>
      )}

      <section className="props-section">
        <div className="props-section__title">Visibility</div>
        <label className="props-field">
          <span className="props-field__label">@ sec</span>
          <input
            className="props-field__input props-field__input--num"
            type="number"
            min="0"
            step="0.1"
            placeholder="always"
            value={shape.visibleFrom !== undefined ? fmtMs(shape.visibleFrom) : ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') update({ visibleFrom: undefined });
              else {
                const sec = parseFloat(raw);
                if (!isNaN(sec) && sec >= 0) update({ visibleFrom: Math.round(sec * 1000) });
              }
            }}
          />
        </label>
        <span className="props-hint">
          {shape.visibleFrom !== undefined
            ? `Appears at ${fmtMs(shape.visibleFrom)} s`
            : 'Always visible'}
        </span>
      </section>

      {SceneObjects}
    </aside>
  );
}
