// Session storage. expo-secure-store on native; module memory on web or when SecureStore fails.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'homed.token';
const USER_KEY = 'homed.user';

// Fallback when SecureStore is unavailable. Lost on reload, which is fine for web dev.
const memory = new Map<string, string>();

function useSecureStore(): boolean {
  return Platform.OS !== 'web';
}

async function readItem(key: string): Promise<string | null> {
  if (useSecureStore()) {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null) return value;
    } catch {
      // Fall through to memory.
    }
  }
  return memory.get(key) ?? null;
}

async function writeItem(key: string, value: string): Promise<void> {
  if (useSecureStore()) {
    try {
      await SecureStore.setItemAsync(key, value);
      memory.delete(key);
      return;
    } catch {
      // Fall through to memory.
    }
  }
  memory.set(key, value);
}

async function deleteItem(key: string): Promise<void> {
  memory.delete(key);
  if (useSecureStore()) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Nothing more to clear.
    }
  }
}

export const getToken = (): Promise<string | null> => readItem(TOKEN_KEY);
export const setToken = (token: string): Promise<void> => writeItem(TOKEN_KEY, token);
export const clearToken = (): Promise<void> => deleteItem(TOKEN_KEY);

/** The signed-in user from stored JSON. Null for missing or corrupt data. */
export async function getStoredUser<T>(): Promise<T | null> {
  const raw = await readItem(USER_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
export const setStoredUser = (user: unknown): Promise<void> => writeItem(USER_KEY, JSON.stringify(user));
export const clearStoredUser = (): Promise<void> => deleteItem(USER_KEY);
