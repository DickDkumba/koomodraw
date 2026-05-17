import { create } from 'zustand';
import { useObjectStore } from './objectStore';
import { useSceneStore } from './sceneStore';
import type { Shape } from '../types/shapes';

// ── Command interface ─────────────────────────────────────────────────────────

export interface Command {
  /** Human-readable label for debugging / future UI */
  label: string;
  execute(): void;
  undo(): void;
}

// ── Snapshot helpers ──────────────────────────────────────────────────────────

interface Snapshot {
  objects: Record<string, Shape>;
  sceneObjectIds: string[];
}

function takeSnapshot(): Snapshot {
  return {
    objects: { ...useObjectStore.getState().objects },
    sceneObjectIds: [...useSceneStore.getState().scene.objectIds],
  };
}

function applySnapshot(snap: Snapshot): void {
  useObjectStore.getState().setObjects(snap.objects);
  useSceneStore.getState().reorderObjects(snap.sceneObjectIds);
}

// ── Batch command: snapshot before/after ───────────────────────────────────────

export function snapshotCommand(label: string, action: () => void): Command {
  const before = takeSnapshot();
  action();
  const after = takeSnapshot();
  return {
    label,
    execute() { applySnapshot(after); },
    undo() { applySnapshot(before); },
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

const MAX_UNDO = 100;

interface CommandStore {
  undoStack: Command[];
  redoStack: Command[];
  canUndo: boolean;
  canRedo: boolean;
  /** Run an action wrapped in undo/redo snapshot tracking */
  dispatch(label: string, action: () => void): void;
  /** Push a pre-built command (already executed) */
  push(cmd: Command): void;
  undo(): void;
  redo(): void;
  clear(): void;
}

export const useCommandStore = create<CommandStore>((set, get) => ({
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  dispatch(label, action) {
    const cmd = snapshotCommand(label, action);
    const undoStack = [...get().undoStack, cmd].slice(-MAX_UNDO);
    set({ undoStack, redoStack: [], canUndo: true, canRedo: false });
  },

  push(cmd) {
    const undoStack = [...get().undoStack, cmd].slice(-MAX_UNDO);
    set({ undoStack, redoStack: [], canUndo: true, canRedo: false });
  },

  undo() {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return;
    const cmd = undoStack[undoStack.length - 1];
    cmd.undo();
    const newUndo = undoStack.slice(0, -1);
    const newRedo = [...redoStack, cmd];
    set({
      undoStack: newUndo,
      redoStack: newRedo,
      canUndo: newUndo.length > 0,
      canRedo: true,
    });
  },

  redo() {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return;
    const cmd = redoStack[redoStack.length - 1];
    cmd.execute();
    const newRedo = redoStack.slice(0, -1);
    const newUndo = [...undoStack, cmd];
    set({
      undoStack: newUndo,
      redoStack: newRedo,
      canUndo: true,
      canRedo: newRedo.length > 0,
    });
  },

  clear() {
    set({ undoStack: [], redoStack: [], canUndo: false, canRedo: false });
  },
}));
