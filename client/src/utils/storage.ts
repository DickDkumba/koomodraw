import type { SavedFile } from '../types/scene';

const STORAGE_KEY = 'kooModraw_files';

export function listSavedFiles(): SavedFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedFile[]) : [];
  } catch {
    return [];
  }
}

export function saveFile(file: SavedFile): void {
  const files = listSavedFiles().filter((f) => f.id !== file.id);
  files.unshift(file);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

export function deleteFile(id: string): void {
  const files = listSavedFiles().filter((f) => f.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

export function loadFile(id: string): SavedFile | null {
  return listSavedFiles().find((f) => f.id === id) ?? null;
}
