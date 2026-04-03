import crypto from "node:crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import {
  addTrackToQueue,
  buildSpotifyAuthorizeUrl,
  exchangeCodeForTokens,
  fetchCurrentUserProfile,
  getCurrentPlayback,
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
import { buildNextSongRecommendation } from "../services/recommendationEngine.js";

const router = Router();
const SPOTIFY_STATE_COOKIE = "spotify_oauth_state";
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const issuedOauthStates = new Map();

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

router.get("/spotify/login", (req, res) => {
  pruneExpiredOauthStates();
  const state = crypto.randomBytes(24).toString("hex");
  issuedOauthStates.set(state, Date.now() + OAUTH_STATE_TTL_MS);
  const authorizeUrl = buildSpotifyAuthorizeUrl(state);

  res.cookie(SPOTIFY_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
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
    res.clearCookie(SPOTIFY_STATE_COOKIE);
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

router.get("/spotify/recommend/next", async (req, res) => {
  const token = getBearerTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  try {
    const recommendation = await buildNextSongRecommendation(token);
    return res.status(200).json(recommendation);
  } catch (error) {
    return res.status(502).json({
      error: "Could not build next-song recommendation plan.",
      details: error.message
    });
  }
});

export default router;
