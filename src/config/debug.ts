/**
 * Screen debug mode: when true, show verbose logs and error details on screen.
 * Set EXPO_PUBLIC_SCREEN_DEBUG=true in .env and restart Expo.
 */
export function isScreenDebugEnabled(): boolean {
  const v = process.env.EXPO_PUBLIC_SCREEN_DEBUG;
  if (v === undefined || v === '') return false;
  return v.trim().toLowerCase() === 'true' || v === '1';
}
