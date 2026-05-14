import { create } from 'zustand';
import type { Shape } from '../types/shapes';

interface ObjectStore {
  objects: Record<string, Shape>;
  addObject: (shape: Shape) => void;
  updateObject: (id: string, patch: Partial<Shape>) => void;
  removeObject: (id: string) => void;
  clearObjects: (ids: string[]) => void;
  setObjects: (objects: Record<string, Shape>) => void;
}

export const useObjectStore = create<ObjectStore>((set) => ({
  objects: {},

  addObject: (shape) =>
    set((state) => ({ objects: { ...state.objects, [shape.id]: shape } })),

  updateObject: (id, patch) =>
    set((state) => {
      const existing = state.objects[id];
      if (!existing) return state;
      return { objects: { ...state.objects, [id]: { ...existing, ...patch } as Shape } };
    }),

  removeObject: (id) =>
    set((state) => {
      const next = { ...state.objects };
      delete next[id];
      return { objects: next };
    }),

  clearObjects: (ids) =>
    set((state) => {
      const next = { ...state.objects };
      ids.forEach((id) => delete next[id]);
      return { objects: next };
    }),

  setObjects: (objects) => set({ objects }),
}));
