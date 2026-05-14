import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import type { Shape } from '../../types/shapes';
import './PropertiesPanel.css';

export function PropertiesPanel() {
  const selectedIds    = useSceneStore((s) => s.selectedIds);
  const sceneName      = useSceneStore((s) => s.scene.name);
  const sceneIndex     = useSceneStore((s) => s.activeSceneIndex);
  const totalScenes    = useSceneStore((s) => s.scenes.length);
  const objectCount    = useSceneStore((s) => s.scene.objectIds.length);
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

  if (ids.length === 0) {
    return (
      <aside className="props-panel">
        <div className="props-panel__header">Properties</div>
        {SceneInfo}
        <div className="props-panel__empty">No selection</div>
      </aside>
    );
  }

  if (ids.length > 1) {
    return (
      <aside className="props-panel">
        <div className="props-panel__header">Properties</div>
        {SceneInfo}
        <div className="props-panel__empty">{ids.length} objects selected</div>
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
    </aside>
  );
}
