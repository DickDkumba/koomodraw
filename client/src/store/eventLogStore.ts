import { create } from 'zustand';

export interface EventLogEntry {
  id: string;
  time: number;
  trigger: string;
  action: string;
  sourceName: string;
  targetName?: string;
}

const MAX_ENTRIES = 50;

interface EventLogStore {
  entries: EventLogEntry[];
  addEntry: (entry: Omit<EventLogEntry, 'id' | 'time'>) => void;
  clear: () => void;
}

export const useEventLogStore = create<EventLogStore>((set) => ({
  entries: [],
  addEntry: (entry) =>
    set((s) => ({
      entries: [
        { ...entry, id: crypto.randomUUID(), time: Date.now() },
        ...s.entries,
      ].slice(0, MAX_ENTRIES),
    })),
  clear: () => set({ entries: [] }),
}));
