const DEFAULT_API_URL = 'https://backend-api-smart-ship-right.replit.app';

export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim();
  }

  return DEFAULT_API_URL;
}

