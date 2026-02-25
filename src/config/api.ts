const DEFAULT_API_URL = 'https://backend-api-smart-ship-right.replit.app';

/** Returns effective API base URL: stored (from apiUrlStore) > env > default. Use after store is hydrated when possible. */
export function getApiBaseUrl(): string {
  try {
    const { useApiUrlStore } = require('../store/apiUrlStore');
    const store = useApiUrlStore.getState();
    if (store.hydrated && store.apiUrl != null) return store.apiUrl;
  } catch {}
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) return envUrl.trim();
  return DEFAULT_API_URL;
}

