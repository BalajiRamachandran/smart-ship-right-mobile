import axios from 'axios';

export function formatApiError(error: unknown): { title: string; message: string; details?: any } {
  if (axios.isAxiosError(error)) {
    const method = (error.config?.method || 'GET').toUpperCase();
    const url = error.config?.url || '';
    const status = error.response?.status;

    const data = error.response?.data as any;
    const backendDetail =
      data?.detail ||
      data?.error ||
      data?.message;

    const base = status ? `HTTP ${status}` : 'Network error';
    const title = `${base} • ${method} ${url}`;
    const message =
      String(backendDetail || error.message || 'Request failed');

    return { title, message, details: data };
  }

  if (error instanceof Error) {
    return { title: 'Error', message: error.message, details: { stack: error.stack } };
  }

  return { title: 'Error', message: String(error), details: error };
}

