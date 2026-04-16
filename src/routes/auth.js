import crypto from "node:crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import {
  addTrackToQueue,
  buildSpotifyAuthorizeUrl,
  exchangeCodeForTokens,
  fetchCurrentUserProfile,
  getArtistsByIds,
  getAudioFeaturesByTrackIds,
  getCurrentPlayback,
  getTrackAudioAnalysis,
  pausePlayback,
  playTrackNow,
  resumePlayback,
  searchSpotifyTracks,
  seekCurrentPlayback,
  setPlaybackVolume,
  refreshAccessToken,
  skipToNext,
  skipToPrevious
} from "../utils/spotify.js";
import SessionStateStore from "../services/vibe/SessionStateStore.js";
import VibeEngine from "../services/vibe/VibeEngine.js";

const router = Router();
const SPOTIFY_STATE_COOKIE = "spotify_oauth_state";
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const OAUTH_COOKIE_SECURE = String(env.appBaseUrl ?? "")
  .toLowerCase()
  .startsWith("https://");
const LYRICS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const lyricsCache = new Map();
const AUDIO_ANALYSIS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const audioAnalysisCache = new Map();
const issuedOauthStates = new Map();
const sessionStore = new SessionStateStore();
const vibeEngine = new VibeEngine(sessionStore);

function pruneExpiredOauthStates(nowMs = Date.now()) {
  for (const [state, expiresAtMs] of issuedOauthStates.entries()) {
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
      issuedOauthStates.delete(state);
    }
  }
}

function normalizeTrackUri(input) {
  const rawInput = String(input ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!rawInput) {
    return null;
  }

  const idPattern = /^[A-Za-z0-9]{22}$/;
  const spotifyUriMatch = rawInput.match(/spotify:track:([A-Za-z0-9]{22})/i);
  if (spotifyUriMatch?.[1] && idPattern.test(spotifyUriMatch[1])) {
    return `spotify:track:${spotifyUriMatch[1]}`;
  }

  if (idPattern.test(rawInput)) {
    return `spotify:track:${rawInput}`;
  }

  try {
    const parsedUrl = new URL(rawInput);
    const host = parsedUrl.hostname.toLowerCase();
    const pathnameParts = parsedUrl.pathname.split("/").filter(Boolean);
    const trackIdInPath = parsedUrl.pathname.match(
      /\/track\/([A-Za-z0-9]{22})(?:[/?#]|$)/i
    )?.[1];
    if (
      (host === "open.spotify.com" || host.endsWith(".spotify.com")) &&
      ((pathnameParts[0] === "track" &&
        pathnameParts[1] &&
        idPattern.test(pathnameParts[1])) ||
        (trackIdInPath && idPattern.test(trackIdInPath)))
    ) {
      return `spotify:track:${pathnameParts[1] ?? trackIdInPath}`;
    }
  } catch {
    // Not a URL. Fall through and return null.
  }

  const spotifyUrlMatch = rawInput.match(
    /open\.spotify\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:embed\/)?track\/([A-Za-z0-9]{22})/i
  );
  if (spotifyUrlMatch?.[1] && idPattern.test(spotifyUrlMatch[1])) {
    return `spotify:track:${spotifyUrlMatch[1]}`;
  }

  return null;
}

function getBearerTokenFromRequest(req) {
  const authHeader = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length);
}

function getSessionIdFromRequest(req) {
  const directValue =
    req.headers["x-dj-session-id"] ??
    req.query.sessionId ??
    req.body?.sessionId;
  const sessionId = String(directValue ?? "").trim();
  if (!sessionId) {
    return null;
  }
  return sessionId;
}

function getUserContextFromRequest(req) {
  const raw = req.body?.userContext ?? req.query?.userContext;
  if (!raw) {
    return {};
  }

  if (typeof raw === "object") {
    return raw;
  }

  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

async function handleRecommendationRequest(req, res, { forDj = false } = {}) {
  const token = getBearerTokenFromRequest(req);
  const sessionId = getSessionIdFromRequest(req);
  const userContext = getUserContextFromRequest(req);

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }
  if (!sessionId) {
    return res.status(400).json({
      error: "Missing sessionId (header x-dj-session-id or query)."
    });
  }

  try {
    const recommendation = await vibeEngine.buildNextSongRecommendation(
      token,
      sessionId,
      userContext
    );
    return res.status(200).json(recommendation);
  } catch (error) {
    return res.status(502).json({
      error: forDj
        ? "Could not build DJ recommendation plan."
        : "Could not build next-song recommendation plan.",
      details: error.message
    });
  }
}

function sanitizeLooseTokenString(rawValue) {
  return String(rawValue ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function looksLikeOpaqueToken(value) {
  return /^[A-Za-z0-9._-]{20,}$/.test(value);
}

function extractRefreshTokenFromLooseInput(rawValue) {
  const normalized = sanitizeLooseTokenString(rawValue);
  if (!normalized) {
    return "";
  }

  if (looksLikeOpaqueToken(normalized) && !normalized.includes("{")) {
    return normalized;
  }

  const regexPatterns = [
    /["']refresh_token["']\s*:\s*["']([^"']+)["']/i,
    /["']refreshToken["']\s*:\s*["']([^"']+)["']/i,
    /\brefresh_token=([^&\s]+)/i
  ];

  for (const regex of regexPatterns) {
    const match = normalized.match(regex);
    if (!match?.[1]) {
      continue;
    }
    const candidate = sanitizeLooseTokenString(
      (() => {
        try {
          return decodeURIComponent(match[1]);
        } catch {
          return match[1];
        }
      })()
    );
    if (looksLikeOpaqueToken(candidate)) {
      return candidate;
    }
  }

  try {
    const parsed = JSON.parse(normalized);
    const candidates = [
      parsed?.refreshToken,
      parsed?.refresh_token,
      parsed?.token,
      parsed?.tokens?.refresh_token,
      parsed?.tokens?.refreshToken
    ];
    for (const candidate of candidates) {
      const cleaned = sanitizeLooseTokenString(candidate);
      if (looksLikeOpaqueToken(cleaned)) {
        return cleaned;
      }
    }
  } catch {
    // Ignore parse errors and fall through.
  }

  return "";
}

function getRefreshTokenFromRequestBody(body) {
  const directCandidates = [
    body?.refreshToken,
    body?.refresh_token,
    body?.token,
    body?.tokens?.refresh_token,
    body?.tokens?.refreshToken
  ];

  for (const candidate of directCandidates) {
    const extracted = extractRefreshTokenFromLooseInput(candidate);
    if (extracted) {
      return extracted;
    }
  }

  return extractRefreshTokenFromLooseInput(body);
}

function wantsJsonCallbackResponse(req) {
  return String(req.query.format ?? "").toLowerCase() === "json";
}

function buildOAuthCallbackRedirectUrl({ tokens, error }) {
  const redirectUrl = new URL(env.appBaseUrl);
  redirectUrl.pathname = "/";
  redirectUrl.search = "";

  const hashParams = new URLSearchParams();
  if (tokens?.access_token) {
    hashParams.set("access_token", String(tokens.access_token));
  }
  if (tokens?.refresh_token) {
    hashParams.set("refresh_token", String(tokens.refresh_token));
  }
  if (error) {
    hashParams.set("auth_error", String(error));
  } else {
    hashParams.set("auth", "success");
  }

  redirectUrl.hash = hashParams.toString();
  return redirectUrl.toString();
}

function buildLyricsCacheKey(artist, title) {
  return `${String(artist ?? "").trim().toLowerCase()}::${String(title ?? "")
    .trim()
    .toLowerCase()}`;
}

function getCachedLyrics(artist, title) {
  const key = buildLyricsCacheKey(artist, title);
  const cached = lyricsCache.get(key);
  if (!cached) {
    return null;
  }
  if (Date.now() - Number(cached.cachedAtMs ?? 0) > LYRICS_CACHE_TTL_MS) {
    lyricsCache.delete(key);
    return null;
  }
  return cached;
}

function setCachedLyrics(artist, title, value) {
  const key = buildLyricsCacheKey(artist, title);
  lyricsCache.set(key, {
    cachedAtMs: Date.now(),
    ...value
  });
  if (lyricsCache.size > 300) {
    const sorted = [...lyricsCache.entries()].sort(
      (a, b) => Number(a[1]?.cachedAtMs ?? 0) - Number(b[1]?.cachedAtMs ?? 0)
    );
    const overflow = lyricsCache.size - 220;
    for (const [staleKey] of sorted.slice(0, overflow)) {
      lyricsCache.delete(staleKey);
    }
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getCachedAudioAnalysis(trackId) {
  const key = String(trackId ?? "").trim();
  if (!key) {
    return null;
  }
  const cached = audioAnalysisCache.get(key);
  if (!cached) {
    return null;
  }
  if (Date.now() - Number(cached.cachedAtMs ?? 0) > AUDIO_ANALYSIS_CACHE_TTL_MS) {
    audioAnalysisCache.delete(key);
    return null;
  }
  return cached.payload ?? null;
}

function setCachedAudioAnalysis(trackId, payload) {
  const key = String(trackId ?? "").trim();
  if (!key) {
    return;
  }
  audioAnalysisCache.set(key, {
    cachedAtMs: Date.now(),
    payload
  });
  if (audioAnalysisCache.size > 220) {
    const sorted = [...audioAnalysisCache.entries()].sort(
      (a, b) => Number(a[1]?.cachedAtMs ?? 0) - Number(b[1]?.cachedAtMs ?? 0)
    );
    const overflow = audioAnalysisCache.size - 180;
    for (const [staleKey] of sorted.slice(0, overflow)) {
      audioAnalysisCache.delete(staleKey);
    }
  }
}

function simplifyAudioAnalysisSegments(analysisPayload, barCount = 30) {
  const segments = Array.isArray(analysisPayload?.segments)
    ? analysisPayload.segments
    : [];
  return segments.slice(0, 4500).map((segment) => {
    const pitches = Array.isArray(segment?.pitches)
      ? segment.pitches
          .slice(0, 12)
          .map((value) => clamp(Number(value) || 0, 0, 1))
      : [];
    const timbre = Array.isArray(segment?.timbre)
      ? segment.timbre
          .slice(0, 12)
          .map((value) => clamp(Math.abs(Number(value) || 0) / 220, 0, 1))
      : [];
    return {
      startMs: Math.max(0, Math.round((Number(segment?.start) || 0) * 1000)),
      durationMs: Math.max(40, Math.round((Number(segment?.duration) || 0) * 1000)),
      confidence: clamp(Number(segment?.confidence) || 0, 0, 1),
      loudnessMax: Number(segment?.loudness_max ?? -60),
      pitches,
      timbre,
      barCount
    };
  });
}

async function fetchLyricsFromProvider(artist, title) {
  const url = new URL(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
  );
  const response = await fetch(url.toString(), {
    method: "GET"
  });
  if (!response.ok) {
    return null;
  }
  const payload = await response.json().catch(() => null);
  const lyrics = String(payload?.lyrics ?? "").trim();
  if (!lyrics) {
    return null;
  }
  return lyrics;
}

function parseSyncedLrcLines(syncedLyricsText) {
  const text = String(syncedLyricsText ?? "").trim();
  if (!text) {
    return [];
  }

  const lines = [];
  const rows = text.split(/\r?\n/);
  for (const row of rows) {
    const stamps = [...row.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    if (stamps.length === 0) {
      continue;
    }
    const textPart = row.replace(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g, "").trim();
    if (!textPart) {
      continue;
    }

    for (const stamp of stamps) {
      const minutes = Number(stamp[1] ?? 0);
      const seconds = Number(stamp[2] ?? 0);
      const hundredthsRaw = String(stamp[3] ?? "0");
      const milliseconds = Math.round(Number(`0.${hundredthsRaw}`) * 1000);
      const startMs =
        Math.max(0, minutes) * 60000 + Math.max(0, seconds) * 1000 + Math.max(0, milliseconds);
      lines.push({
        startMs,
        text: textPart
      });
    }
  }

  return lines.sort((a, b) => a.startMs - b.startMs);
}

async function fetchSyncedLyricsFromLrcLib(artist, title) {
  const searchUrl = new URL("https://lrclib.net/api/search");
  searchUrl.searchParams.set("artist_name", String(artist ?? ""));
  searchUrl.searchParams.set("track_name", String(title ?? ""));

  const response = await fetch(searchUrl.toString(), {
    method: "GET"
  });
  if (!response.ok) {
    return null;
  }

  const results = await response.json().catch(() => null);
  const items = Array.isArray(results) ? results : [];
  if (items.length === 0) {
    return null;
  }

  const best = items.find((item) => String(item?.syncedLyrics ?? "").trim()) ?? items[0];
  const syncedLines = parseSyncedLrcLines(best?.syncedLyrics);
  const plainLyrics = String(best?.plainLyrics ?? "").trim();
  const fallbackSyncedRaw = String(best?.syncedLyrics ?? "").trim();
  const fallbackLyrics = plainLyrics || fallbackSyncedRaw.replace(/\[[^\]]+\]/g, " ").trim();

  return {
    lyrics: fallbackLyrics,
    timedLines: syncedLines
  };
}

router.get("/spotify/login", (req, res) => {
  pruneExpiredOauthStates();
  const state = crypto.randomBytes(24).toString("hex");
  issuedOauthStates.set(state, Date.now() + OAUTH_STATE_TTL_MS);
  const authorizeUrl = buildSpotifyAuthorizeUrl(state);

  res.cookie(SPOTIFY_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: OAUTH_COOKIE_SECURE,
    maxAge: 1000 * 60 * 10
  });

  return res.redirect(authorizeUrl);
});

router.get("/spotify/callback", async (req, res) => {
  const code = req.query.code;
  const state = String(req.query.state ?? "");
  const storedState = req.cookies[SPOTIFY_STATE_COOKIE];

  if (!code || !state) {
    if (!wantsJsonCallbackResponse(req)) {
      return res.redirect(
        buildOAuthCallbackRedirectUrl({
          error: "Missing code or state from Spotify callback."
        })
      );
    }
    return res.status(400).json({
      error: "Missing code or state from Spotify callback."
    });
  }

  pruneExpiredOauthStates();
  const nowMs = Date.now();
  const isCookieStateValid = Boolean(storedState && storedState === state);
  const serverStateExpiryMs = issuedOauthStates.get(state);
  const isServerStateValid =
    Number.isFinite(serverStateExpiryMs) && serverStateExpiryMs > nowMs;

  if (!isCookieStateValid && !isServerStateValid) {
    if (!wantsJsonCallbackResponse(req)) {
      return res.redirect(
        buildOAuthCallbackRedirectUrl({
          error: "Invalid OAuth state. Try logging in again."
        })
      );
    }
    return res.status(400).json({
      error: "Invalid OAuth state. Try logging in again."
    });
  }

  try {
    const tokens = await exchangeCodeForTokens(String(code));
    res.clearCookie(SPOTIFY_STATE_COOKIE, {
      httpOnly: true,
      sameSite: "lax",
      secure: OAUTH_COOKIE_SECURE
    });
    issuedOauthStates.delete(state);

    if (!wantsJsonCallbackResponse(req)) {
      return res.redirect(
        buildOAuthCallbackRedirectUrl({
          tokens
        })
      );
    }

    return res.status(200).json({
      message: "Spotify OAuth completed successfully.",
      tokens
    });
  } catch (error) {
    if (!wantsJsonCallbackResponse(req)) {
      return res.redirect(
        buildOAuthCallbackRedirectUrl({
          error: `Spotify token exchange failed: ${error.message}`
        })
      );
    }
    return res.status(502).json({
      error: "Spotify token exchange failed.",
      details: error.message
    });
  }
});

router.post("/spotify/refresh", async (req, res) => {
  const refreshToken = getRefreshTokenFromRequestBody(req.body);

  if (!refreshToken) {
    return res.status(400).json({
      error:
        "Missing refresh token in request body. Provide refreshToken, refresh_token, or JSON containing refresh_token."
    });
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);
    return res.status(200).json({
      message: "Access token refreshed.",
      tokens
    });
  } catch (error) {
    return res.status(502).json({
      error: "Spotify refresh token request failed.",
      details: error.message
    });
  }
});

router.get("/spotify/profile", async (req, res) => {
  const token = getBearerTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  try {
    const profile = await fetchCurrentUserProfile(token);
    return res.status(200).json(profile);
  } catch (error) {
    return res.status(502).json({
      error: "Could not fetch Spotify profile.",
      details: error.message
    });
  }
});

router.get("/spotify/lyrics", async (req, res) => {
  const artist = String(req.query.artist ?? "").trim();
  const title = String(req.query.title ?? "").trim();
  if (!artist || !title) {
    return res.status(400).json({
      error: "Missing query params artist and title."
    });
  }

  const cached = getCachedLyrics(artist, title);
  if (cached) {
    return res.status(200).json({
      artist,
      title,
      found: Boolean(cached.lyrics),
      lyrics: cached.lyrics ?? "",
      timedLines: Array.isArray(cached.timedLines) ? cached.timedLines : [],
      source: "cache"
    });
  }

  try {
    const syncedPayload = await fetchSyncedLyricsFromLrcLib(artist, title);
    if (syncedPayload?.lyrics) {
      setCachedLyrics(artist, title, {
        lyrics: syncedPayload.lyrics,
        timedLines: syncedPayload.timedLines ?? [],
        source: "lrclib"
      });
      return res.status(200).json({
        artist,
        title,
        found: true,
        lyrics: syncedPayload.lyrics,
        timedLines: syncedPayload.timedLines ?? [],
        source: "lrclib"
      });
    }

    const lyrics = await fetchLyricsFromProvider(artist, title);
    if (!lyrics) {
      setCachedLyrics(artist, title, {
        lyrics: "",
        timedLines: [],
        source: "unavailable"
      });
      return res.status(200).json({
        artist,
        title,
        found: false,
        lyrics: "",
        timedLines: [],
        source: "unavailable"
      });
    }

    setCachedLyrics(artist, title, {
      lyrics,
      timedLines: [],
      source: "lyrics.ovh"
    });
    return res.status(200).json({
      artist,
      title,
      found: true,
      lyrics,
      timedLines: [],
      source: "lyrics.ovh"
    });
  } catch {
    setCachedLyrics(artist, title, {
      lyrics: "",
      timedLines: [],
      source: "unavailable"
    });
    return res.status(200).json({
      artist,
      title,
      found: false,
      lyrics: "",
      timedLines: [],
      source: "unavailable"
    });
  }
});

router.get("/spotify/search/tracks", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const query = String(req.query.q ?? "").trim();
  const limit = Number(req.query.limit ?? 10);

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  if (!query) {
    return res.status(400).json({
      error: "Missing query parameter q."
    });
  }

  try {
    const tracks = await searchSpotifyTracks(token, query, limit);
    return res.status(200).json({
      query,
      count: tracks.length,
      tracks
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not search Spotify tracks.",
      details: error.message
    });
  }
});

router.post("/spotify/player/queue", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const rawTrackInput = req.body?.trackUri ?? req.body?.uri;
  const trackUri = normalizeTrackUri(rawTrackInput);
  const deviceId = req.body?.deviceId;

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  if (!rawTrackInput || typeof rawTrackInput !== "string") {
    return res.status(400).json({
      error: "Missing trackUri in request body."
    });
  }

  if (!trackUri) {
    return res.status(400).json({
      error: "trackUri must be a valid Spotify track URI, URL, or 22-char track ID."
    });
  }

  try {
    await addTrackToQueue(token, trackUri, deviceId);
    return res.status(200).json({
      message: "Track added to queue.",
      trackUri
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not add track to Spotify queue.",
      details: error.message
    });
  }
});

router.get("/spotify/player/current", async (req, res) => {
  const token = getBearerTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  try {
    const playback = await getCurrentPlayback(token);
    if (!playback) {
      return res.status(200).json({
        hasActivePlayback: false,
        playback: null
      });
    }

    return res.status(200).json({
      hasActivePlayback: true,
      playback
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not fetch current Spotify playback state.",
      details: error.message
    });
  }
});

router.get("/spotify/player/audio-spectrum/:trackId", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const trackId = String(req.params.trackId ?? "").trim();

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }
  if (!/^[A-Za-z0-9]{22}$/.test(trackId)) {
    return res.status(400).json({
      error: "trackId must be a valid 22-char Spotify track ID."
    });
  }

  try {
    const cached = getCachedAudioAnalysis(trackId);
    if (cached) {
      return res.status(200).json({
        trackId,
        barCount: 30,
        source: "cache",
        segments: cached
      });
    }

    const analysisPayload = await getTrackAudioAnalysis(token, trackId);
    const simplifiedSegments = simplifyAudioAnalysisSegments(analysisPayload, 30);
    setCachedAudioAnalysis(trackId, simplifiedSegments);

    return res.status(200).json({
      trackId,
      barCount: 30,
      source: "spotify_audio_analysis",
      segments: simplifiedSegments
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not fetch Spotify audio analysis.",
      details: error.message
    });
  }
});

router.put("/spotify/player/seek", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const positionMs = Number(req.body?.positionMs);
  const deviceId = req.body?.deviceId;

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  if (!Number.isFinite(positionMs) || positionMs < 0) {
    return res.status(400).json({
      error: "positionMs must be a non-negative number."
    });
  }

  try {
    await seekCurrentPlayback(token, Math.round(positionMs), deviceId);
    return res.status(200).json({
      message: "Seek command sent.",
      positionMs: Math.round(positionMs)
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not seek current Spotify playback.",
      details: error.message
    });
  }
});

router.put("/spotify/player/volume", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const volumePercent = Number(req.body?.volumePercent);
  const deviceId = req.body?.deviceId;

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  if (!Number.isFinite(volumePercent) || volumePercent < 0 || volumePercent > 100) {
    return res.status(400).json({
      error: "volumePercent must be a number between 0 and 100."
    });
  }

  try {
    const result = await setPlaybackVolume(token, volumePercent, deviceId);
    return res.status(200).json({
      message: "Playback volume updated.",
      ...result
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not update Spotify playback volume.",
      details: error.message
    });
  }
});

router.put("/spotify/player/play-now", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const rawTrackInput = req.body?.trackUri ?? req.body?.uri;
  const trackUri = normalizeTrackUri(rawTrackInput);
  const deviceId = req.body?.deviceId;
  const positionMs = Number(req.body?.positionMs ?? 0);

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  if (!rawTrackInput || typeof rawTrackInput !== "string") {
    return res.status(400).json({
      error: "Missing trackUri in request body."
    });
  }

  if (!trackUri) {
    return res.status(400).json({
      error: "trackUri must be a valid Spotify track URI, URL, or 22-char track ID."
    });
  }

  if (!Number.isFinite(positionMs) || positionMs < 0) {
    return res.status(400).json({
      error: "positionMs must be a non-negative number."
    });
  }

  try {
    const result = await playTrackNow(
      token,
      trackUri,
      deviceId,
      Math.round(positionMs)
    );
    return res.status(200).json({
      message: "Playback started immediately.",
      ...result
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not start Spotify playback.",
      details: error.message
    });
  }
});

router.put("/spotify/player/pause", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const deviceId = req.body?.deviceId;

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  try {
    await pausePlayback(token, deviceId);
    return res.status(200).json({
      message: "Playback paused."
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not pause Spotify playback.",
      details: error.message
    });
  }
});

router.put("/spotify/player/resume", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const deviceId = req.body?.deviceId;

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  try {
    await resumePlayback(token, deviceId);
    return res.status(200).json({
      message: "Playback resumed."
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not resume Spotify playback.",
      details: error.message
    });
  }
});

router.post("/spotify/player/next", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const deviceId = req.body?.deviceId;

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  try {
    await skipToNext(token, deviceId);
    return res.status(200).json({
      message: "Skipped to next track."
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not skip to next Spotify track.",
      details: error.message
    });
  }
});

router.post("/spotify/player/previous", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const deviceId = req.body?.deviceId;

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  try {
    await skipToPrevious(token, deviceId);
    return res.status(200).json({
      message: "Went back to previous track."
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not go to previous Spotify track.",
      details: error.message
    });
  }
});

router.post("/spotify/dj/session/start", (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return res.status(400).json({
      error: "Missing sessionId (header x-dj-session-id, query, or body)."
    });
  }

  const remixModeEnabled = Boolean(req.body?.remixModeEnabled);
  const snapshot = sessionStore.setRemixMode(sessionId, remixModeEnabled);
  return res.status(200).json({
    message: "DJ session started.",
    session: snapshot
  });
});

router.get("/spotify/dj/session", (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return res.status(400).json({
      error: "Missing sessionId (header x-dj-session-id or query)."
    });
  }

  const snapshot = sessionStore.snapshot(sessionId);
  return res.status(200).json({
    session: snapshot
  });
});

router.post("/spotify/dj/session/remix-mode", (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return res.status(400).json({
      error: "Missing sessionId (header x-dj-session-id, query, or body)."
    });
  }

  const remixModeEnabled = Boolean(req.body?.remixModeEnabled);
  const snapshot = sessionStore.setRemixMode(sessionId, remixModeEnabled);
  return res.status(200).json({
    message: "Remix mode updated.",
    session: snapshot
  });
});

router.post("/spotify/dj/session/affinity/search", (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  const query = String(req.body?.query ?? "").trim();
  if (!sessionId) {
    return res.status(400).json({
      error: "Missing sessionId (header x-dj-session-id, query, or body)."
    });
  }
  if (!query) {
    return res.status(400).json({
      error: "Missing query text."
    });
  }

  const snapshot = sessionStore.recordSearchAffinity(sessionId, query);
  return res.status(200).json({
    message: "Search affinity recorded.",
    session: snapshot
  });
});

router.post("/spotify/dj/session/feedback/skip", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const sessionId = getSessionIdFromRequest(req);
  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }
  if (!sessionId) {
    return res.status(400).json({
      error: "Missing sessionId (header x-dj-session-id, query, or body)."
    });
  }

  const trackId = String(req.body?.trackId ?? "").trim();
  const progressMs = Number(req.body?.progressMs ?? 0);
  const artistIds = Array.isArray(req.body?.artistIds)
    ? req.body.artistIds.filter(Boolean)
    : [];
  let tempo = Number(req.body?.tempo);
  let genreTags = Array.isArray(req.body?.genreTags)
    ? req.body.genreTags.filter(Boolean)
    : [];

  try {
    if (trackId && !Number.isFinite(tempo)) {
      const featuresById = await getAudioFeaturesByTrackIds(token, [trackId]);
      const maybeTempo = featuresById?.[trackId]?.tempo;
      if (Number.isFinite(maybeTempo)) {
        tempo = maybeTempo;
      }
    }

    if (artistIds.length > 0 && genreTags.length === 0) {
      const artistsById = await getArtistsByIds(token, artistIds);
      genreTags = artistIds.flatMap((artistId) => artistsById?.[artistId]?.genres ?? []);
    }

    const snapshot = sessionStore.recordSkipFeedback(sessionId, {
      trackId,
      progressMs,
      artistIds,
      genreTags,
      tempo
    });
    return res.status(200).json({
      message: "Skip feedback recorded.",
      session: snapshot
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not record skip feedback.",
      details: error.message
    });
  }
});

router.get("/spotify/recommend/next", (req, res) =>
  handleRecommendationRequest(req, res, { forDj: false })
);
router.post("/spotify/recommend/next", (req, res) =>
  handleRecommendationRequest(req, res, { forDj: false })
);

router.get("/spotify/dj/recommend/next", (req, res) =>
  handleRecommendationRequest(req, res, { forDj: true })
);
router.post("/spotify/dj/recommend/next", (req, res) =>
  handleRecommendationRequest(req, res, { forDj: true })
);

export default router;
