import { create } from 'zustand';

export type DebugLogLevel = 'info' | 'error';

export type DebugLogEntry = {
  id: string;
  ts: number;
  level: DebugLogLevel;
  title: string;
  message?: string;
  data?: any;
};

type DebugState = {
  enabled: boolean;
  toastEnabled: boolean;
  logs: DebugLogEntry[];
  setEnabled: (enabled: boolean) => void;
  setToastEnabled: (enabled: boolean) => void;
  add: (entry: Omit<DebugLogEntry, 'id' | 'ts'>) => void;
  clear: () => void;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useDebugStore = create<DebugState>((set, get) => ({
  enabled: false,
  toastEnabled: false,
  logs: [],
  setEnabled(enabled) {
    set({ enabled });
  },
  setToastEnabled(enabled) {
    set({ toastEnabled: enabled });
  },
  add(entry) {
    const { enabled, logs } = get();
    if (!enabled) return;

    const next: DebugLogEntry = {
      id: makeId(),
      ts: Date.now(),
      ...entry,
    };

    const capped = [next, ...logs].slice(0, 50);
    set({ logs: capped });
  },
  clear() {
    set({ logs: [] });
  },
}));

