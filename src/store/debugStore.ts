import { create } from 'zustand';
import { storage } from '../utils/storage';

const SCREEN_DEBUG_KEY = '@smart_ship_right_screen_debug';

function envScreenDebugDefault(): boolean {
  const v = process.env.EXPO_PUBLIC_SCREEN_DEBUG;
  if (v === undefined || v === '') return false;
  return v.trim().toLowerCase() === 'true' || v === '1';
}

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
  screenDebugEnabled: boolean;
  hydrated: boolean;
  logs: DebugLogEntry[];
  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  setToastEnabled: (enabled: boolean) => void;
  setScreenDebugEnabled: (enabled: boolean) => Promise<void>;
  add: (entry: Omit<DebugLogEntry, 'id' | 'ts'>) => void;
  clear: () => void;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useDebugStore = create<DebugState>((set, get) => ({
  enabled: false,
  toastEnabled: false,
  screenDebugEnabled: envScreenDebugDefault(),
  hydrated: false,
  logs: [],
  hydrate: async () => {
    try {
      const raw = await storage.getItem(SCREEN_DEBUG_KEY);
      if (raw == null) {
        set({ hydrated: true });
        return;
      }
      set({ screenDebugEnabled: raw === '1', hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setEnabled(enabled) {
    set({ enabled });
  },
  setToastEnabled(enabled) {
    set({ toastEnabled: enabled });
  },
  async setScreenDebugEnabled(enabled) {
    set({ screenDebugEnabled: enabled });
    await storage.setItem(SCREEN_DEBUG_KEY, enabled ? '1' : '0');
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

