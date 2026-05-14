import { useEffect, useRef, useCallback } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import { CanvasRenderer } from '../../renderer/CanvasRenderer';
import type { ShapeType } from '../../types/shapes';
import { makeShape } from './useShapeFactory';
import './DrawingCanvas.css';

export function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const dragStateRef = useRef<{
    dragging: boolean;
    shapeId: string | null;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ dragging: false, shapeId: null, startX: 0, startY: 0, origX: 0, origY: 0 });

  const scene = useSceneStore((s) => s.scene);
  const selectedIds = useSceneStore((s) => s.selectedIds);
  const activeTool = useSceneStore((s) => s.activeTool);
  const selectObject = useSceneStore((s) => s.selectObject);
  const clearSelection = useSceneStore((s) => s.clearSelection);
  const addObjectToScene = useSceneStore((s) => s.addObjectToScene);
  const objects = useObjectStore((s) => s.objects);
  const addObject = useObjectStore((s) => s.addObject);
  const updateObject = useObjectStore((s) => s.updateObject);

  // Initialize renderer
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

  // Push state to renderer on every change
  useEffect(() => {
    rendererRef.current?.update({
      scene,
      objects,
      selectedIds,
      ghostShape: null,
    });
  }, [scene, objects, selectedIds]);

  const addShapeAt = useCallback(
    (type: ShapeType, x: number, y: number) => {
      const shape = makeShape(type, x - 60, y - 35);
      addObject(shape);
      addObjectToScene(shape.id);
      selectObject(shape.id);
    },
    [addObject, addObjectToScene, selectObject]
  );

  // Mouse down: select or start drawing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const world = renderer.toWorldCoords(e.clientX, e.clientY, scene);

      if (activeTool === 'select' || activeTool === null) {
        const hit = renderer.hitTest(world.x, world.y, scene.objectIds, objects);
        if (hit) {
          selectObject(hit, e.shiftKey);
          const shape = objects[hit];
          dragStateRef.current = {
            dragging: true,
            shapeId: hit,
            startX: world.x,
            startY: world.y,
            origX: shape.x,
            origY: shape.y,
          };
        } else {
          clearSelection();
        }
        return;
      }

      // Drawing tool selected — place shape on click
      addShapeAt(activeTool as ShapeType, world.x, world.y);
      useSceneStore.getState().setActiveTool('select');
    },
    [activeTool, scene, objects, selectObject, clearSelection, addShapeAt]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds.dragging || !ds.shapeId) return;
      const renderer = rendererRef.current;
      if (!renderer) return;
      const world = renderer.toWorldCoords(e.clientX, e.clientY, scene);
      updateObject(ds.shapeId, {
        x: ds.origX + (world.x - ds.startX),
        y: ds.origY + (world.y - ds.startY),
      });
    },
    [scene, updateObject]
  );

  const handleMouseUp = useCallback(() => {
    dragStateRef.current.dragging = false;
  }, []);

  // Drag-from-toolbar drop
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

  // Keyboard: delete selected
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') &&
          !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
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

  const cursorStyle =
    activeTool && activeTool !== 'select' ? 'crosshair' : 'default';

  return (
    <div className="canvas-container">
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />
    </div>
  );
}
