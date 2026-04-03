import { env } from "../config/env.js";

const SPOTIFY_ACCOUNTS_BASE_URL = "https://accounts.spotify.com";
const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";

function getBasicAuthHeader() {
  const credentials = `${env.spotifyClientId}:${env.spotifyClientSecret}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

export function buildSpotifyAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: env.spotifyClientId,
    response_type: "code",
    redirect_uri: env.spotifyRedirectUri,
    scope: env.spotifyScopes,
    state,
    show_dialog: "true"
  });

  return `${SPOTIFY_ACCOUNTS_BASE_URL}/authorize?${params.toString()}`;
}

async function fetchSpotifyToken(bodyParams) {
  const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE_URL}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: getBasicAuthHeader()
    },
    body: new URLSearchParams(bodyParams).toString()
  });

  const payload = await response.json();

  if (!response.ok) {
    const errorMessage = payload.error_description ?? payload.error ?? "Unknown Spotify token error";
    throw new Error(`Spotify token request failed: ${errorMessage}`);
  }

  return payload;
}

export function exchangeCodeForTokens(code) {
  return fetchSpotifyToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.spotifyRedirectUri
  });
}

export function refreshAccessToken(refreshToken) {
  return fetchSpotifyToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
}

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function spotifyApiRequest({
  method = "GET",
  path,
  accessToken,
  queryParams = {},
  body,
  allowNoContent = false
}) {
  const url = new URL(`${SPOTIFY_API_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (response.status === 204 && allowNoContent) {
    return null;
  }

  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.error_description ??
      payload?.error ??
      `Spotify API request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function fetchCurrentUserProfile(accessToken) {
  return spotifyApiRequest({
    method: "GET",
    path: "/me",
    accessToken
  });
}

export async function addTrackToQueue(accessToken, trackUri, deviceId) {
  await spotifyApiRequest({
    method: "POST",
    path: "/me/player/queue",
    accessToken,
    queryParams: {
      uri: trackUri,
      device_id: deviceId
    },
    allowNoContent: true
  });

  return { queued: true };
}

export function getCurrentPlayback(accessToken) {
  return spotifyApiRequest({
    method: "GET",
    path: "/me/player",
    accessToken,
    allowNoContent: true
  });
}

export async function seekCurrentPlayback(accessToken, positionMs, deviceId) {
  await spotifyApiRequest({
    method: "PUT",
    path: "/me/player/seek",
    accessToken,
    queryParams: {
      position_ms: positionMs,
      device_id: deviceId
    },
    allowNoContent: true
  });

  return { positionMs };
}

export async function playTrackNow(
  accessToken,
  trackUri,
  deviceId,
  positionMs = 0
) {
  await spotifyApiRequest({
    method: "PUT",
    path: "/me/player/play",
    accessToken,
    queryParams: {
      device_id: deviceId
    },
    body: {
      uris: [trackUri],
      position_ms: Math.max(0, Math.round(Number(positionMs) || 0))
    },
    allowNoContent: true
  });

  return { trackUri, positionMs: Math.max(0, Math.round(Number(positionMs) || 0)) };
}

export async function searchSpotifyTracks(accessToken, query, limit = 10) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 25));

  const payload = await spotifyApiRequest({
    method: "GET",
    path: "/search",
    accessToken,
    queryParams: {
      q: query,
      type: "track",
      limit: safeLimit
    }
  });

  const items = payload?.tracks?.items ?? [];
  return items.map((track) => ({
    id: track.id,
    uri: track.uri,
    name: track.name,
    artistNames: (track.artists ?? []).map((artist) => artist.name),
    albumName: track.album?.name ?? "",
    durationMs: track.duration_ms ?? 0,
    explicit: Boolean(track.explicit),
    externalUrl: track.external_urls?.spotify ?? null
  }));
}
