import { useDebugStore } from '../store/debugStore';

/**
 * Screen debug mode: when true, show verbose logs and error details on screen.
 * Can be controlled from Settings and persisted locally.
 * Falls back to EXPO_PUBLIC_SCREEN_DEBUG when store is unavailable.
 */
export function isScreenDebugEnabled(): boolean {
  const state = useDebugStore.getState();
  if (state.hydrated) return !!state.screenDebugEnabled;
  const v = process.env.EXPO_PUBLIC_SCREEN_DEBUG;
  if (v === undefined || v === '') return false;
  return v.trim().toLowerCase() === 'true' || v === '1';
}
