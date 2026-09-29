import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_API_BASE_URL } from "./config";

const STORAGE_KEY = "vibe_api_base_url";

let currentBaseUrl = DEFAULT_API_BASE_URL;
let hasLoaded = false;
const listeners = new Set();

export async function loadApiBaseUrl() {
  if (hasLoaded) {
    return currentBaseUrl;
  }
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      currentBaseUrl = stored;
    }
  } catch {
    // Fall back to default.
  }
  hasLoaded = true;
  return currentBaseUrl;
}

export function getApiBaseUrl() {
  return currentBaseUrl;
}

export async function setApiBaseUrl(url) {
  const trimmed = String(url ?? "").trim().replace(/\/+$/, "");
  currentBaseUrl = trimmed || DEFAULT_API_BASE_URL;
  for (const listener of listeners) {
    listener(currentBaseUrl);
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, currentBaseUrl);
  } catch {
    // Ignore persistence failures; in-memory value still applies this session.
  }
}

export function subscribeApiBaseUrl(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
