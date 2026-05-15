import { useState, useCallback } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import type { Shape, ShapeType, YouTubeShape, ShapeEvent, EventTrigger, EventAction } from '../../types/shapes';
import './PropertiesPanel.css';

const TYPE_ICON: Record<ShapeType, string> = {
  arrow: '→', line: '╱', squiggle: '∿',
  rectangle: '▭', circle: '○', diamond: '◇',
  triangle: '△', text: 'T', database: '⊞', cylinder: '⌭',
  group: '▦',
  youtube: '▶',
};

function fmtMs(ms: number): string {
  return (ms / 1000).toFixed(1);
}

type PropsTab = 'properties' | 'events';

export function PropertiesPanel() {
  const selectedIds    = useSceneStore((s) => s.selectedIds);
  const sceneName      = useSceneStore((s) => s.scene.name);
  const sceneIndex     = useSceneStore((s) => s.activeSceneIndex);
  const totalScenes    = useSceneStore((s) => s.scenes.length);
  const sceneObjectIds = useSceneStore((s) => s.scene.objectIds);
  const objectCount    = sceneObjectIds.length;
  const objects        = useObjectStore((s) => s.objects);
  const updateObject   = useObjectStore((s) => s.updateObject);
  const reorderObjects = useSceneStore((s) => s.reorderObjects);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<PropsTab>('properties');

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); return; }
    const newIds = [...sceneObjectIds];
    const [moved] = newIds.splice(dragIdx, 1);
    newIds.splice(dropIdx, 0, moved);
    reorderObjects(newIds);
    setDragIdx(null);
  }, [dragIdx, sceneObjectIds, reorderObjects]);

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
      {sceneObjectIds.map((id, idx) => {
        const s = objects[id];
        if (!s) return null;
        const name = s.name || s.label?.trim() || s.type;
        const icon = TYPE_ICON[s.type] ?? '?';
        const secVal = s.visibleFrom !== undefined ? fmtMs(s.visibleFrom) : '';
        return (
          <div
            key={id}
            className={`props-obj-row props-obj-row--draggable${dragIdx === idx ? ' props-obj-row--dragging' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={() => setDragIdx(null)}
          >
            <span className="props-obj-grip" title="Drag to reorder">⠿</span>
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
  const isYouTube = shape.type === 'youtube';
  const hasTabs = true; // all shapes get the Events tab

  // ── Events tab content (all shapes) ────────────────────────────────────────
  function renderEventsTab() {
    const events = shape.events ?? [];

    function addEvent() {
      const newEvt: ShapeEvent = {
        id: crypto.randomUUID(),
        trigger: isYouTube ? 'time' : 'click',
        triggerTime: isYouTube ? 0 : undefined,
        action: 'start_player',
      };
      update({ events: [...events, newEvt] } as Partial<Shape>);
    }

    function removeEvent(evtId: string) {
      update({ events: events.filter((e) => e.id !== evtId) } as Partial<Shape>);
    }

    function updateEvent(evtId: string, patch: Partial<ShapeEvent>) {
      update({
        events: events.map((e) => (e.id === evtId ? { ...e, ...patch } : e)),
      } as Partial<Shape>);
    }

    // Build a list of targetable objects for actions that need a target
    const targetObjects = sceneObjectIds
      .map((id) => objects[id])
      .filter((o): o is Shape => !!o);

    const needsTarget = (action: EventAction) =>
      action === 'start_youtube' || action === 'stop_youtube' ||
      action === 'hide_object' || action === 'show_object';

    const needsValue = (action: EventAction) =>
      action === 'seek_player' || action === 'navigate_scene';

    return (
      <>
        <section className="props-section">
          <div className="props-section__title">
            Events ({events.length})
            <button className="props-evt-add" title="Add event" onClick={addEvent}>+</button>
          </div>
          <span className="props-hint" style={{ marginBottom: 6 }}>
            {isYouTube
              ? 'Fire actions on YouTube events or click (play mode).'
              : 'Fire actions when this shape is clicked in play mode.'}
          </span>
          {events.length === 0 && (
            <span className="props-hint">No events. Click + to add one.</span>
          )}
          {events.map((evt) => (
            <div key={evt.id} className="props-evt-row">
              <div className="props-evt-line">
                <span className="props-evt-label">When</span>
                <select
                  className="props-evt-select"
                  value={evt.trigger}
                  onChange={(e) => updateEvent(evt.id, { trigger: e.target.value as EventTrigger })}
                >
                  <option value="click">click</option>
                  {isYouTube && (
                    <>
                      <option value="time">@ time</option>
                      <option value="play">play</option>
                      <option value="pause">pause</option>
                      <option value="ended">ended</option>
                      <option value="load">loaded</option>
                    </>
                  )}
                </select>
                {evt.trigger === 'time' && (
                  <>
                    <input
                      className="props-field__input props-field__input--num props-evt-time"
                      type="number"
                      min="0"
                      step="1"
                      title="Trigger at (seconds into video)"
                      value={evt.triggerTime ?? 0}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 0) updateEvent(evt.id, { triggerTime: v });
                      }}
                    />
                    <span className="props-evt-unit">s</span>
                  </>
                )}
              </div>
              <div className="props-evt-line">
                <span className="props-evt-label">Do</span>
                <select
                  className="props-evt-select"
                  value={evt.action}
                  onChange={(e) => updateEvent(evt.id, { action: e.target.value as EventAction })}
                >
                  <option value="start_player">Start player</option>
                  <option value="stop_player">Stop player</option>
                  <option value="seek_player">Seek player to</option>
                  <option value="navigate_scene">Go to scene</option>
                  <option value="start_youtube">Start YouTube</option>
                  <option value="stop_youtube">Stop YouTube</option>
                  <option value="hide_object">Hide object</option>
                  <option value="show_object">Show object</option>
                </select>
                <button
                  className="props-evt-del"
                  title="Remove event"
                  onClick={() => removeEvent(evt.id)}
                >×</button>
              </div>
              {needsValue(evt.action) && (
                <div className="props-evt-line">
                  <span className="props-evt-label" />
                  <input
                    className="props-field__input props-field__input--num props-evt-time"
                    type="number"
                    min="0"
                    step="1"
                    title={evt.action === 'seek_player' ? 'Seek to (seconds)' : 'Scene number (1-based)'}
                    value={evt.actionValue ?? 0}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 0) updateEvent(evt.id, { actionValue: v });
                    }}
                  />
                </div>
              )}
              {needsTarget(evt.action) && (
                <div className="props-evt-line">
                  <span className="props-evt-label" />
                  <select
                    className="props-evt-select"
                    value={evt.actionTarget ?? ''}
                    onChange={(e) => updateEvent(evt.id, { actionTarget: e.target.value })}
                  >
                    <option value="">— select target —</option>
                    {targetObjects
                      .filter((o) => {
                        if (evt.action === 'start_youtube' || evt.action === 'stop_youtube') return o.type === 'youtube';
                        return true;
                      })
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name || o.label || o.type} ({o.type})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </section>
      </>
    );
  }

  // ── Properties tab content ─────────────────────────────────────────────────
  function renderPropertiesTab() {
    return (
      <>
        {SceneInfo}

        <section className="props-section">
          <div className="props-section__title">Type</div>
          <div className="props-type-badge">{shape.type}</div>
        </section>

        <section className="props-section">
          <div className="props-section__title">Name</div>
          <input
            className="props-field__input props-label-input"
            type="text"
            value={shape.name ?? ''}
            placeholder="Name…"
            onChange={(e) => update({ name: e.target.value } as Partial<Shape>)}
          />
        </section>

        {shape.type === 'group' && (
          <section className="props-section">
            <div className="props-section__title">Children ({(shape as import('../../types/shapes').GroupShape).childIds.length})</div>
            {(shape as import('../../types/shapes').GroupShape).childIds.map((cid) => {
              const child = objects[cid];
              if (!child) return null;
              const icon = TYPE_ICON[child.type] ?? '?';
              const cname = child.name || child.label?.trim() || child.type;
              return (
                <div key={cid} className="props-obj-row">
                  <span className="props-obj-icon">{icon}</span>
                  <span className="props-obj-name" title={cname}>{cname}</span>
                </div>
              );
            })}
          </section>
        )}

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

        {isYouTube && (() => {
          const yt = shape as YouTubeShape;
          return (
            <section className="props-section">
              <div className="props-section__title">Video</div>
              <label className="props-field">
                <span className="props-field__label">URL</span>
                <input
                  className="props-field__input props-label-input"
                  type="text"
                  value={yt.videoUrl}
                  placeholder="https://youtube.com/watch?v=…"
                  onChange={(e) => update({ videoUrl: e.target.value } as Partial<Shape>)}
                />
              </label>
              <label className="props-field" style={{ marginTop: 4 }}>
                <span className="props-field__label">Start (sec)</span>
                <input
                  className="props-field__input props-field__input--num"
                  type="number"
                  min="0"
                  step="1"
                  value={yt.startTime}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 0) update({ startTime: v } as Partial<Shape>);
                  }}
                />
              </label>
            </section>
          );
        })()}

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
      </>
    );
  }

  return (
    <aside className="props-panel">
      {hasTabs ? (
        <div className="props-tabs">
          <button
            className={`props-tab${activeTab === 'properties' ? ' props-tab--active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            Properties
          </button>
          <button
            className={`props-tab${activeTab === 'events' ? ' props-tab--active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            Events
            {(shape.events?.length ?? 0) > 0 && (
              <span className="props-tab__badge">{shape.events!.length}</span>
            )}
          </button>
        </div>
      ) : (
        <div className="props-panel__header">Properties</div>
      )}

      {(activeTab === 'properties' || !hasTabs) && renderPropertiesTab()}
      {activeTab === 'events' && hasTabs && renderEventsTab()}
    </aside>
  );
}
