import { create } from 'zustand';
import type { SavedFile } from '../types/scene';
import { listSavedFiles, saveFile, deleteFile } from '../utils/storage';

interface FileStore {
  files: SavedFile[];
  isOpen: boolean;
  loadFiles: () => void;
  persist: (file: SavedFile) => void;
  remove: (id: string) => void;
  openManager: () => void;
  closeManager: () => void;
}

export const useFileStore = create<FileStore>((set) => ({
  files: [],
  isOpen: false,

  loadFiles: () => set({ files: listSavedFiles() }),

  persist: (file) => {
    saveFile(file);
    set({ files: listSavedFiles() });
  },

  remove: (id) => {
    deleteFile(id);
    set({ files: listSavedFiles() });
  },

  openManager: () => {
    set({ files: listSavedFiles(), isOpen: true });
  },

  closeManager: () => set({ isOpen: false }),
}));
