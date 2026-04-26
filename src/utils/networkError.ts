import axios from 'axios';

/** True when the failure is probably no route to host, offline, or timeout (no HTTP response body). */
export function isLikelyConnectivityError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (error.response != null) return false;
  const code = error.code;
  if (code === 'ECONNABORTED' || code === 'ERR_NETWORK' || code === 'ETIMEDOUT') return true;
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('network error')) return true;
  if (msg.includes('timeout')) return true;
  return false;
}
