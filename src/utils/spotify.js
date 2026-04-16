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

function mapSpotifyTrack(track) {
  if (!track) {
    return null;
  }

  const releaseDate = String(track.album?.release_date ?? "");
  const releaseYearMatch = releaseDate.match(/^(\d{4})/);
  const releaseYear = releaseYearMatch?.[1]
    ? Number(releaseYearMatch[1])
    : null;

  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artistNames: (track.artists ?? []).map((artist) => artist.name),
    artists: (track.artists ?? []).map((artist) => ({
      id: artist.id,
      name: artist.name
    })),
    albumName: track.album?.name ?? "",
    albumImageUrl:
      track.album?.images?.[0]?.url ??
      track.album?.images?.[1]?.url ??
      null,
    durationMs: track.duration_ms ?? 0,
    explicit: Boolean(track.explicit),
    popularity: Number.isFinite(track.popularity) ? track.popularity : 0,
    releaseYear: Number.isFinite(releaseYear) ? releaseYear : null,
    externalUrl: track.external_urls?.spotify ?? null
  };
}

function mapPlayableTrackFromContainer(container) {
  if (!container) {
    return null;
  }

  const track =
    container?.type === "track"
      ? container
      : container?.track?.type === "track"
        ? container.track
        : null;
  if (!track) {
    return null;
  }

  return mapSpotifyTrack(track);
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

export async function setPlaybackVolume(accessToken, volumePercent, deviceId) {
  const safeVolumePercent = Math.max(
    0,
    Math.min(100, Math.round(Number(volumePercent) || 0))
  );

  await spotifyApiRequest({
    method: "PUT",
    path: "/me/player/volume",
    accessToken,
    queryParams: {
      volume_percent: safeVolumePercent,
      device_id: deviceId
    },
    allowNoContent: true
  });

  return { volumePercent: safeVolumePercent };
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

export async function pausePlayback(accessToken, deviceId) {
  await spotifyApiRequest({
    method: "PUT",
    path: "/me/player/pause",
    accessToken,
    queryParams: {
      device_id: deviceId
    },
    allowNoContent: true
  });

  return { paused: true };
}

export async function resumePlayback(accessToken, deviceId) {
  await spotifyApiRequest({
    method: "PUT",
    path: "/me/player/play",
    accessToken,
    queryParams: {
      device_id: deviceId
    },
    allowNoContent: true
  });

  return { playing: true };
}

export async function skipToNext(accessToken, deviceId) {
  await spotifyApiRequest({
    method: "POST",
    path: "/me/player/next",
    accessToken,
    queryParams: {
      device_id: deviceId
    },
    allowNoContent: true
  });

  return { skipped: "next" };
}

export async function skipToPrevious(accessToken, deviceId) {
  await spotifyApiRequest({
    method: "POST",
    path: "/me/player/previous",
    accessToken,
    queryParams: {
      device_id: deviceId
    },
    allowNoContent: true
  });

  return { skipped: "previous" };
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
  return items.map((track) => mapSpotifyTrack(track)).filter(Boolean);
}

export async function getUserTopTracks(
  accessToken,
  { limit = 20, timeRange = "medium_term" } = {}
) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
  const safeTimeRange = ["short_term", "medium_term", "long_term"].includes(
    timeRange
  )
    ? timeRange
    : "medium_term";

  const payload = await spotifyApiRequest({
    method: "GET",
    path: "/me/top/tracks",
    accessToken,
    queryParams: {
      limit: safeLimit,
      time_range: safeTimeRange
    }
  });

  const items = payload?.items ?? [];
  return items.map((track) => mapSpotifyTrack(track)).filter(Boolean);
}

export async function getSpotifyRecommendations(
  accessToken,
  {
    seedTrackIds = [],
    seedArtistIds = [],
    seedGenres = [],
    limit = 20,
    extraQueryParams = {}
  } = {}
) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
  const tracks = seedTrackIds.filter(Boolean).slice(0, 5);
  const artists = seedArtistIds.filter(Boolean).slice(0, 5);
  const genres = seedGenres.filter(Boolean).slice(0, 5);

  const seedsCount = tracks.length + artists.length + genres.length;
  if (seedsCount === 0) {
    throw new Error("At least one seed is required for Spotify recommendations.");
  }

  if (seedsCount > 5) {
    const allowedTrackSeeds = tracks.slice(0, 3);
    const remaining = 5 - allowedTrackSeeds.length;
    const allowedArtistSeeds = artists.slice(0, Math.max(0, remaining));
    const remainingAfterArtists = 5 - allowedTrackSeeds.length - allowedArtistSeeds.length;
    const allowedGenreSeeds = genres.slice(0, Math.max(0, remainingAfterArtists));

    return getSpotifyRecommendations(accessToken, {
      seedTrackIds: allowedTrackSeeds,
      seedArtistIds: allowedArtistSeeds,
      seedGenres: allowedGenreSeeds,
      limit: safeLimit,
      extraQueryParams
    });
  }

  const queryParams = {
    limit: safeLimit,
    seed_tracks: tracks.join(","),
    seed_artists: artists.join(","),
    seed_genres: genres.join(","),
    ...extraQueryParams
  };

  const payload = await spotifyApiRequest({
    method: "GET",
    path: "/recommendations",
    accessToken,
    queryParams
  });

  const items = payload?.tracks ?? [];
  return items.map((track) => mapSpotifyTrack(track)).filter(Boolean);
}

export async function getPlaybackQueue(accessToken) {
  const payload = await spotifyApiRequest({
    method: "GET",
    path: "/me/player/queue",
    accessToken
  });

  const queueItems = payload?.queue ?? [];
  return queueItems
    .map((item) => (item?.type === "track" ? mapSpotifyTrack(item) : null))
    .filter(Boolean);
}

export async function getRecentlyPlayedTracks(accessToken, { limit = 30 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 50));
  const payload = await spotifyApiRequest({
    method: "GET",
    path: "/me/player/recently-played",
    accessToken,
    queryParams: {
      limit: safeLimit
    }
  });

  const items = payload?.items ?? [];
  return items.map((item) => mapPlayableTrackFromContainer(item)).filter(Boolean);
}

/**
 * Recently played with `played_at` timestamps (for freshness windows).
 * Each item: { track, playedAtMs } where playedAtMs is epoch ms or null.
 */
export async function getRecentlyPlayedTrackEvents(accessToken, { limit = 50 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 50));
  const payload = await spotifyApiRequest({
    method: "GET",
    path: "/me/player/recently-played",
    accessToken,
    queryParams: {
      limit: safeLimit
    }
  });

  const items = payload?.items ?? [];
  const out = [];
  for (const item of items) {
    const track = mapPlayableTrackFromContainer(item);
    if (!track) {
      continue;
    }
    const raw = item?.played_at;
    const playedAtMs = raw ? Date.parse(String(raw)) : null;
    out.push({
      track,
      playedAtMs: Number.isFinite(playedAtMs) ? playedAtMs : null
    });
  }
  return out;
}

export async function getSavedTracks(accessToken, { limit = 30, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 50));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const payload = await spotifyApiRequest({
    method: "GET",
    path: "/me/tracks",
    accessToken,
    queryParams: {
      limit: safeLimit,
      offset: safeOffset
    }
  });

  const items = payload?.items ?? [];
  return items.map((item) => mapPlayableTrackFromContainer(item)).filter(Boolean);
}

export async function getCurrentUserPlaylists(accessToken, { limit = 12 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 12, 50));
  const payload = await spotifyApiRequest({
    method: "GET",
    path: "/me/playlists",
    accessToken,
    queryParams: {
      limit: safeLimit
    }
  });

  const items = payload?.items ?? [];
  return items
    .map((playlist) => ({
      id: playlist?.id,
      name: playlist?.name ?? "",
      tracksTotal: Number(playlist?.tracks?.total ?? 0)
    }))
    .filter((playlist) => playlist.id);
}

export async function getPlaylistTracks(
  accessToken,
  playlistId,
  { limit = 20 } = {}
) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const payload = await spotifyApiRequest({
    method: "GET",
    path: `/playlists/${encodeURIComponent(playlistId)}/tracks`,
    accessToken,
    queryParams: {
      limit: safeLimit,
      fields: "items(track(id,uri,name,artists(id,name),album(name,images,release_date),duration_ms,explicit,popularity,external_urls,type))"
    }
  });

  const items = payload?.items ?? [];
  return items.map((item) => mapPlayableTrackFromContainer(item)).filter(Boolean);
}

export async function getPlaylistTrackCandidates(
  accessToken,
  { playlistLimit = 8, tracksPerPlaylist = 15 } = {}
) {
  const playlists = await getCurrentUserPlaylists(accessToken, {
    limit: playlistLimit
  });
  if (playlists.length === 0) {
    return [];
  }

  const selectedPlaylists = playlists.slice(0, Math.max(1, playlistLimit));
  const trackLists = await Promise.all(
    selectedPlaylists.map((playlist) =>
      getPlaylistTracks(accessToken, playlist.id, {
        limit: tracksPerPlaylist
      }).catch(() => [])
    )
  );

  return trackLists.flat();
}

export async function getAudioFeaturesByTrackIds(accessToken, trackIds = []) {
  const ids = [...new Set(trackIds.filter(Boolean))].slice(0, 100);
  if (ids.length === 0) {
    return {};
  }

  const payload = await spotifyApiRequest({
    method: "GET",
    path: "/audio-features",
    accessToken,
    queryParams: {
      ids: ids.join(",")
    }
  });

  const features = payload?.audio_features ?? [];
  const byTrackId = {};

  for (const item of features) {
    if (!item?.id) {
      continue;
    }

    byTrackId[item.id] = {
      tempo: Number.isFinite(item.tempo) ? item.tempo : null,
      energy: Number.isFinite(item.energy) ? item.energy : null,
      danceability: Number.isFinite(item.danceability) ? item.danceability : null,
      valence: Number.isFinite(item.valence) ? item.valence : null,
      loudness: Number.isFinite(item.loudness) ? item.loudness : null
    };
  }

  return byTrackId;
}

export async function getTrackAudioAnalysis(accessToken, trackId) {
  const safeTrackId = String(trackId ?? "").trim();
  if (!/^[A-Za-z0-9]{22}$/.test(safeTrackId)) {
    throw new Error("trackId must be a valid 22-char Spotify track ID.");
  }

  return spotifyApiRequest({
    method: "GET",
    path: `/audio-analysis/${safeTrackId}`,
    accessToken
  });
}

export async function getArtistsByIds(accessToken, artistIds = []) {
  const ids = [...new Set(artistIds.filter(Boolean))].slice(0, 50);
  if (ids.length === 0) {
    return {};
  }

  const payload = await spotifyApiRequest({
    method: "GET",
    path: "/artists",
    accessToken,
    queryParams: {
      ids: ids.join(",")
    }
  });

  const artists = payload?.artists ?? [];
  const byArtistId = {};

  for (const artist of artists) {
    if (!artist?.id) {
      continue;
    }
    byArtistId[artist.id] = {
      id: artist.id,
      name: artist.name ?? "",
      genres: Array.isArray(artist.genres) ? artist.genres : []
    };
  }

  return byArtistId;
}
