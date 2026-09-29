import { getApiBaseUrl } from "./apiBaseUrl";

let authAccessor = {
  getAccessToken: () => null,
  getSessionId: () => null,
  refreshAccessToken: async () => null
};

export function registerAuthAccessor(accessor) {
  authAccessor = accessor;
}

function isTokenExpiredError(error) {
  if (error?.status === 401) {
    return true;
  }
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("token") && (message.includes("expired") || message.includes("invalid") || message.includes("missing"));
}

async function rawRequest(path, { method = "GET", body, token, sessionId } = {}) {
  const url = `${getApiBaseUrl()}${path}`;
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (sessionId) {
    headers["X-DJ-Session-ID"] = sessionId;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new Error(
      `Could not reach the server at ${getApiBaseUrl()}. Check that your phone and computer are on the same Wi-Fi network and the server is running.`
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error ?? payload?.details ?? `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function apiRequest(path, options = {}) {
  const token = options.token ?? authAccessor.getAccessToken();
  const sessionId = options.sessionId ?? authAccessor.getSessionId();

  try {
    return await rawRequest(path, { ...options, token, sessionId });
  } catch (error) {
    if (options.allowAutoRefresh === false || !token || !isTokenExpiredError(error)) {
      throw error;
    }
    const refreshedToken = await authAccessor.refreshAccessToken();
    if (!refreshedToken) {
      throw error;
    }
    return rawRequest(path, { ...options, token: refreshedToken, sessionId });
  }
}

export function getMobileAuthorizeUrl(redirectUri) {
  return apiRequest(`/auth/spotify/mobile/authorize-url?redirectUri=${encodeURIComponent(redirectUri)}`, {
    allowAutoRefresh: false
  });
}

export function exchangeMobileCode({ code, state }) {
  return apiRequest("/auth/spotify/mobile/exchange", {
    method: "POST",
    body: { code, state },
    allowAutoRefresh: false
  });
}

export function refreshAccessTokenRequest(refreshToken) {
  return apiRequest("/auth/spotify/refresh", {
    method: "POST",
    body: { refreshToken },
    allowAutoRefresh: false
  });
}

export function getProfile() {
  return apiRequest("/auth/spotify/profile");
}

export function searchTracks(query, limit = 10) {
  return apiRequest(`/auth/spotify/search/tracks?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export function getCurrentPlayback() {
  return apiRequest("/auth/spotify/player/current");
}

export function queueTrack({ trackUri, deviceId }) {
  return apiRequest("/auth/spotify/player/queue", {
    method: "POST",
    body: { trackUri, deviceId }
  });
}

export function playNow({ trackUri, deviceId, positionMs }) {
  return apiRequest("/auth/spotify/player/play-now", {
    method: "PUT",
    body: { trackUri, deviceId, positionMs }
  });
}

export function pausePlayback({ deviceId }) {
  return apiRequest("/auth/spotify/player/pause", { method: "PUT", body: { deviceId } });
}

export function resumePlayback({ deviceId }) {
  return apiRequest("/auth/spotify/player/resume", { method: "PUT", body: { deviceId } });
}

export function skipToNext({ deviceId }) {
  return apiRequest("/auth/spotify/player/next", { method: "POST", body: { deviceId } });
}

export function skipToPrevious({ deviceId }) {
  return apiRequest("/auth/spotify/player/previous", { method: "POST", body: { deviceId } });
}

export function seekPlayback({ positionMs, deviceId }) {
  return apiRequest("/auth/spotify/player/seek", { method: "PUT", body: { positionMs, deviceId } });
}

export function setVolume({ volumePercent, deviceId }) {
  return apiRequest("/auth/spotify/player/volume", {
    method: "PUT",
    body: { volumePercent, deviceId }
  });
}

export function getAudioSpectrum(trackId) {
  return apiRequest(`/auth/spotify/player/audio-spectrum/${trackId}`);
}

export function getLyrics({ artist, title }) {
  return apiRequest(
    `/auth/spotify/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`
  );
}

export function startDjSession({ sessionId, remixModeEnabled }) {
  return apiRequest("/auth/spotify/dj/session/start", {
    method: "POST",
    sessionId,
    body: { sessionId, remixModeEnabled }
  });
}

export function setRemixMode({ sessionId, remixModeEnabled }) {
  return apiRequest("/auth/spotify/dj/session/remix-mode", {
    method: "POST",
    sessionId,
    body: { sessionId, remixModeEnabled }
  });
}

export function recordSearchAffinity({ sessionId, query }) {
  return apiRequest("/auth/spotify/dj/session/affinity/search", {
    method: "POST",
    sessionId,
    body: { sessionId, query }
  });
}

export function recordSkipFeedback({ sessionId, trackId, progressMs, artistIds, genreTags, tempo }) {
  return apiRequest("/auth/spotify/dj/session/feedback/skip", {
    method: "POST",
    sessionId,
    body: { sessionId, trackId, progressMs, artistIds, genreTags, tempo }
  });
}

export function recommendNext({ sessionId, userContext, forDj = true }) {
  const path = forDj ? "/auth/spotify/dj/recommend/next" : "/auth/spotify/recommend/next";
  return apiRequest(path, {
    method: "POST",
    sessionId,
    body: { sessionId, userContext }
  });
}
