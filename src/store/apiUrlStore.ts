import { create } from 'zustand';
import { apiClient } from '../api/client';
import { storage } from '../utils/storage';

const STORAGE_KEY = '@smart_ship_right_api_url';

const getDefaultUrl = (): string => {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env && env.trim().length > 0) return env.trim();
  return 'https://backend-api-smart-ship-right.replit.app';
};

interface ApiUrlState {
  /** Stored API base URL; null = never set by user (use default) */
  apiUrl: string | null;
  /** True after we've loaded from AsyncStorage */
  hydrated: boolean;
  /** Load stored URL from AsyncStorage and apply to API client */
  hydrate: () => Promise<void>;
  /** Save URL to storage and update API client; optionally clear auth when changing backend */
  setApiUrl: (url: string, options?: { clearAuth?: boolean }) => Promise<void>;
  /** Return the effective base URL (stored, or env, or default) */
  getEffectiveUrl: () => string;
}

export const useApiUrlStore = create<ApiUrlState>((set, get) => ({
  apiUrl: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const stored = await storage.getItem(STORAGE_KEY);
      const url = stored && stored.trim().length > 0 ? stored.trim() : null;
      const effective = url ?? getDefaultUrl();
      apiClient.setBaseUrl(effective);
      set({ apiUrl: url, hydrated: true });
    } catch {
      apiClient.setBaseUrl(getDefaultUrl());
      set({ apiUrl: null, hydrated: true });
    }
  },

  setApiUrl: async (url, options = {}) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      await storage.setItem(STORAGE_KEY, trimmed);
      apiClient.setBaseUrl(trimmed);
      if (options.clearAuth) {
        const { useAuthStore } = await import('./authStore');
        useAuthStore.getState().logout();
      }
      set({ apiUrl: trimmed });
    } catch (e) {
      console.error('Failed to save API URL', e);
      throw e;
    }
  },

  getEffectiveUrl: () => {
    const { apiUrl } = get();
    return apiUrl ?? getDefaultUrl();
  },
}));
