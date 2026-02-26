import axios from 'axios';

/**
 * Parse backend 422 validation detail (Pydantic-style array or string) into a single message.
 */
function parse422Detail(data: any): string | null {
  const detail = data?.detail;
  if (detail == null) return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((d: any) => {
      const msg = d.msg ?? d.message;
      const loc = Array.isArray(d.loc) ? d.loc.join('.') : d.loc;
      return loc ? `${loc}: ${msg}` : String(msg);
    });
    return parts.filter(Boolean).join('. ') || null;
  }
  return null;
}

export function formatApiError(error: unknown): { title: string; message: string; details?: any } {
  if (axios.isAxiosError(error)) {
    const method = (error.config?.method || 'GET').toUpperCase();
    const url = error.config?.url || '';
    const status = error.response?.status;
    const data = error.response?.data as any;

    // Status-specific user-facing messages
    if (status === 400) {
      const msg = parse422Detail(data) || data?.error || data?.message || (typeof data?.detail === 'string' ? data.detail : null);
      return { title: 'Bad request', message: msg || 'Invalid request', details: data };
    }
    if (status === 404) {
      return { title: 'Not found', message: data?.error || data?.message || 'SKU not found', details: data };
    }
    if (status === 401 || status === 403) {
      return { title: 'Authentication', message: data?.error || data?.message || 'Please log in again', details: data };
    }
    if (status === 422) {
      const validationMsg = parse422Detail(data);
      const message = validationMsg || data?.error || data?.message || 'Validation error';
      return { title: 'Validation error', message, details: data };
    }

    const backendDetail = data?.detail ?? data?.error ?? data?.message;
    const base = status ? `HTTP ${status}` : 'Network error';
    const title = `${base} • ${method} ${url}`;
    const message = String(backendDetail || error.message || 'Request failed');

    return { title, message, details: data };
  }

  if (error instanceof Error) {
    return { title: 'Error', message: error.message, details: { stack: error.stack } };
  }

  return { title: 'Error', message: String(error), details: error };
}

