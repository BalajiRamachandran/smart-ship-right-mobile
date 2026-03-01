import { create } from 'zustand';
import { apiClient, api } from '../api/client';
import { User } from '../types/user';
import { useDebugStore } from './debugStore';
import { formatApiError } from '../utils/formatApiError';
import { storage } from '../utils/storage';

const AUTH_STORAGE_KEY = '@smart_ship_right_auth';

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

interface PersistedAuth {
  token: string;
  user: User;
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  /** True after we've attempted to restore auth from storage */
  hydrated: boolean;
  /** Restore token/user from storage and set on API client. Call after API base URL is set. */
  hydrate: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  loading: false,
  error: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await storage.getItem(AUTH_STORAGE_KEY);
      if (!raw?.trim()) {
        set({ hydrated: true });
        return;
      }
      const parsed = JSON.parse(raw) as PersistedAuth;
      if (!parsed?.token || !parsed?.user) {
        set({ hydrated: true });
        return;
      }
      apiClient.setAuthToken(parsed.token);
      set({ token: parsed.token, user: parsed.user, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  async login(username, password) {
    set({ loading: true, error: null });
    try {
      const response = await api.post<LoginResponse>('/api/auth/login', {
        username,
        password,
      });

      const data = response.data;

      if (!data || !data.access_token) {
        throw new Error('Invalid login response');
      }

      apiClient.setAuthToken(data.access_token);

      const payload: PersistedAuth = { token: data.access_token, user: data.user };
      await storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));

      set({
        token: data.access_token,
        user: data.user,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Login error', error);
      const formatted = formatApiError(error);

      // If debug is enabled, surface the actual error detail to the user.
      const debugEnabled = useDebugStore.getState().enabled;
      const message = debugEnabled
        ? `${formatted.message} (${formatted.title})`
        : (error?.response?.data?.detail || 'Unable to sign in. Please check your credentials.');

      set({
        loading: false,
        error: message,
        token: null,
        user: null,
      });

      apiClient.setAuthToken(null);
    }
  },
  logout() {
    storage.setItem(AUTH_STORAGE_KEY, '').catch(() => {});
    set({
      token: null,
      user: null,
      error: null,
      loading: false,
    });
    apiClient.setAuthToken(null);
  },
}));

