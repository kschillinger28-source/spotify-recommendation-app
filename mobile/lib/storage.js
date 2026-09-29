import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const ACCESS_TOKEN_KEY = "vibe_access_token";
const REFRESH_TOKEN_KEY = "vibe_refresh_token";
const EXPIRES_AT_KEY = "vibe_token_expires_at_ms";
const SESSION_ID_KEY = "vibe_dj_session_id";

// expo-secure-store has no native keychain/keystore on web, so its module is
// an empty stub there — fall back to AsyncStorage (localStorage) on web.
const secureGetItem = Platform.OS === "web" ? AsyncStorage.getItem : SecureStore.getItemAsync;
const secureSetItem = Platform.OS === "web" ? AsyncStorage.setItem : SecureStore.setItemAsync;
const secureDeleteItem = Platform.OS === "web" ? AsyncStorage.removeItem : SecureStore.deleteItemAsync;

export async function getStoredTokens() {
  const [accessToken, refreshToken, expiresAtRaw] = await Promise.all([
    secureGetItem(ACCESS_TOKEN_KEY),
    secureGetItem(REFRESH_TOKEN_KEY),
    secureGetItem(EXPIRES_AT_KEY)
  ]);

  const expiresAtMs = Number(expiresAtRaw);
  return {
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : 0
  };
}

export async function setStoredTokens({ accessToken, refreshToken, expiresAtMs }) {
  const writes = [];
  if (accessToken) {
    writes.push(secureSetItem(ACCESS_TOKEN_KEY, accessToken));
  }
  if (refreshToken) {
    writes.push(secureSetItem(REFRESH_TOKEN_KEY, refreshToken));
  }
  if (Number.isFinite(expiresAtMs)) {
    writes.push(secureSetItem(EXPIRES_AT_KEY, String(expiresAtMs)));
  }
  await Promise.all(writes);
}

export async function clearStoredTokens() {
  await Promise.all([
    secureDeleteItem(ACCESS_TOKEN_KEY),
    secureDeleteItem(REFRESH_TOKEN_KEY),
    secureDeleteItem(EXPIRES_AT_KEY)
  ]);
}

export async function getOrCreateSessionId() {
  const existing = await secureGetItem(SESSION_ID_KEY);
  if (existing) {
    return existing;
  }
  const fresh = Crypto.randomUUID();
  await secureSetItem(SESSION_ID_KEY, fresh);
  return fresh;
}

const PREFS_KEY = "vibe_prefs_v1";

const DEFAULT_PREFS = {
  moodLevel: 50,
  nostalgiaSlider: 50,
  remixModeEnabled: false,
  autopilotEnabled: false,
  autoSeekEnabled: true,
  smoothTransitionEnabled: true,
  offsetSeconds: 0,
  smoothFadeSeconds: 2.5,
  seekDelaySeconds: 0,
  deviceId: "",
  lyricOffsetMs: 0,
  tempDisplayUnit: "auto"
};

let prefsCache = null;

export async function loadPrefs() {
  if (prefsCache) {
    return prefsCache;
  }
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    prefsCache = raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    prefsCache = { ...DEFAULT_PREFS };
  }
  return prefsCache;
}

export async function savePrefs(partialPrefs) {
  const current = await loadPrefs();
  prefsCache = { ...current, ...partialPrefs };
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefsCache));
  } catch {
    // Best-effort persistence; in-memory cache still reflects the update.
  }
  return prefsCache;
}

const PENDING_QUEUE_KEY = "vibe_pending_queue_target";

export async function getPendingQueueTarget() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setPendingQueueTarget(target) {
  try {
    if (!target) {
      await AsyncStorage.removeItem(PENDING_QUEUE_KEY);
    } else {
      await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(target));
    }
  } catch {
    // Best-effort; losing the resume-after-restart target is non-fatal.
  }
}
