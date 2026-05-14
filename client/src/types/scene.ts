export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export const DEFAULT_LAYER_ID = 'default';

export interface Scene {
  id: string;
  name: string;
  objectIds: string[];
  layers: Layer[];
  activeLayerId: string;
  viewportX: number;
  viewportY: number;
  zoom: number;
}

export interface SavedFile {
  id: string;
  name: string;
  savedAt: number;
  sceneData: string;
}
