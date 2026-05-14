import { create } from 'zustand';
import { DEFAULT_LAYER_ID, type Scene } from '../types/scene';
import type { ShapeType } from '../types/shapes';

interface SceneStore {
  scene: Scene;
  selectedIds: Set<string>;
  activeTool: ShapeType | 'select' | null;

  setSceneName: (name: string) => void;
  addObjectToScene: (objectId: string) => void;
  removeObjectFromScene: (objectId: string) => void;
  selectObject: (id: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
  setActiveTool: (tool: ShapeType | 'select' | null) => void;
  setViewport: (x: number, y: number, zoom: number) => void;
  loadScene: (scene: Scene) => void;
  resetScene: () => void;
}

const defaultScene = (): Scene => ({
  id: crypto.randomUUID(),
  name: 'Untitled',
  objectIds: [],
  layers: [{ id: DEFAULT_LAYER_ID, name: 'Default', visible: true, locked: false }],
  activeLayerId: DEFAULT_LAYER_ID,
  viewportX: 0,
  viewportY: 0,
  zoom: 1,
});

export const useSceneStore = create<SceneStore>((set) => ({
  scene: defaultScene(),
  selectedIds: new Set(),
  activeTool: 'select',

  setSceneName: (name) =>
    set((state) => ({ scene: { ...state.scene, name } })),

  addObjectToScene: (objectId) =>
    set((state) => ({
      scene: { ...state.scene, objectIds: [...state.scene.objectIds, objectId] },
    })),

  removeObjectFromScene: (objectId) =>
    set((state) => ({
      scene: {
        ...state.scene,
        objectIds: state.scene.objectIds.filter((id) => id !== objectId),
      },
      selectedIds: new Set([...state.selectedIds].filter((id) => id !== objectId)),
    })),

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
    set((state) => ({ scene: { ...state.scene, viewportX: x, viewportY: y, zoom } })),

  loadScene: (scene) => set({ scene, selectedIds: new Set() }),

  resetScene: () => set({ scene: defaultScene(), selectedIds: new Set() }),
}));
