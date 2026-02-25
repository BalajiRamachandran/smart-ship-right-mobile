/**
 * Persistent key-value storage with fallback when AsyncStorage native module is unavailable
 * (e.g. Expo Go on some runtimes, or web where native module is null).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const inMemory: Record<string, string> = {};

function isWeb(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    // fallback when native module is null
  }
  try {
    if (isWeb() && typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {}
  return inMemory[key] ?? null;
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
    return;
  } catch {
    // fallback when native module is null (e.g. Expo Go / web)
  }
  if (isWeb() && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, value);
      return;
    } catch {}
  }
  inMemory[key] = value;
  // never throw: in-memory at least keeps the value for this session
}

export const storage = { getItem, setItem };
