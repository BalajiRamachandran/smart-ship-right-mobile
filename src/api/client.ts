import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from '../config/api';
import { useDebugStore } from '../store/debugStore';
import { formatApiError } from '../utils/formatApiError';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: getApiBaseUrl(),
      timeout: 15000,
    });

    this.client.interceptors.request.use((config) => {
      try {
        useDebugStore.getState().add({
          level: 'info',
          title: `→ ${(config.method || 'GET').toUpperCase()} ${config.baseURL || ''}${config.url || ''}`,
          data: {
            headers: config.headers,
            params: config.params,
            data: config.data,
          },
        });
      } catch {}
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        try {
          useDebugStore.getState().add({
            level: 'info',
            title: `← HTTP ${response.status} ${response.config?.url || ''}`,
            data: response.data,
          });
        } catch {}
        return response;
      },
      (error) => {
        try {
          const formatted = formatApiError(error);
          useDebugStore.getState().add({
            level: 'error',
            title: formatted.title,
            message: formatted.message,
            data: formatted.details,
          });
        } catch {}
        return Promise.reject(error);
      },
    );
  }

  setBaseUrl(url: string) {
    this.client.defaults.baseURL = url;
  }

  setAuthToken(token: string | null) {
    if (token) {
      this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.client.defaults.headers.common.Authorization;
    }
  }

  get instance() {
    return this.client;
  }
}

export const apiClient = new ApiClient();
export const api = apiClient.instance;

