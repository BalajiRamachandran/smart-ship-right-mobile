import { create } from 'zustand';
import { apiClient, api } from '../api/client';
import { User } from '../types/user';
import { useDebugStore } from './debugStore';
import { formatApiError } from '../utils/formatApiError';

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  loading: false,
  error: null,
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
    set({
      token: null,
      user: null,
      error: null,
      loading: false,
    });
    apiClient.setAuthToken(null);
  },
}));

