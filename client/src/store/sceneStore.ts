import { create } from 'zustand';
import { DEFAULT_LAYER_ID, type Scene } from '../types/scene';
import type { ShapeType } from '../types/shapes';

interface SceneStore {
  // Document-level
  fileId: string;
  fileName: string;

  // Multi-scene
  scenes: Scene[];
  activeSceneIndex: number;
  scene: Scene;              // always mirrors scenes[activeSceneIndex]

  selectedIds: Set<string>;
  activeTool: ShapeType | 'select' | null;

  // Document actions
  setFileName: (name: string) => void;

  // Scene tab management
  addScene: (mode: 'clear' | 'inherit', objectIds?: string[]) => void;
  removeScene: (id: string) => void;
  activateScene: (id: string) => void;
  renameScene: (id: string, name: string) => void;
  navigateScene: (delta: -1 | 1) => void;

  // Active-scene mutations (backward-compat API — all work on the active scene)
  setSceneName: (name: string) => void;
  addObjectToScene: (objectId: string) => void;
  removeObjectFromScene: (objectId: string) => void;
  selectObject: (id: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
  setActiveTool: (tool: ShapeType | 'select' | null) => void;
  setViewport: (x: number, y: number, zoom: number) => void;

  // Load / reset
  loadScene: (scene: Scene) => void;      // replace active scene (legacy single-scene load)
  loadAll: (fileName: string, fileId: string, scenes: Scene[]) => void;
  resetScene: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeScene(name: string): Scene {
  return {
    id: crypto.randomUUID(),
    name,
    objectIds: [],
    layers: [{ id: DEFAULT_LAYER_ID, name: 'Default', visible: true, locked: false }],
    activeLayerId: DEFAULT_LAYER_ID,
    viewportX: 0,
    viewportY: 0,
    zoom: 1,
  };
}

type S = SceneStore;

function patchActive(state: S, patch: Partial<Scene>): Partial<S> {
  const scenes = [...state.scenes];
  const idx = state.activeSceneIndex;
  const scene = { ...scenes[idx], ...patch };
  scenes[idx] = scene;
  return { scenes, scene };
}

// ── Store ─────────────────────────────────────────────────────────────────────

const initial = makeScene('Scene 1');

export const useSceneStore = create<SceneStore>((set, get) => ({
  fileId: crypto.randomUUID(),
  fileName: 'Untitled',
  scenes: [initial],
  activeSceneIndex: 0,
  scene: initial,
  selectedIds: new Set(),
  activeTool: 'select',

  // ── Document ──────────────────────────────────────────────────────────────
  setFileName: (name) => set({ fileName: name }),

  // ── Scene tabs ────────────────────────────────────────────────────────────
  addScene: (mode, objectIds?) =>
    set((state) => {
      const num = state.scenes.length + 1;
      const src = state.scenes[state.activeSceneIndex];
      const newScene = makeScene(`Scene ${num}`);
      if (objectIds)              newScene.objectIds = objectIds;
      else if (mode === 'inherit') newScene.objectIds = [...src.objectIds];
      const scenes = [...state.scenes, newScene];
      const idx = scenes.length - 1;
      return { scenes, activeSceneIndex: idx, scene: newScene, selectedIds: new Set() };
    }),

  removeScene: (id) =>
    set((state) => {
      if (state.scenes.length === 1) return state; // keep at least one
      const scenes = state.scenes.filter((s) => s.id !== id);
      const idx = Math.min(state.activeSceneIndex, scenes.length - 1);
      return { scenes, activeSceneIndex: idx, scene: scenes[idx], selectedIds: new Set() };
    }),

  activateScene: (id) =>
    set((state) => {
      const idx = state.scenes.findIndex((s) => s.id === id);
      if (idx === -1 || idx === state.activeSceneIndex) return state;
      return { activeSceneIndex: idx, scene: state.scenes[idx], selectedIds: new Set() };
    }),

  renameScene: (id, name) =>
    set((state) => {
      const scenes = state.scenes.map((s) => (s.id === id ? { ...s, name } : s));
      const scene = scenes[state.activeSceneIndex];
      return { scenes, scene };
    }),

  navigateScene: (delta) =>
    set((state) => {
      const idx = Math.max(0, Math.min(state.scenes.length - 1, state.activeSceneIndex + delta));
      if (idx === state.activeSceneIndex) return state;
      return { activeSceneIndex: idx, scene: state.scenes[idx], selectedIds: new Set() };
    }),

  // ── Active-scene mutations ────────────────────────────────────────────────
  setSceneName: (name) =>
    set((state) => patchActive(state, { name })),

  addObjectToScene: (objectId) =>
    set((state) =>
      patchActive(state, { objectIds: [...state.scene.objectIds, objectId] })
    ),

  removeObjectFromScene: (objectId) =>
    set((state) => {
      const patch = patchActive(state, {
        objectIds: state.scene.objectIds.filter((id) => id !== objectId),
      });
      return {
        ...patch,
        selectedIds: new Set([...state.selectedIds].filter((id) => id !== objectId)),
      };
    }),

  selectObject: (id, multiSelect = false) =>
    set((state) => {
      if (multiSelect) {
        const next = new Set(state.selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { selectedIds: next };
      }
      return { selectedIds: new Set([id]) };
    }),

  clearSelection: () => set({ selectedIds: new Set() }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setViewport: (x, y, zoom) =>
    set((state) => patchActive(state, { viewportX: x, viewportY: y, zoom })),

  // ── Load / reset ──────────────────────────────────────────────────────────
  loadScene: (scene) =>
    set((state) => {
      const scenes = [...state.scenes];
      scenes[state.activeSceneIndex] = scene;
      return { scenes, scene, selectedIds: new Set() };
    }),

  loadAll: (fileName, fileId, scenes) =>
    set({ fileName, fileId, scenes, activeSceneIndex: 0, scene: scenes[0], selectedIds: new Set() }),

  resetScene: () => {
    const s = makeScene('Scene 1');
    set({ fileId: crypto.randomUUID(), fileName: 'Untitled', scenes: [s], activeSceneIndex: 0, scene: s, selectedIds: new Set() });
  },
}));
