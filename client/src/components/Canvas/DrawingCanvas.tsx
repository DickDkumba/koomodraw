import { useEffect, useRef, useCallback, useState } from 'react';
import { useSceneStore } from '../../store/sceneStore';
import { useObjectStore } from '../../store/objectStore';
import { CanvasRenderer } from '../../renderer/CanvasRenderer';
import type { Shape, ShapeType, GroupShape, FreeDrawShape, Point } from '../../types/shapes';
import {
  hitTestHandle,
  applyResize,
  applyEndpointMove,
  handleCursor,
  isLinear,
  type HandleIndex,
} from '../../renderer/shapes/selectionOverlay';
import { makeShape } from './useShapeFactory';
import { useRecordingStore, setHeldObjectIds, clearHeldObjectIds } from '../../store/recordingStore';
import type { Keyframe } from '../../store/recordingStore';
import { YouTubeOverlay, setActiveYouTubeId } from './YouTubeOverlay';
import { dispatchShapeEvents } from '../../store/youtubeEventDispatcher';
import { useCommandStore, snapshotCommand } from '../../store/commandStore';
import './DrawingCanvas.css';

type InteractionMode = 'idle' | 'move' | 'resize' | 'rotate' | 'marquee' | 'freedraw';

interface InteractionState {
  mode: InteractionMode;
  shapeId: string | null;
  handleIndex: HandleIndex | null;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origWidth: number;
  origHeight: number;
  origShapes: Record<string, Shape>;
  origRotation: number;
  dragStartAngle: number;
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
  origRotation: 0,
  dragStartAngle: 0,
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
  const dragSnapshotRef = useRef<{ objects: Record<string, Shape>; sceneObjectIds: string[] } | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; shapeId: string } | null>(null);
  const [editingText, setEditingText] = useState<{ shapeId: string; field: 'label' | 'name' } | null>(null);

  const scene = useSceneStore((s) => s.scene);
  const selectedIds = useSceneStore((s) => s.selectedIds);
  const activeTool = useSceneStore((s) => s.activeTool);
  const appMode = useSceneStore((s) => s.appMode);
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

  // Subscribe to playback state for recording keyframe capture
  const isPlaying   = useRecordingStore((s) => s.isPlaying);
  const isRecording = useRecordingStore((s) => s.isRecording);

  // Push latest state to renderer every time stores change
  useEffect(() => {
    rendererRef.current?.update({
      scene,
      objects,
      selectedIds: appMode === 'play' ? new Set<string>() : selectedIds,
      ghostShape: null,
      marqueeRect: null,
    });
  }, [scene, objects, selectedIds, isPlaying, isRecording, appMode]);

  const dispatch = useCommandStore((s) => s.dispatch);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addShapeAt = useCallback(
    (type: ShapeType, x: number, y: number) => {
      dispatch(`Add ${type}`, () => {
        const shape = makeShape(type, x - 60, y - 35);
        addObject(shape);
        addObjectToScene(shape.id);
        selectObject(shape.id);
      });
    },
    [addObject, addObjectToScene, selectObject, dispatch]
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
      // Close inline text editor if open
      if (editingText) { setEditingText(null); return; }
      canvasRef.current?.focus();
      const renderer = rendererRef.current;
      if (!renderer) return;
      const world = renderer.toWorldCoords(e.clientX, e.clientY, scene);

      // ── Play mode: fire click events, no selection/editing ──
      if (appMode === 'play') {
        const hit = renderer.hitTest(world.x, world.y, scene.objectIds, objects);
        if (hit) {
          const shape = objects[hit];
          if (shape?.events && shape.events.length > 0) {
            dispatchShapeEvents(shape.events, 'click', undefined, hit);
          }
        }
        return;
      }

      // 1a. Freedraw tool → start capturing path
      if (activeTool === 'freedraw') {
        dragSnapshotRef.current = {
          objects: { ...useObjectStore.getState().objects },
          sceneObjectIds: [...useSceneStore.getState().scene.objectIds],
        };
        const shape = makeShape('freedraw', world.x, world.y);
        (shape as FreeDrawShape).pathPoints = [{ x: world.x, y: world.y }];
        addObject(shape);
        addObjectToScene(shape.id);
        selectObject(shape.id);
        interactionRef.current = {
          ...IDLE,
          mode: 'freedraw',
          shapeId: shape.id,
          startX: world.x,
          startY: world.y,
        };
        return;
      }

      // 1. Drawing tool → place shape
      if (activeTool && activeTool !== 'select') {
        addShapeAt(activeTool as ShapeType, world.x, world.y);
        useSceneStore.getState().setActiveTool('select');
        return;
      }

      // 2. Check resize / rotate / endpoint handles on selected shapes
      for (const id of selectedIds) {
        const shape = objects[id];
        if (!shape) continue;
        const hi = hitTestHandle(world.x, world.y, shape, scene.zoom);
        if (hi !== null) {
          dragSnapshotRef.current = {
            objects: { ...useObjectStore.getState().objects },
            sceneObjectIds: [...useSceneStore.getState().scene.objectIds],
          };
          if (hi === 8) {
            // Rotation handle
            const cx = shape.x + shape.width / 2;
            const cy = shape.y + shape.height / 2;
            interactionRef.current = {
              mode: 'rotate',
              shapeId: id,
              handleIndex: hi,
              startX: world.x,
              startY: world.y,
              origX: shape.x,
              origY: shape.y,
              origWidth: shape.width,
              origHeight: shape.height,
              origShapes: {},
              origRotation: shape.rotation ?? 0,
              dragStartAngle: Math.atan2(world.y - cy, world.x - cx),
            };
          } else {
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
              origRotation: 0,
              dragStartAngle: 0,
            };
          }
          setHeldObjectIds([id]);
          return;
        }
      }

      // 3. Hit test shapes for move
      const hit = renderer.hitTest(world.x, world.y, scene.objectIds, objects);
      if (hit) {
        dragSnapshotRef.current = {
          objects: { ...useObjectStore.getState().objects },
          sceneObjectIds: [...useSceneStore.getState().scene.objectIds],
        };
        // If the clicked shape isn't already selected, swap selection (unless shift)
        if (!selectedIds.has(hit)) {
          selectObject(hit, e.shiftKey);
        }

        // Snapshot ALL currently selected (+ the newly clicked one), including group children
        const currentSelected = useSceneStore.getState().selectedIds;
        const snap: Record<string, Shape> = {};
        const snapShape = (id: string) => {
          const s = objects[id];
          if (!s || snap[id]) return;
          snap[id] = { ...s } as Shape;
          if (s.type === 'group') {
            for (const cid of (s as GroupShape).childIds) snapShape(cid);
          }
        };
        for (const id of currentSelected) snapShape(id);
        // Always include the clicked shape
        snapShape(hit);

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
          origRotation: 0,
          dragStartAngle: 0,
        };
        // Mark these objects as held so recording playback skips them
        setHeldObjectIds(Object.keys(snap));
        return;
      }

      // 4. Empty space → start marquee selection
      clearSelection();
      marqueeStartRef.current = { x: world.x, y: world.y };
      interactionRef.current = { ...IDLE, mode: 'marquee', startX: world.x, startY: world.y };
    },
    [activeTool, scene, objects, selectedIds, selectObject, clearSelection, addShapeAt, snapshotSelected, appMode]
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
        const moveShape = (id: string, orig: Shape) => {
          if (isLinear(orig)) {
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
        };
        for (const [id, orig] of Object.entries(ix.origShapes)) {
          moveShape(id, orig as Shape);
          // If this is a group, move all children too
          if (orig.type === 'group') {
            const grp = orig as GroupShape;
            for (const childId of grp.childIds) {
              const childOrig = ix.origShapes[childId];
              if (childOrig) moveShape(childId, childOrig as Shape);
            }
          }
        }

        // Capture keyframes if recording
        const rec = useRecordingStore.getState();
        if (rec.isRecording) {
          const t   = rec.timeOffset + (Date.now() - rec.epochStart);
          const obs = useObjectStore.getState().objects;
          for (const id of Object.keys(ix.origShapes)) {
            const s = obs[id];
            if (!s) continue;
            const kf: Keyframe = { t, objectId: id, x: s.x, y: s.y };
            if ('points' in s) kf.points = (s as any).points;
            rec.addKeyframe(kf);
          }
        }

        return;
      }

      // ── Freedraw ──
      if (ix.mode === 'freedraw' && ix.shapeId) {
        const shape = objects[ix.shapeId] as FreeDrawShape | undefined;
        if (!shape) return;
        const newPoints = [...shape.pathPoints, { x: world.x, y: world.y }];
        // Update bounding box
        const xs = newPoints.map((p) => p.x);
        const ys = newPoints.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        updateObject(ix.shapeId, {
          pathPoints: newPoints,
          x: minX,
          y: minY,
          width: Math.max(maxX - minX, 1),
          height: Math.max(maxY - minY, 1),
        } as Partial<Shape>);
        return;
      }

      // ── Rotation ──
      if (ix.mode === 'rotate' && ix.shapeId) {
        const shape = objects[ix.shapeId];
        if (!shape) return;
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const currentAngle = Math.atan2(world.y - cy, world.x - cx);
        const delta = (currentAngle - ix.dragStartAngle) * (180 / Math.PI);
        updateObject(ix.shapeId, { rotation: ix.origRotation + delta });
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

        if (appMode === 'play') {
          // In play mode, show pointer on shapes with click events
          const hit = renderer.hitTest(world.x, world.y, scene.objectIds, objects);
          if (hit) {
            const shape = objects[hit];
            if (shape?.events?.some((e) => e.trigger === 'click')) {
              cursor = 'pointer';
            }
          }
        } else {
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
        }
        if (cursor !== cursorRef.current) {
          cursorRef.current = cursor;
          if (canvasRef.current) canvasRef.current.style.cursor = cursor;
        }
      }
    },
    [scene, objects, selectedIds, activeTool, updateObject, appMode]
  );

  // ── Push drag command on mouse up ────────────────────────────────────────
  const pushDragCommand = useCallback((label: string) => {
    const before = dragSnapshotRef.current;
    if (!before) return;
    const after = {
      objects: { ...useObjectStore.getState().objects },
      sceneObjectIds: [...useSceneStore.getState().scene.objectIds],
    };
    // Only push if something actually changed
    if (before.objects !== after.objects || before.sceneObjectIds !== after.sceneObjectIds) {
      useCommandStore.getState().push({
        label,
        execute() {
          useObjectStore.getState().setObjects(after.objects);
          useSceneStore.getState().reorderObjects(after.sceneObjectIds);
        },
        undo() {
          useObjectStore.getState().setObjects(before.objects);
          useSceneStore.getState().reorderObjects(before.sceneObjectIds);
        },
      });
    }
    dragSnapshotRef.current = null;
  }, []);

  // ── Mouse up ───────────────────────────────────────────────────────────────
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const renderer = rendererRef.current;
      const ix = interactionRef.current;

      // Finalize freedraw
      if (ix.mode === 'freedraw' && ix.shapeId) {
        const shape = objects[ix.shapeId] as FreeDrawShape | undefined;
        if (shape && shape.pathPoints.length < 2) {
          // Too few points — remove the shape
          const store = useSceneStore.getState();
          store.removeObjectFromScene(ix.shapeId);
          useObjectStore.getState().removeObject(ix.shapeId);
        }
        pushDragCommand('Free draw');
        clearHeldObjectIds();
        useSceneStore.getState().setActiveTool('select');
        interactionRef.current = { ...IDLE };
        return;
      }

      // Push command for drag operations (move/resize/rotate)
      if (ix.mode === 'move') { pushDragCommand('Move'); clearHeldObjectIds(); }
      else if (ix.mode === 'resize') { pushDragCommand('Resize'); clearHeldObjectIds(); }
      else if (ix.mode === 'rotate') { pushDragCommand('Rotate'); clearHeldObjectIds(); }

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
    clearHeldObjectIds();
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

  // ── Context menu (right-click) ────────────────────────────────────────────
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const renderer = rendererRef.current;
      if (!renderer) return;
      const world = renderer.toWorldCoords(e.clientX, e.clientY, scene);
      const hit = renderer.hitTest(world.x, world.y, scene.objectIds, objects);
      if (hit) setContextMenu({ x: e.clientX, y: e.clientY, shapeId: hit });
    },
    [scene, objects]
  );

  const handleClone = useCallback(() => {
    if (!contextMenu) return;

    dispatch('Clone', () => {
      const idsToClone =
        selectedIds.size > 1 && selectedIds.has(contextMenu.shapeId)
          ? [...selectedIds]
          : [contextMenu.shapeId];

      const offset = 20;
      const newIds: string[] = [];

      for (const id of idsToClone) {
        const orig = objects[id];
        if (!orig) continue;
        const newId = crypto.randomUUID();
        let clone: Shape;

        const allObjs = useObjectStore.getState().objects;
        let typeCount = 0;
        for (const o of Object.values(allObjs)) {
          if (o.type === orig.type) typeCount++;
        }
        const cloneName = `${orig.type}_${typeCount + 1}`;

        if (isLinear(orig)) {
          const lin = orig as import('../../types/shapes').LineShape;
          clone = {
            ...orig,
            id: newId,
            name: cloneName,
            selected: false,
            x: orig.x + offset,
            y: orig.y + offset,
            points: [
              { x: lin.points[0].x + offset, y: lin.points[0].y + offset },
              { x: lin.points[1].x + offset, y: lin.points[1].y + offset },
            ],
          } as Shape;
        } else {
          clone = { ...orig, id: newId, name: cloneName, selected: false, x: orig.x + offset, y: orig.y + offset };
        }

        addObject(clone);
        addObjectToScene(newId);
        newIds.push(newId);
      }

      const store = useSceneStore.getState();
      store.clearSelection();
      newIds.forEach((id) => store.selectObject(id, true));
    });

    setContextMenu(null);
  }, [contextMenu, selectedIds, objects, addObject, addObjectToScene, dispatch]);

  const handleGroup = useCallback(() => {
    if (!contextMenu) return;

    const idsToGroup =
      selectedIds.size > 1 && selectedIds.has(contextMenu.shapeId)
        ? [...selectedIds]
        : [contextMenu.shapeId];

    if (idsToGroup.length < 2) { setContextMenu(null); return; }

    dispatch('Group', () => {
      const childIds: string[] = [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      for (const id of idsToGroup) {
        const orig = objects[id];
        if (!orig) continue;
        const newId = crypto.randomUUID();
        const clone = { ...orig, id: newId, name: orig.name || orig.type, selected: false } as Shape;
        if (isLinear(orig)) {
          const lin = orig as import('../../types/shapes').LineShape;
          (clone as any).points = [...lin.points];
        }
        addObject(clone);
        childIds.push(newId);

        minX = Math.min(minX, orig.x);
        minY = Math.min(minY, orig.y);
        maxX = Math.max(maxX, orig.x + orig.width);
        maxY = Math.max(maxY, orig.y + orig.height);
      }

      const allObjects = useObjectStore.getState().objects;
      let groupCount = 0;
      for (const obj of Object.values(allObjects)) {
        if (obj.type === 'group') groupCount++;
      }

      const groupId = crypto.randomUUID();
      const group: GroupShape = {
        id: groupId,
        type: 'group',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        name: groupCount === 0 ? 'group' : `group_${groupCount + 1}`,
        label: '',
        layerId: scene.layers[0]?.id ?? 'default',
        selected: false,
        strokeColor: 'transparent',
        fillColor: 'transparent',
        strokeWidth: 0,
        childIds,
        opacity: 1,
      };

      addObject(group);
      addObjectToScene(groupId);

      const store = useSceneStore.getState();
      store.clearSelection();
      store.selectObject(groupId);
    });

    setContextMenu(null);
  }, [contextMenu, selectedIds, objects, scene, addObject, addObjectToScene, dispatch]);

  // ── Keyboard: delete selected + undo/redo ─────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      // Undo: Ctrl/Cmd+Z (without shift)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && !inInput) {
        e.preventDefault();
        useCommandStore.getState().undo();
        return;
      }
      // Redo: Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
      if ((e.metaKey || e.ctrlKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y') && !inInput) {
        e.preventDefault();
        useCommandStore.getState().redo();
        return;
      }

      if (
        (e.key === 'Delete' || e.key === 'Backspace') && !inInput
      ) {
        const { selectedIds: ids } = useSceneStore.getState();
        if (ids.size === 0) return;
        useCommandStore.getState().dispatch('Delete', () => {
          const { removeObjectFromScene } = useSceneStore.getState();
          const { removeObject } = useObjectStore.getState();
          ids.forEach((id) => {
            removeObjectFromScene(id);
            removeObject(id);
          });
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Double-click: inline text edit or activate YouTube ───────────────────
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (appMode === 'play') return;
      const renderer = rendererRef.current;
      if (!renderer) return;
      const world = renderer.toWorldCoords(e.clientX, e.clientY, scene);
      const hit = renderer.hitTest(world.x, world.y, scene.objectIds, objects);
      if (hit) {
        const shape = objects[hit];
        if (!shape) return;
        if (shape.type === 'youtube') {
          setActiveYouTubeId(hit);
        } else if (shape.type !== 'line' && shape.type !== 'arrow' && shape.type !== 'squiggle' && shape.type !== 'freedraw') {
          // Start inline text editing (only for shapes that have labels)
          selectObject(hit);
          setEditingText({ shapeId: hit, field: 'label' });
        }
      }
    },
    [scene, objects, appMode, selectObject]
  );

  const drawingToolActive = activeTool && activeTool !== 'select';

  return (
    <div className="canvas-container">
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        tabIndex={-1}
        style={{ cursor: drawingToolActive ? 'crosshair' : undefined, outline: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      />

      {editingText && (() => {
        const shape = objects[editingText.shapeId];
        if (!shape) return null;
        const left = shape.x * scene.zoom + scene.viewportX;
        const top = shape.y * scene.zoom + scene.viewportY;
        const width = Math.max(shape.width * scene.zoom, 60);
        const height = Math.max(shape.height * scene.zoom, 24);
        const isTextType = shape.type === 'text';
        const value = shape.label;
        return (
          <input
            className="inline-text-edit"
            style={{
              position: 'absolute',
              left,
              top,
              width,
              height,
              fontSize: `${(isTextType ? (shape as any).fontSize : 13) * scene.zoom}px`,
              textAlign: isTextType ? 'left' : 'center',
            }}
            autoFocus
            value={value}
            onFocus={() => {
              dragSnapshotRef.current = {
                objects: { ...useObjectStore.getState().objects },
                sceneObjectIds: [...useSceneStore.getState().scene.objectIds],
              };
            }}
            onChange={(e) => {
              updateObject(editingText.shapeId, { label: e.target.value });
            }}
            onBlur={() => {
              pushDragCommand('Edit text');
              setEditingText(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        );
      })()}

      <YouTubeOverlay />

      {contextMenu && (
        <>
          <div className="ctx-backdrop" onMouseDown={() => setContextMenu(null)} />
          <div className="ctx-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button className="ctx-menu__item" onMouseDown={handleClone}>Clone</button>
            {selectedIds.size > 1 && selectedIds.has(contextMenu.shapeId) && (
              <button className="ctx-menu__item" onMouseDown={handleGroup}>Group</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
