import { useEffect, useRef, useCallback } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import { CanvasRenderer } from '../../renderer/CanvasRenderer';
import type { Shape, ShapeType } from '../../types/shapes';
import {
  hitTestHandle,
  applyResize,
  applyEndpointMove,
  handleCursor,
  isLinear,
  type HandleIndex,
} from '../../renderer/shapes/selectionOverlay';
import { makeShape } from './useShapeFactory';
import './DrawingCanvas.css';

type InteractionMode = 'idle' | 'move' | 'resize' | 'marquee';

interface InteractionState {
  mode: InteractionMode;
  // For resize / single-shape tracking
  shapeId: string | null;
  handleIndex: HandleIndex | null;
  startX: number;
  startY: number;
  // For box resize — original bounds
  origX: number;
  origY: number;
  origWidth: number;
  origHeight: number;
  // For group move — snapshot of every selected shape at drag start
  origShapes: Record<string, Shape>;
}

const IDLE: InteractionState = {
  mode: 'idle',
  shapeId: null,
  handleIndex: null,
  startX: 0,
  startY: 0,
  origX: 0,
  origY: 0,
  origWidth: 0,
  origHeight: 0,
  origShapes: {},
};

// Compute the normalised (positive w/h) rect from two corner points
function normaliseRect(ax: number, ay: number, bx: number, by: number) {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    w: Math.abs(bx - ax),
    h: Math.abs(by - ay),
  };
}

// Returns true if a shape's bounding box overlaps the marquee rect
function intersectsMarquee(
  shape: Shape,
  mx: number, my: number, mw: number, mh: number
): boolean {
  const sx = shape.x, sy = shape.y, sw = shape.width, sh = shape.height;
  return sx < mx + mw && sx + sw > mx && sy < my + mh && sy + sh > my;
}

export function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const interactionRef = useRef<InteractionState>(IDLE);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const cursorRef = useRef<string>('default');

  const scene = useSceneStore((s) => s.scene);
  const selectedIds = useSceneStore((s) => s.selectedIds);
  const activeTool = useSceneStore((s) => s.activeTool);
  const selectObject = useSceneStore((s) => s.selectObject);
  const clearSelection = useSceneStore((s) => s.clearSelection);
  const addObjectToScene = useSceneStore((s) => s.addObjectToScene);
  const objects = useObjectStore((s) => s.objects);
  const addObject = useObjectStore((s) => s.addObject);
  const updateObject = useObjectStore((s) => s.updateObject);

  // ── Renderer init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new CanvasRenderer(canvasRef.current);
    rendererRef.current = renderer;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      renderer.resize(width, height);
    });
    observer.observe(canvasRef.current.parentElement!);

    return () => {
      observer.disconnect();
      renderer.destroy();
    };
  }, []);

  // Push latest state to renderer every time stores change
  useEffect(() => {
    rendererRef.current?.update({
      scene,
      objects,
      selectedIds,
      ghostShape: null,
      marqueeRect: null,
    });
  }, [scene, objects, selectedIds]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addShapeAt = useCallback(
    (type: ShapeType, x: number, y: number) => {
      const shape = makeShape(type, x - 60, y - 35);
      addObject(shape);
      addObjectToScene(shape.id);
      selectObject(shape.id);
    },
    [addObject, addObjectToScene, selectObject]
  );

  const snapshotSelected = useCallback((): Record<string, Shape> => {
    const snap: Record<string, Shape> = {};
    for (const id of useSceneStore.getState().selectedIds) {
      const s = objects[id];
      if (s) snap[id] = { ...s } as Shape;
    }
    return snap;
  }, [objects]);

  // ── Mouse down ─────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const renderer = rendererRef.current;
      if (!renderer) return;
      const world = renderer.toWorldCoords(e.clientX, e.clientY, scene);

      // 1. Drawing tool → place shape
      if (activeTool && activeTool !== 'select') {
        addShapeAt(activeTool as ShapeType, world.x, world.y);
        useSceneStore.getState().setActiveTool('select');
        return;
      }

      // 2. Check resize / endpoint handles on selected shapes
      for (const id of selectedIds) {
        const shape = objects[id];
        if (!shape) continue;
        const hi = hitTestHandle(world.x, world.y, shape, scene.zoom);
        if (hi !== null) {
          interactionRef.current = {
            mode: 'resize',
            shapeId: id,
            handleIndex: hi,
            startX: world.x,
            startY: world.y,
            origX: shape.x,
            origY: shape.y,
            origWidth: shape.width,
            origHeight: shape.height,
            origShapes: {},
          };
          return;
        }
      }

      // 3. Hit test shapes for move
      const hit = renderer.hitTest(world.x, world.y, scene.objectIds, objects);
      if (hit) {
        // If the clicked shape isn't already selected, swap selection (unless shift)
        if (!selectedIds.has(hit)) {
          selectObject(hit, e.shiftKey);
        }

        // Snapshot ALL currently selected (+ the newly clicked one)
        const currentSelected = useSceneStore.getState().selectedIds;
        const snap: Record<string, Shape> = {};
        for (const id of currentSelected) {
          const s = objects[id];
          if (s) snap[id] = { ...s } as Shape;
        }
        // Always include the clicked shape
        if (objects[hit]) snap[hit] = { ...objects[hit] } as Shape;

        interactionRef.current = {
          mode: 'move',
          shapeId: hit,
          handleIndex: null,
          startX: world.x,
          startY: world.y,
          origX: objects[hit]?.x ?? 0,
          origY: objects[hit]?.y ?? 0,
          origWidth: objects[hit]?.width ?? 0,
          origHeight: objects[hit]?.height ?? 0,
          origShapes: snap,
        };
        return;
      }

      // 4. Empty space → start marquee selection
      clearSelection();
      marqueeStartRef.current = { x: world.x, y: world.y };
      interactionRef.current = { ...IDLE, mode: 'marquee', startX: world.x, startY: world.y };
    },
    [activeTool, scene, objects, selectedIds, selectObject, clearSelection, addShapeAt, snapshotSelected]
  );

  // ── Mouse move ─────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const world = renderer.toWorldCoords(e.clientX, e.clientY, scene);
      const ix = interactionRef.current;

      // ── Group move ──
      if (ix.mode === 'move') {
        const dx = world.x - ix.startX;
        const dy = world.y - ix.startY;
        for (const [id, orig] of Object.entries(ix.origShapes)) {
          if (isLinear(orig as Shape)) {
            const lin = orig as import('../../types/shapes').LineShape;
            updateObject(id, {
              x: orig.x + dx,
              y: orig.y + dy,
              points: [
                { x: lin.points[0].x + dx, y: lin.points[0].y + dy },
                { x: lin.points[1].x + dx, y: lin.points[1].y + dy },
              ],
            });
          } else {
            updateObject(id, { x: orig.x + dx, y: orig.y + dy });
          }
        }
        return;
      }

      // ── Endpoint / box resize ──
      if (ix.mode === 'resize' && ix.shapeId && ix.handleIndex !== null) {
        const shape = objects[ix.shapeId];
        if (!shape) return;

        if (isLinear(shape)) {
          // Move the dragged endpoint freely
          const patch = applyEndpointMove(
            shape as import('../../types/shapes').LineShape,
            ix.handleIndex as 0 | 1,
            world.x,
            world.y
          );
          updateObject(ix.shapeId, patch);
        } else {
          const dx = world.x - ix.startX;
          const dy = world.y - ix.startY;
          const next = applyResize(
            { x: ix.origX, y: ix.origY, width: ix.origWidth, height: ix.origHeight },
            ix.handleIndex,
            dx,
            dy
          );
          updateObject(ix.shapeId, next);
        }
        return;
      }

      // ── Marquee ──
      if (ix.mode === 'marquee' && marqueeStartRef.current) {
        const rect = normaliseRect(
          marqueeStartRef.current.x, marqueeStartRef.current.y,
          world.x, world.y
        );
        rendererRef.current?.update({
          scene,
          objects,
          selectedIds,
          ghostShape: null,
          marqueeRect: rect,
        });
        return;
      }

      // ── Cursor hover (idle) ──
      if (activeTool === 'select' || activeTool === null) {
        let cursor = 'default';
        for (const id of selectedIds) {
          const shape = objects[id];
          if (!shape) continue;
          const hi = hitTestHandle(world.x, world.y, shape, scene.zoom);
          if (hi !== null) {
            cursor = isLinear(shape) ? 'crosshair' : handleCursor(hi);
            break;
          }
        }
        // Show move cursor over any unselected shape
        if (cursor === 'default') {
          const hit = renderer.hitTest(world.x, world.y, scene.objectIds, objects);
          if (hit) cursor = 'move';
        }
        if (cursor !== cursorRef.current) {
          cursorRef.current = cursor;
          if (canvasRef.current) canvasRef.current.style.cursor = cursor;
        }
      }
    },
    [scene, objects, selectedIds, activeTool, updateObject]
  );

  // ── Mouse up ───────────────────────────────────────────────────────────────
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const renderer = rendererRef.current;
      const ix = interactionRef.current;

      if (ix.mode === 'marquee' && marqueeStartRef.current && renderer) {
        const world = renderer.toWorldCoords(e.clientX, e.clientY, scene);
        const rect = normaliseRect(
          marqueeStartRef.current.x, marqueeStartRef.current.y,
          world.x, world.y
        );
        // Select all shapes intersecting the marquee (only if dragged a meaningful distance)
        if (rect.w > 4 || rect.h > 4) {
          const hits = scene.objectIds.filter((id) => {
            const s = objects[id];
            return s && intersectsMarquee(s, rect.x, rect.y, rect.w, rect.h);
          });
          if (hits.length > 0) {
            // Select all hits
            const store = useSceneStore.getState();
            store.clearSelection();
            hits.forEach((id) => store.selectObject(id, true));
          }
        }
      }

      marqueeStartRef.current = null;
      interactionRef.current = { ...IDLE };

      // Clear the marquee rect from the renderer
      renderer?.update({
        scene,
        objects,
        selectedIds: useSceneStore.getState().selectedIds,
        ghostShape: null,
        marqueeRect: null,
      });
    },
    [scene, objects, selectedIds]
  );

  const handleMouseLeave = useCallback(() => {
    marqueeStartRef.current = null;
    interactionRef.current = { ...IDLE };
  }, []);

  // ── Toolbar drag-and-drop ──────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('koomodraw/shape')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      const type = e.dataTransfer.getData('koomodraw/shape') as ShapeType;
      if (!type) return;
      e.preventDefault();
      const renderer = rendererRef.current;
      if (!renderer) return;
      const world = renderer.toWorldCoords(e.clientX, e.clientY, scene);
      addShapeAt(type, world.x, world.y);
    },
    [scene, addShapeAt]
  );

  // ── Keyboard: delete selected ──────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        const { selectedIds: ids, removeObjectFromScene } = useSceneStore.getState();
        const { removeObject } = useObjectStore.getState();
        ids.forEach((id) => {
          removeObjectFromScene(id);
          removeObject(id);
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const drawingToolActive = activeTool && activeTool !== 'select';

  return (
    <div className="canvas-container">
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        style={{ cursor: drawingToolActive ? 'crosshair' : undefined }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />
    </div>
  );
}
